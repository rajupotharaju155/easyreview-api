import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  OnModuleInit,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  FindOptionsWhere,
  In,
  IsNull,
  LessThan,
  LessThanOrEqual,
  MoreThanOrEqual,
  Not,
  QueryFailedError,
  Repository,
} from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { PaymentsService } from '../payments/payments.service';
import { Plan } from '../plans/entities/plan.entity';
import {
  Product,
  productDisplayName,
  productSubject,
} from '../plans/enums/product.enum';
import { Profile } from '../profiles/entities/profile.entity';
import {
  getAdminDemoSubscription,
  isAdminDemoAccount,
} from './constants/admin-demo-subscription.constants';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { HqCreateSubscriptionDto } from './dto/hq-create-subscription.dto';
import { HqSubscriptionsQueryDto } from './dto/hq-subscriptions-query.dto';
import { SubscriptionsQueryDto } from './dto/subscriptions-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionSource } from './enums/subscription-source.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import {
  buildSubscriptionInvoicePdf,
  type InvoicePayload,
} from './utils/invoice-pdf';
import {
  addDaysToIsoDate,
  endDateFromDuration,
  todayIst,
} from './utils/ist-date.util';

@Injectable()
export class SubscriptionsService implements OnModuleInit {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @InjectRepository(Profile)
    private readonly profileRepository: Repository<Profile>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async onModuleInit(): Promise<void> {
    await this.backfillSubscriptionProducts();
    await this.dropLegacyOpenSubscriptionIndex();
  }

  async findAllForUser(
    query: SubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    await this.expireOverdue({ userId });

    const { page = 1, limit = 10, locationId, profileId } = query;
    const where: FindOptionsWhere<Subscription> = { userId };
    if (locationId) {
      where.locationId = locationId;
    }
    if (profileId) {
      where.profileId = profileId;
    }

    return this.paginate(where, page, limit);
  }

  /** Live access: an active or in-window queued subscription (IST). */
  async hasActiveForLocation(
    locationId: string,
    product: Product = Product.EASY_REVIEW,
  ): Promise<boolean> {
    await this.expireOverdue({ locationId });
    return Boolean(await this.findLiveForSubject({ locationId }, product));
  }

  async hasActiveForProfile(
    profileId: string,
    product: Product = Product.EASY_PROFILE,
  ): Promise<boolean> {
    await this.expireOverdue({ profileId });
    return Boolean(await this.findLiveForSubject({ profileId }, product));
  }

  /**
   * Open EasyProfile plan for each profile, preferring active, then pending,
   * then queued. Used by the HQ profiles table so Create subscription is hidden
   * once a plan already exists.
   */
  async findOpenForProfiles(profileIds: string[]): Promise<
    Map<
      string,
      { id: string; status: SubscriptionStatus; planName: string | null }
    >
  > {
    const result = new Map<
      string,
      { id: string; status: SubscriptionStatus; planName: string | null }
    >();
    if (profileIds.length === 0) return result;

    const rows = await this.subscriptionRepository.find({
      where: {
        profileId: In(profileIds),
        product: Product.EASY_PROFILE,
        status: In([
          SubscriptionStatus.ACTIVE,
          SubscriptionStatus.PENDING_PAYMENT,
          SubscriptionStatus.QUEUED,
        ]),
      },
      relations: { plan: true },
    });

    const rank: Record<string, number> = {
      [SubscriptionStatus.ACTIVE]: 0,
      [SubscriptionStatus.PENDING_PAYMENT]: 1,
      [SubscriptionStatus.QUEUED]: 2,
    };

    for (const row of rows) {
      if (!row.profileId) continue;
      const current = result.get(row.profileId);
      const summary = {
        id: row.id,
        status: row.status,
        planName: row.plan?.name ?? null,
      };
      if (!current || rank[row.status] < rank[current.status]) {
        result.set(row.profileId, summary);
      }
    }

    return result;
  }

