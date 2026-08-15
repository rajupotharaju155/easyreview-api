import {
  BadRequestException,
  ConflictException,
  Inject,
  Injectable,
  NotFoundException,
  forwardRef,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { PaymentProvider } from '../payments/enums/payment-provider.enum';
import { PaymentStatus } from '../payments/enums/payment-status.enum';
import { PaymentsService } from '../payments/payments.service';
import { Plan } from '../plans/entities/plan.entity';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { HqCreateSubscriptionDto } from './dto/hq-create-subscription.dto';
import { HqSubscriptionsQueryDto } from './dto/hq-subscriptions-query.dto';
import { SubscriptionsQueryDto } from './dto/subscriptions-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionSource } from './enums/subscription-source.enum';
import { SubscriptionStatus } from './enums/subscription-status.enum';
import { endDateFromDuration, todayIst } from './utils/ist-date.util';

@Injectable()
export class SubscriptionsService {
  constructor(
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    @Inject(forwardRef(() => PaymentsService))
    private readonly paymentsService: PaymentsService,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async findAllForUser(
    query: SubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    await this.expireOverdue({ userId });

    const { page = 1, limit = 10, locationId } = query;
    const where: FindOptionsWhere<Subscription> = { userId };
    if (locationId) {
      where.locationId = locationId;
    }

    return this.paginate(where, page, limit);
  }

  async findOneForUser(id: string): Promise<Subscription> {
    const userId = this.currentUserUtil.getCurrentUserId();
    await this.expireOverdue({ userId });

    const subscription = await this.subscriptionRepository.findOne({
      where: { id, userId },
      relations: { plan: true, location: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }
    return subscription;
  }

  async createForUser(dto: CreateSubscriptionDto): Promise<Subscription> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.findLocation(dto.locationId, userId);
    const plan = await this.findPlan(dto.planId);

    if (plan.amount === 0) {
      throw new BadRequestException(
        'This plan can only be assigned by EasyReview',
      );
    }

    return this.createSubscription({
      location,
      plan,
      source: SubscriptionSource.SELF_SERVE,
      notes: dto.notes,
      startDate: dto.startDate,
    });
  }

  async findAllForHq(
    query: HqSubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const { page = 1, limit = 10, locationId, userId, planId, status } = query;
    await this.expireOverdue({ locationId, userId });

    const where: FindOptionsWhere<Subscription> = {};
    if (locationId) where.locationId = locationId;
    if (userId) where.userId = userId;
    if (planId) where.planId = planId;
    if (status) where.status = status;

    return this.paginate(where, page, limit);
  }

  async findOneForHq(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { plan: true, location: true },
    });
    if (!subscription) {
      throw new NotFoundException(`Subscription with id "${id}" not found`);
    }
    await this.expireIfOverdue(subscription);
    return subscription;
  }

  async createForHq(dto: HqCreateSubscriptionDto): Promise<Subscription> {
    const location = await this.findLocation(dto.locationId);
    const plan = await this.findPlan(dto.planId);

    return this.createSubscription({
      location,
      plan,
      source: SubscriptionSource.HQ,
      notes: dto.notes,
      startDate: dto.startDate,
      payment: {
        provider: dto.paymentProvider,
        utr: dto.utr,
        notes: dto.paymentNotes,
        status: dto.paymentStatus ?? PaymentStatus.SUCCESS,
      },
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
      return await this.subscriptionRepository.save(subscription);
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
    location: Location;
    plan: Plan;
    source: SubscriptionSource;
    notes?: string;
    startDate?: string;
    payment?: {
      provider?: PaymentProvider;
      utr?: string;
      notes?: string | null;
      status?: PaymentStatus;
    };
  }): Promise<Subscription> {
    if (!input.plan.isActive) {
      throw new BadRequestException(`Plan "${input.plan.code}" is not active`);
    }

    await this.expireOverdue({ locationId: input.location.id });
    await this.assertNoOpenSubscription(input.location.id);

    const isComplimentary = input.plan.amount === 0;
    const paymentStatus = isComplimentary
      ? PaymentStatus.SUCCESS
      : (input.payment?.status ?? PaymentStatus.PENDING);
    const paymentReceived = paymentStatus === PaymentStatus.SUCCESS;

    const subscription = this.subscriptionRepository.create({
      locationId: input.location.id,
      userId: input.location.userId,
      planId: input.plan.id,
      source: input.source,
      notes: input.notes?.trim() || null,
      gatewaySubscriptionId: null,
      cancelledAt: null,
    });

    if (isComplimentary || paymentReceived) {
      this.activate(subscription, input.plan, input.startDate);
    } else {
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
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.startDate &&
      subscription.endDate
    ) {
      return subscription;
    }
    const plan =
      subscription.plan ?? (await this.findPlan(subscription.planId));
    this.activate(subscription, plan, subscription.startDate ?? undefined);
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

  private syncExpiredFromDates(subscription: Subscription): void {
    if (
      subscription.status === SubscriptionStatus.ACTIVE &&
      subscription.endDate &&
      subscription.endDate < todayIst()
    ) {
      subscription.status = SubscriptionStatus.EXPIRED;
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

  private async assertNoOpenSubscription(locationId: string): Promise<void> {
    const existing = await this.subscriptionRepository.findOne({
      where: [
        { locationId, status: SubscriptionStatus.PENDING_PAYMENT },
        { locationId, status: SubscriptionStatus.ACTIVE },
      ],
    });
    if (existing) {
      throw new ConflictException(
        'This location already has a pending or active subscription',
      );
    }
  }

  private async expireOverdue(filter: {
    locationId?: string;
    userId?: string;
  }): Promise<void> {
    const qb = this.subscriptionRepository
      .createQueryBuilder()
      .update(Subscription)
      .set({ status: SubscriptionStatus.EXPIRED })
      .where('status = :status', { status: SubscriptionStatus.ACTIVE })
      .andWhere('"endDate" < :today', { today: todayIst() });

    if (filter.locationId) {
      qb.andWhere('"locationId" = :locationId', {
        locationId: filter.locationId,
      });
    }
    if (filter.userId) {
      qb.andWhere('"userId" = :userId', { userId: filter.userId });
    }

    await qb.execute();
  }

  private async expireIfOverdue(subscription: Subscription): Promise<void> {
    if (
      subscription.status !== SubscriptionStatus.ACTIVE ||
      !subscription.endDate ||
      subscription.endDate >= todayIst()
    ) {
      return;
    }
    subscription.status = SubscriptionStatus.EXPIRED;
    await this.subscriptionRepository.save(subscription);
  }

  private async paginate(
    where: FindOptionsWhere<Subscription>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<Subscription>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.subscriptionRepository.findAndCount({
      where,
      relations: { plan: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  private async findOneById(id: string): Promise<Subscription> {
    const subscription = await this.subscriptionRepository.findOne({
      where: { id },
      relations: { plan: true, location: true },
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

  private async findPlan(planId: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id: planId } });
    if (!plan) {
      throw new NotFoundException(`Plan with id "${planId}" not found`);
    }
    return plan;
  }

  private throwIfUniqueViolation(error: unknown): void {
    if (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    ) {
      throw new ConflictException(
        'This location already has a pending or active subscription',
      );
    }
  }
}