  async findOneForUser(id: string): Promise<Subscription> {
    const userId = this.currentUserUtil.getCurrentUserId();
    await this.expireOverdue({ userId });

    const subscription = await this.subscriptionRepository.findOne({
      where: { id, userId },
      relations: { plan: true, location: true, profile: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }
    return subscription;
  }

  async getInvoicePdfForUser(
    id: string,
  ): Promise<{ pdf: Uint8Array; filename: string }> {
    const userId = this.currentUserUtil.getCurrentUserId();
    await this.expireOverdue({ userId });

    const subscription = await this.subscriptionRepository.findOne({
      where: { id, userId },
      relations: { plan: true, location: true, profile: true, user: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }

    const payment = await this.paymentsService.findLatestForSubscription(
      subscription.id,
      userId,
    );
    const pdf = await buildSubscriptionInvoicePdf(
      this.toInvoicePayload(subscription, payment),
    );
    return {
      pdf,
      filename: `${invoiceFileSlug(subscription.product)}-invoice-${subscription.id}.pdf`,
    };
  }

  async createForUser(dto: CreateSubscriptionDto): Promise<Subscription> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const target = await this.resolveCreateTarget(dto, userId);
    const plan = await this.findPlan(dto.planId);

    if (plan.amount === 0) {
      throw new BadRequestException(
        'This plan can only be assigned by EasyReview',
      );
    }

    return this.createSubscription({
      ...target,
      plan,
      source: SubscriptionSource.SELF_SERVE,
      notes: dto.notes,
      startDate: dto.startDate,
    });
  }

  async findAllForHq(
    query: HqSubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const { page = 1, limit = 10, locationId, profileId, userId, planId, status } =
      query;
    await this.expireOverdue({ locationId, profileId, userId });

    const where: FindOptionsWhere<Subscription> = {};
    if (locationId) where.locationId = locationId;
    if (profileId) where.profileId = profileId;
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;
    if (status) where.status = status;

    return this.paginate(where, page, limit);
  }

  async findOneForHq(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { plan: true, location: true, profile: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }
    await this.expireIfOverdue(subscription);
    return subscription;
  }

  async createForHq(dto: HqCreateSubscriptionDto): Promise<Subscription> {
    const target = await this.resolveCreateTarget(dto);
    const plan = await this.findPlan(dto.planId);

    return this.createSubscription({
      ...target,
      plan,
      source: SubscriptionSource.HQ,
      notes: dto.notes,
      startDate: dto.startDate,
      payment: {
        provider: dto.paymentProvider,
        utr: dto.utr,
        notes: dto.paymentNotes,
        status: dto.paymentStatus ?? PaymentStatus.SUCCESS,
        discountAmount: dto.discountAmount,
      },
    });
  }

  /**
   * Auto-activates the 2 Day Demo plan when an eligible account adds a location.
   */
  async grantAdminDemoIfEligible(
    location: Location,
  ): Promise<Subscription | null> {
    const config = getAdminDemoSubscription();
    const user = this.currentUserUtil.getCurrentUserOrNull();
    if (!config || !user || !isAdminDemoAccount(user, config)) {
      return null;
    }
    if (location.userId !== config.userId) {
      return null;
    }

    return this.createSubscription({
      location,
      plan: await this.findPlan(config.planId),
      source: SubscriptionSource.HQ,
      notes: config.notes,
      payment: { status: PaymentStatus.SUCCESS },
    });
  }

  async updateForHq(
    id: string,
    dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    const subscription = await this.findOneForHq(id);

    if (dto.notes !== undefined) subscription.notes = dto.notes;
    if (dto.gatewaySubscriptionId !== undefined) {
      subscription.gatewaySubscriptionId = dto.gatewaySubscriptionId;
    }
    if (dto.startDate !== undefined) subscription.startDate = dto.startDate;
    if (dto.endDate !== undefined) subscription.endDate = dto.endDate;

    if (dto.status !== undefined) {
      await this.applyStatus(subscription, dto.status);
    } else {
      this.syncExpiredFromDates(subscription);
    }

    this.assertDateRange(subscription);

    try {
      const saved = await this.subscriptionRepository.save(subscription);
      return saved;
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async removeForHq(id: string): Promise<Subscription> {
    const subscription = await this.findOneForHq(id);
    await this.subscriptionRepository.delete(id);
    return subscription;
  }

  private async createSubscription(input: {
    location?: Location;
    profile?: Profile;
    plan: Plan;
    source: SubscriptionSource;
    notes?: string;
    startDate?: string;
    payment?: {
      provider?: PaymentProvider;
      utr?: string;
      notes?: string | null;
      status?: PaymentStatus;
      discountAmount?: number;
    };
  }): Promise<Subscription> {
    if (!input.plan.isActive) {
      throw new BadRequestException(`Plan "${input.plan.code}" is not active`);
    }

    const product = input.plan.product ?? Product.EASY_REVIEW;
    const subject = this.assertPlanSubject(product, input.location, input.profile);
    await this.expireOverdue(subject);

    const isComplimentary = input.plan.amount === 0;
    const paymentStatus = isComplimentary
      ? PaymentStatus.SUCCESS
      : (input.payment?.status ?? PaymentStatus.PENDING);
    const paymentReceived = paymentStatus === PaymentStatus.SUCCESS;
    const owner = input.profile ?? input.location;
    if (!owner) {
      throw new BadRequestException('A location or profile is required');
    }

    const subscription = this.subscriptionRepository.create({
      locationId: input.location?.id ?? null,
      profileId: input.profile?.id ?? null,
      userId: owner.userId,
      planId: input.plan.id,
      product,
      source: input.source,
      notes: input.notes?.trim() || null,
      gatewaySubscriptionId: null,
      cancelledAt: null,
    });

    if (isComplimentary || paymentReceived) {
      await this.assignPaidPeriod(subscription, input.plan, input.startDate);
    } else {
      await this.assertNoBlockingSubscription(subject, product);
      subscription.status = SubscriptionStatus.PENDING_PAYMENT;
      subscription.startDate = null;
      subscription.endDate = null;
    }

    try {
      const saved = await this.subscriptionRepository.save(subscription);
      await this.paymentsService.createForSubscription(saved, input.plan, {
        provider: input.payment?.provider,
        utr: input.payment?.utr,
        notes: input.payment?.notes ?? input.notes,
        status: paymentStatus,
        discountAmount: input.payment?.discountAmount,
      });
      return this.findOneById(saved.id);
    } catch (error) {
      if (error instanceof ConflictException) {
        throw error;
      }
      this.throwIfUniqueViolation(error);
      throw error;
    }
  }

  async activateFromPayment(subscriptionId: string): Promise<Subscription> {
    const subscription = await this.findOneById(subscriptionId);
    if (
      subscription.status === SubscriptionStatus.CANCELLED ||
      subscription.status === SubscriptionStatus.EXPIRED
    ) {
      throw new BadRequestException(
        `Cannot activate a ${subscription.status} subscription`,
      );
    }
    if (
      (subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.QUEUED) &&
      subscription.startDate &&
      subscription.endDate
    ) {
      this.syncExpiredFromDates(subscription);
      await this.subscriptionRepository.save(subscription);
      return this.findOneById(subscriptionId);
    }
    const plan =
      subscription.plan ?? (await this.findPlan(subscription.planId));
    await this.assignPaidPeriod(
      subscription,
      plan,
      subscription.startDate ?? undefined,
    );
    this.assertDateRange(subscription);
    try {
      await this.subscriptionRepository.save(subscription);
    } catch (error) {
      this.throwIfUniqueViolation(error);
      throw error;
    }
    return this.findOneById(subscriptionId);
  }

  private async applyStatus(
    subscription: Subscription,
    status: SubscriptionStatus,
  ): Promise<void> {
    if (status === SubscriptionStatus.ACTIVE) {
      if (!subscription.startDate || !subscription.endDate) {
        const plan =
          subscription.plan ?? (await this.findPlan(subscription.planId));
        this.activate(subscription, plan, subscription.startDate ?? undefined);
      } else {
        subscription.status = SubscriptionStatus.ACTIVE;
        subscription.cancelledAt = null;
        this.syncExpiredFromDates(subscription);
      }
      return;
    }

    if (status === SubscriptionStatus.QUEUED) {
      if (!subscription.startDate || !subscription.endDate) {
        const plan =
          subscription.plan ?? (await this.findPlan(subscription.planId));
        this.queue(subscription, plan, subscription.startDate ?? undefined);
      } else {
        subscription.status = SubscriptionStatus.QUEUED;
        subscription.cancelledAt = null;
        this.syncExpiredFromDates(subscription);
      }
      return;
    }

    if (status === SubscriptionStatus.CANCELLED) {
      subscription.status = SubscriptionStatus.CANCELLED;
      subscription.cancelledAt = new Date();
      return;
    }

    if (status === SubscriptionStatus.EXPIRED) {
      subscription.status = SubscriptionStatus.EXPIRED;
      subscription.cancelledAt = null;
      return;
    }

    subscription.status = SubscriptionStatus.PENDING_PAYMENT;
    subscription.cancelledAt = null;
  }

  private async assignPaidPeriod(
    subscription: Subscription,
    plan: Plan,
    startDate?: string,
  ): Promise<void> {
    const today = todayIst();
    const subject = subjectOf(subscription);
    const live = await this.findLiveForSubject(
      subject,
      subscription.product,
      subscription.id,
    );
    const liveEndDate = live?.endDate ?? null;
    const defaultStart = liveEndDate ? addDaysToIsoDate(liveEndDate, 1) : today;
    const start = startDate ?? defaultStart;

    if (live || start > today) {
      await this.assertNoQueuedSubscription(
        subject,
        subscription.product,
        subscription.id,
      );
      if (liveEndDate && start <= liveEndDate) {
        throw new BadRequestException(
          `startDate must be after the current plan ends (${liveEndDate})`,
        );
      }
      this.queue(subscription, plan, start);
      await this.assertNoOverlappingWindow(subscription);
      return;
    }

    await this.assertNoOpenSubscription(
      subject,
      subscription.product,
      subscription.id,
    );
    this.activate(subscription, plan, start);
    await this.assertNoOverlappingWindow(subscription);
  }

  private activate(
    subscription: Subscription,
    plan: Plan,
    startDate?: string,
  ): void {
    const start = startDate ?? todayIst();
    subscription.status = SubscriptionStatus.ACTIVE;
    subscription.startDate = start;
    subscription.endDate = endDateFromDuration(start, plan.durationDays);
    subscription.cancelledAt = null;
    this.syncExpiredFromDates(subscription);
  }

  private queue(
    subscription: Subscription,
    plan: Plan,
    startDate?: string,
  ): void {
    const start = startDate ?? todayIst();
    subscription.status = SubscriptionStatus.QUEUED;
    subscription.startDate = start;
    subscription.endDate = endDateFromDuration(start, plan.durationDays);
    subscription.cancelledAt = null;
    this.syncExpiredFromDates(subscription);
  }

  private syncExpiredFromDates(subscription: Subscription): void {
    const today = todayIst();
    if (
      (subscription.status === SubscriptionStatus.ACTIVE ||
        subscription.status === SubscriptionStatus.QUEUED) &&
      subscription.endDate &&
      subscription.endDate < today
    ) {
      subscription.status = SubscriptionStatus.EXPIRED;
      return;
    }
    if (
      subscription.status === SubscriptionStatus.QUEUED &&
      subscription.startDate &&
      subscription.startDate <= today &&
      subscription.endDate &&
      subscription.endDate >= today
    ) {
      subscription.status = SubscriptionStatus.ACTIVE;
    }
  }

  private assertDateRange(subscription: Subscription): void {
    if (
      subscription.startDate &&
      subscription.endDate &&
      subscription.endDate < subscription.startDate
    ) {
      throw new BadRequestException('endDate cannot be before startDate');
    }
  }

  private async assertNoBlockingSubscription(
    subject: SubscriptionSubject,
    product: Product,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: {
        ...subjectWhere(subject),
        product,
        status: In([
          SubscriptionStatus.PENDING_PAYMENT,
          SubscriptionStatus.QUEUED,
          SubscriptionStatus.ACTIVE,
        ]),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `This ${subjectLabel(subject)} already has a pending, queued, or active ${productDisplayName(product)} subscription`,
      );
    }
  }

  private async assertNoOpenSubscription(
    subject: SubscriptionSubject,
    product: Product,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: {
        ...subjectWhere(subject),
        product,
        status: In([
          SubscriptionStatus.PENDING_PAYMENT,
          SubscriptionStatus.ACTIVE,
        ]),
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `This ${subjectLabel(subject)} already has a pending or active ${productDisplayName(product)} subscription`,
      );
    }
  }

  private async assertNoQueuedSubscription(
    subject: SubscriptionSubject,
    product: Product,
    excludeId?: string,
  ): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: {
        ...subjectWhere(subject),
        product,
        status: SubscriptionStatus.QUEUED,
        ...(excludeId ? { id: Not(excludeId) } : {}),
      },
    });
    if (existing) {
      throw new ConflictException(
        `This ${subjectLabel(subject)} already has a queued ${productDisplayName(product)} subscription`,
      );
    }
  }

  private async assertNoOverlappingWindow(
    subscription: Subscription,
  ): Promise<void> {
    if (!subscription.startDate || !subscription.endDate) return;

    const overlapping = await this.subscriptionRepository.findOne({
      where: {
        ...subjectWhere(subjectOf(subscription)),
        product: subscription.product,
        status: In([SubscriptionStatus.ACTIVE, SubscriptionStatus.QUEUED]),
        startDate: LessThanOrEqual(subscription.endDate),
        endDate: MoreThanOrEqual(subscription.startDate),
        ...(subscription.id ? { id: Not(subscription.id) } : {}),
      },
    });
    if (overlapping) {
      throw new ConflictException(
        `This ${productDisplayName(subscription.product)} plan overlaps ${overlapping.startDate} to ${overlapping.endDate}`,
      );
    }
  }

  private async findLiveForSubject(
    subject: SubscriptionSubject,
    product: Product,
    excludeId?: string,
  ): Promise<Subscription | null> {
    const today = todayIst();
    const exclude = excludeId ? { id: Not(excludeId) } : {};
    const scope = subjectWhere(subject);
    return this.subscriptionRepository.findOne({
      where: [
        {
          ...scope,
          product,
          status: SubscriptionStatus.ACTIVE,
          endDate: MoreThanOrEqual(today),
          startDate: LessThanOrEqual(today),
          ...exclude,
        },
        {
          ...scope,
          product,
          status: SubscriptionStatus.ACTIVE,
          endDate: MoreThanOrEqual(today),
          startDate: IsNull(),
          ...exclude,
        },
        {
          ...scope,
          product,
          status: SubscriptionStatus.QUEUED,
          endDate: MoreThanOrEqual(today),
          startDate: LessThanOrEqual(today),
          ...exclude,
        },
      ],
    });
  }

  private async expireOverdue(filter: {
    locationId?: string;
    profileId?: string;
    userId?: string;
  }): Promise<void> {
    const today = todayIst();

    const expireQb = this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({ status: SubscriptionStatus.EXPIRED })
      .where('status IN (:...expireStatuses)', {
        expireStatuses: [SubscriptionStatus.ACTIVE, SubscriptionStatus.QUEUED],
      })
      .andWhere('"endDate" < :today', { today });

    if (filter.locationId) {
      expireQb.andWhere('"locationId" = :locationId', {
        locationId: filter.locationId,
      });
    }
    if (filter.profileId) {
      expireQb.andWhere('"profileId" = :profileId', {
        profileId: filter.profileId,
      });
    }
    if (filter.userId) {
      expireQb.andWhere('"userId" = :userId', { userId: filter.userId });
    }

    await expireQb.execute();

    const promoteQb = this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({ status: SubscriptionStatus.ACTIVE })
      .where('status = :queued', { queued: SubscriptionStatus.QUEUED })
      .andWhere('"startDate" <= :today', { today })
      .andWhere('"endDate" >= :today', { today })
      .andWhere(
        `NOT EXISTS (
          SELECT 1 FROM subscriptions other
          WHERE other.product = subscriptions.product
            AND other.status = :activeStatus
            AND other.id <> subscriptions.id
            AND (
              (subscriptions."locationId" IS NOT NULL AND other."locationId" = subscriptions."locationId")
              OR (subscriptions."profileId" IS NOT NULL AND other."profileId" = subscriptions."profileId")
            )
        )`,
        { activeStatus: SubscriptionStatus.ACTIVE },
      );

    if (filter.locationId) {
      promoteQb.andWhere('"locationId" = :locationId', {
        locationId: filter.locationId,
      });
    }
    if (filter.profileId) {
      promoteQb.andWhere('"profileId" = :profileId', {
        profileId: filter.profileId,
      });
    }
    if (filter.userId) {
      promoteQb.andWhere('"userId" = :userId', { userId: filter.userId });
    }

    await promoteQb.execute();
  }

  private async expireIfOverdue(subscription: Subscription): Promise<void> {
    const before = subscription.status;
    this.syncExpiredFromDates(subscription);
    if (subscription.status === before) {
      return;
    }
    await this.subscriptionRepository.save(subscription);
  }

  private async paginate(
    where: FindOptionsWhere<Subscription>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.subscriptionRepository
      .createQueryBuilder('subscription')
      .leftJoin('subscription.plan', 'plan')
      .addSelect([
        'plan.id',
        'plan.code',
        'plan.name',
        'plan.amount',
        'plan.currency',
        'plan.product',
      ])
      .leftJoin('subscription.location', 'location')
      .addSelect(['location.id', 'location.name'])
      .leftJoin('subscription.profile', 'profile')
      .addSelect(['profile.id', 'profile.displayName'])
      .setFindOptions({ where })
      .orderBy('subscription.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  private async findOneById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { plan: true, location: true, profile: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }
    return subscription;
  }

  private async findLocation(
    locationId: string,
    userId?: string,
  ): Promise<Location> {
    const location = await this.locationRepository.findOne({
      where: userId ? { id: locationId, userId } : { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }
    return location;
  }

  private async findProfile(
    profileId: string,
    userId?: string,
  ): Promise<Profile> {
    const profile = await this.profileRepository.findOne({
      where: userId ? { id: profileId, userId } : { id: profileId },
    });
    if (!profile) {
      throw new NotFoundException(`Profile with id "${profileId}" not found`);
    }
    return profile;
  }

  private async resolveCreateTarget(
    dto: { locationId?: string; profileId?: string },
    userId?: string,
  ): Promise<{ location?: Location; profile?: Profile }> {
    if (dto.locationId && dto.profileId) {
      throw new BadRequestException('Provide a location or a profile, not both');
    }
    if (dto.profileId) {
      return { profile: await this.findProfile(dto.profileId, userId) };
    }
    if (dto.locationId) {
      return { location: await this.findLocation(dto.locationId, userId) };
    }
    throw new BadRequestException('A location or profile is required');
  }

  private assertPlanSubject(
    product: Product,
    location?: Location,
    profile?: Profile,
  ): SubscriptionSubject {
    if (productSubject(product) === 'profile') {
      if (!profile || location) {
        throw new BadRequestException(
          `${productDisplayName(product)} plans are assigned to a profile`,
        );
      }
      return { profileId: profile.id };
    }
    if (!location || profile) {
      throw new BadRequestException(
        `${productDisplayName(product)} plans are assigned to a location`,
      );
    }
    return { locationId: location.id };
  }

  private async findPlan(planId: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException(`Plan with id "${planId}" not found`);
    }
    return plan;
  }

  private toInvoicePayload(
    subscription: Subscription,
    payment: Payment | null,
  ): InvoicePayload {
    const plan = subscription.plan;
    const location = subscription.location;
    const profile = subscription.profile;
    const amount = payment?.amount ?? plan?.amount ?? 0;
    const currency = payment?.currency ?? plan?.currency ?? 'INR';
    const issuedAt =
      payment?.succeededAt ??
      payment?.createdAt ??
      subscription.startDate ??
      subscription.createdAt;

    return {
      invoiceNumber: `INV-${payment?.id ?? subscription.id}`,
      issuedAtLabel: formatInvoiceDate(issuedAt),
      billToName: location?.name ?? profile?.displayName ?? 'Business',
      billToLines: billToLines(subscription),
      planName: plan?.name ?? 'Subscription',
      productName: productDisplayName(subscription.product),
      periodLabel: formatPeriod(subscription.startDate, subscription.endDate),
      amountLabel: formatInvoiceAmount(amount, currency),
      paymentStatusLabel: paymentStatusLabel(
        payment,
        amount,
        subscription.status,
      ),
      paymentProviderLabel: formatProvider(payment?.provider ?? null),
      utr: payment?.utr ?? null,
      paymentId: payment?.id ?? null,
      subscriptionId: subscription.id,
      locationName: location?.name ?? profile?.displayName ?? '-',
    };
  }

  private throwIfUniqueViolation(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException(
        'This location or profile already has a pending, queued, or active subscription for this product',
      );
    }
  }

  private async backfillSubscriptionProducts(): Promise<void> {
    await this.subscriptionRepository.query(`
      UPDATE subscriptions s
      SET product = p.product
      FROM plans p
      WHERE s."planId" = p.id
        AND s.product IS DISTINCT FROM p.product
    `);
  }

  private async dropLegacyOpenSubscriptionIndex(): Promise<void> {
    const rows: Array<{ indexname: string; indexdef: string }> = await this
      .subscriptionRepository.query(`
        SELECT indexname, indexdef
        FROM pg_indexes
        WHERE tablename = 'subscriptions'
          AND indexdef ILIKE '%UNIQUE%'
          AND indexname <> 'subscriptions_pkey'
          AND indexname <> 'UQ_subscriptions_open_location_product'
      `);

    for (const row of rows) {
      const def = row.indexdef.toLowerCase();
      if (!def.includes('locationid') || def.includes('product')) continue;
      await this.subscriptionRepository.query(
        `DROP INDEX IF EXISTS "${row.indexname}"`,
      );
    }
  }
}

type SubscriptionSubject = {
  locationId?: string;
  profileId?: string;
};

function subjectOf(
  subscription: Pick<Subscription, 'locationId' | 'profileId'>,
): SubscriptionSubject {
  if (subscription.profileId) return { profileId: subscription.profileId };
  if (subscription.locationId) return { locationId: subscription.locationId };
  return {};
}

function subjectWhere(
  subject: SubscriptionSubject,
): FindOptionsWhere<Subscription> {
  if (subject.profileId) return { profileId: subject.profileId };
  return { locationId: subject.locationId };
}

function subjectLabel(subject: SubscriptionSubject): string {
  return subject.profileId ? 'profile' : 'location';
}

function invoiceFileSlug(product: Product | string | null | undefined): string {
  if (product === Product.EASY_MENU) return 'easymenu';
  if (product === Product.EASY_STORY) return 'easystory';
  if (product === Product.EASY_PROFILE) return 'easyprofile';
  return 'easyreview';
}

function formatInvoiceDate(value: Date | string | null | undefined): string {
  if (!value) return '-';
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const [year, month, day] = value.split('-').map(Number);
    return new Date(Date.UTC(year, month - 1, day)).toLocaleDateString(
      'en-IN',
      {
        day: 'numeric',
        month: 'short',
        year: 'numeric',
        timeZone: 'UTC',
      },
    );
  }
  const date = value instanceof Date ? value : new Date(value);
  if (Number.isNaN(date.getTime())) return '-';
  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    timeZone: 'Asia/Kolkata',
  });
}

function formatPeriod(start: string | null, end: string | null): string {
  if (!start && !end) return '-';
  return `${formatInvoiceDate(start)} - ${formatInvoiceDate(end)}`;
}

function formatInvoiceAmount(amount: number, currency: string): string {
  if (amount === 0) return 'Free';
  const formatted = amount.toLocaleString('en-IN');
  if (currency === 'INR') return `Rs. ${formatted}`;
  return `${currency} ${formatted}`;
}

function formatProvider(provider: string | null): string | null {
  if (!provider) return null;
  return provider.replaceAll('_', ' ').toUpperCase();
}

function paymentStatusLabel(
  payment: Payment | null,
  amount: number,
  subscriptionStatus: SubscriptionStatus,
): string {
  if (payment?.status === PaymentStatus.SUCCESS) {
    return amount === 0 ? 'Complimentary' : 'Paid';
  }
  if (payment?.status === PaymentStatus.PENDING) return 'Unpaid';
  if (payment?.status === PaymentStatus.REFUNDED) return 'Refunded';
  if (payment?.status === PaymentStatus.FAILED) return 'Failed';
  if (amount === 0) return 'Complimentary';
  if (subscriptionStatus === SubscriptionStatus.PENDING_PAYMENT)
    return 'Unpaid';
  return 'Paid';
}

function billToLines(subscription: Subscription): string[] {
  const location = subscription.location;
  const profile = subscription.profile;
  const user = subscription.user;
  const lines: string[] = [];
  if (user?.name) lines.push(user.name);
  if (user?.email) lines.push(user.email);
  if (location?.formattedAddress) {
    lines.push(location.formattedAddress);
  } else {
    const parts = [
      location?.addressLine1,
      location?.city,
      location?.state,
      location?.pincode,
      location?.country,
    ].filter((part): part is string => Boolean(part));
    if (parts.length > 0) lines.push(parts.join(', '));
  }
  if (location?.phoneNumber) lines.push(location.phoneNumber);
  if (!location && profile?.phone) lines.push(profile.phone);
  if (!location && profile?.email) lines.push(profile.email);
  return lines;
}
