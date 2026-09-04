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
import { Order } from '../orders/entities/order.entity';
import { OrderStatus } from '../orders/enums/order-status.enum';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import { istThisAndLastMonth } from '../subscriptions/utils/ist-date.util';
import { CreatePaymentDto } from './dto/create-payment.dto';
import { HqPaymentSummaryDto } from './dto/hq-payment-summary.dto';
import { HqPaymentsQueryDto } from './dto/hq-payments-query.dto';
import { MarkPaymentSuccessDto } from './dto/mark-payment-success.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentKind } from './enums/payment-kind.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './enums/payment-status.enum';

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class PaymentsService {
  constructor(
    @InjectRepository(Payment)
    private readonly paymentRepository: Repository<Payment>,
    @InjectRepository(Subscription)
    private readonly subscriptionRepository: Repository<Subscription>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @Inject(forwardRef(() => SubscriptionsService))
    private readonly subscriptionsService: SubscriptionsService,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async findAllForUser(
    query: PaymentsQueryDto,
  ): Promise<PaginatedResponseDto<Payment>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const { page = 1, limit = 10, locationId, kind, status } = query;
    const where: FindOptionsWhere<Payment> = { userId };
    if (locationId) where.locationId = locationId;
    if (kind) where.kind = kind;
    if (status) where.status = status;
    return this.paginate(where, page, limit);
  }

  async findOneForUser(id: string): Promise<Payment> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const payment = await this.paymentRepository.findOne({
      where: { id, userId },
      relations: { subscription: true, order: true, plan: true },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return payment;
  }

  async findLatestForSubscription(
    subscriptionId: string,
    userId: string,
  ): Promise<Payment | null> {
    const payments = await this.paymentRepository.find({
      where: {
        subscriptionId,
        userId,
        kind: PaymentKind.SUBSCRIPTION,
      },
      order: { createdAt: 'DESC' },
    });
    return (
      payments.find((payment) => payment.status === PaymentStatus.SUCCESS) ??
      payments[0] ??
      null
    );
  }

  async submitForUser(id: string, dto: SubmitPaymentDto): Promise<Payment> {
    const payment = await this.findOneForUser(id);
    if (payment.status !== PaymentStatus.PENDING) {
      throw new BadRequestException('Only pending payments can be updated');
    }
    if (dto.utr !== undefined) payment.utr = dto.utr;
    if (dto.notes !== undefined) payment.notes = dto.notes;
    await this.paymentRepository.save(payment);
    return this.findOneForUser(id);
  }

  async findAllForHq(
    query: HqPaymentsQueryDto,
  ): Promise<PaginatedResponseDto<Payment>> {
    const {
      page = 1,
      limit = 10,
      kind,
      status,
      provider,
      search,
      excludeZeroAmount,
      locationId,
      userId,
      subscriptionId,
      orderId,
    } = query;
    const qb = this.paymentRepository
      .createQueryBuilder('payment')
      .leftJoinAndSelect('payment.plan', 'plan')
      .leftJoinAndSelect('payment.order', 'order')
      .leftJoinAndSelect('payment.subscription', 'subscription')
      .leftJoinAndSelect('payment.location', 'location')
      .orderBy('payment.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (kind) qb.andWhere('payment.kind = :kind', { kind });
    if (status) qb.andWhere('payment.status = :status', { status });
    if (provider) qb.andWhere('payment.provider = :provider', { provider });
    if (locationId) {
      qb.andWhere('payment.locationId = :locationId', { locationId });
    }
    if (userId) qb.andWhere('payment.userId = :userId', { userId });
    if (subscriptionId) {
      qb.andWhere('payment.subscriptionId = :subscriptionId', {
        subscriptionId,
      });
    }
    if (orderId) qb.andWhere('payment.orderId = :orderId', { orderId });
    if (excludeZeroAmount) {
      qb.andWhere('payment.amount > 0');
    }
    const term = search?.trim();
    if (term) {
      qb.andWhere(
        `(
          payment.id ILIKE :term
          OR COALESCE(payment.utr, '') ILIKE :term
          OR COALESCE(location.name, '') ILIKE :term
          OR COALESCE(order.businessNameSnapshot, '') ILIKE :term
        )`,
        { term: `%${term}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findSummaryForHq(): Promise<HqPaymentSummaryDto> {
    const { thisMonth, lastMonth } = istThisAndLastMonth();
    const periodParams = {
      thisStart: thisMonth.startUtc,
      thisEnd: thisMonth.endExclusiveUtc,
      lastStart: lastMonth.startUtc,
      lastEnd: lastMonth.endExclusiveUtc,
    };
    const [raw, subscriptionRaw] = await Promise.all([
      this.paymentRepository
        .createQueryBuilder('payment')
        .select(
          `COALESCE(SUM(CASE WHEN payment.status = :success THEN payment.amount ELSE 0 END), 0)`,
          'lifetimeAmount',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN payment.status = :success AND payment.succeededAt >= :thisStart AND payment.succeededAt < :thisEnd THEN payment.amount ELSE 0 END), 0)`,
          'thisMonthAmount',
        )
        .addSelect(
          `COALESCE(SUM(CASE WHEN payment.status = :success AND payment.succeededAt >= :lastStart AND payment.succeededAt < :lastEnd THEN payment.amount ELSE 0 END), 0)`,
          'lastMonthAmount',
        )
        .setParameters({
          success: PaymentStatus.SUCCESS,
          ...periodParams,
        })
        .getRawOne<{
          lifetimeAmount: string | number;
          thisMonthAmount: string | number;
          lastMonthAmount: string | number;
        }>(),
      this.subscriptionRepository
        .createQueryBuilder('subscription')
        .where(
          `EXISTS (
            SELECT 1 FROM payments paid
            WHERE paid."subscriptionId" = subscription.id
              AND paid.status = :success
              AND paid.amount > 0
          )`,
        )
        .select('COUNT(*)', 'lifetimeCount')
        .addSelect(
          `COUNT(CASE WHEN subscription.createdAt >= :thisStart AND subscription.createdAt < :thisEnd THEN 1 END)`,
          'thisMonthCount',
        )
        .addSelect(
          `COUNT(CASE WHEN subscription.createdAt >= :lastStart AND subscription.createdAt < :lastEnd THEN 1 END)`,
          'lastMonthCount',
        )
        .setParameters({
          success: PaymentStatus.SUCCESS,
          ...periodParams,
        })
        .getRawOne<{
          lifetimeCount: string | number;
          thisMonthCount: string | number;
          lastMonthCount: string | number;
        }>(),
    ]);

    return new HqPaymentSummaryDto({
      currency: 'INR',
      lifetime: {
        amount: toCount(raw?.lifetimeAmount),
        subscriptionCount: toCount(subscriptionRaw?.lifetimeCount),
      },
      thisMonth: {
        amount: toCount(raw?.thisMonthAmount),
        subscriptionCount: toCount(subscriptionRaw?.thisMonthCount),
        from: thisMonth.from,
        to: thisMonth.to,
      },
      lastMonth: {
        amount: toCount(raw?.lastMonthAmount),
        subscriptionCount: toCount(subscriptionRaw?.lastMonthCount),
        from: lastMonth.from,
        to: lastMonth.to,
      },
    });
  }

  async findOneForHq(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: {
        subscription: true,
        order: true,
        plan: true,
        location: true,
        user: true,
      },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return payment;
  }

  async createForHq(dto: CreatePaymentDto): Promise<Payment> {
    if (dto.kind === PaymentKind.SUBSCRIPTION) {
      if (!dto.subscriptionId) {
        throw new BadRequestException('subscriptionId is required');
      }
      const subscription = await this.subscriptionRepository.findOne({
        where: { id: dto.subscriptionId },
        relations: { plan: true },
      });
      if (!subscription) {
        throw new NotFoundException(
          `Subscription with id "${dto.subscriptionId}" not found`,
        );
      }
      const plan = subscription.plan;
      if (!plan) {
        throw new NotFoundException(
          `Plan with id "${subscription.planId}" not found`,
        );
      }
      return this.createForSubscription(subscription, plan, {
        provider: dto.provider,
        utr: dto.utr,
        notes: dto.notes,
      });
    }

    if (!dto.orderId) {
      throw new BadRequestException('orderId is required');
    }
    const order = await this.orderRepository.findOne({
      where: { id: dto.orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with id "${dto.orderId}" not found`);
    }
    return this.createForOrder(order, {
      provider: dto.provider,
      utr: dto.utr,
      notes: dto.notes,
    });
  }

  async createForSubscription(
    subscription: Subscription,
    plan: Plan,
    extras: {
      provider?: PaymentProvider | null;
      utr?: string;
      notes?: string | null;
      status?: PaymentStatus;
      discountAmount?: number;
    } = {},
  ): Promise<Payment> {
    const discountAmount = extras.discountAmount ?? 0;
    if (discountAmount > plan.amount) {
      throw new BadRequestException(
        'discountAmount cannot be greater than the plan amount',
      );
    }
    const chargedAmount = plan.amount - discountAmount;
    const isComplimentary = plan.amount === 0;
    const provider =
      extras.provider !== undefined
        ? extras.provider
        : isComplimentary
          ? PaymentProvider.CASH
          : PaymentProvider.UPI;
    const status = isComplimentary
      ? PaymentStatus.SUCCESS
      : (extras.status ?? PaymentStatus.PENDING);

    const payment = await this.insertPayment({
      kind: PaymentKind.SUBSCRIPTION,
      subscriptionId: subscription.id,
      orderId: null,
      planId: plan.id,
      locationId: subscription.locationId,
      userId: subscription.userId,
      amount: chargedAmount,
      discountAmount,
      currency: plan.currency,
      status,
      provider,
      utr: extras.utr ?? null,
      notes: extras.notes?.trim() || null,
      succeededAt: status === PaymentStatus.SUCCESS ? new Date() : null,
    });

    if (status === PaymentStatus.SUCCESS) {
      await this.subscriptionsService.activateFromPayment(subscription.id);
    }

    return payment;
  }

  async createForOrder(
    order: Order,
    extras: {
      provider?: PaymentProvider | null;
      utr?: string;
      notes?: string | null;
    } = {},
  ): Promise<Payment> {
    const isComplimentary = order.amountInr === 0;
    const provider =
      extras.provider !== undefined
        ? extras.provider
        : isComplimentary
          ? PaymentProvider.CASH
          : PaymentProvider.UPI;
    const status = isComplimentary
      ? PaymentStatus.SUCCESS
      : PaymentStatus.PENDING;

    const payment = await this.insertPayment({
      kind: PaymentKind.ORDER,
      subscriptionId: null,
      orderId: order.id,
      planId: null,
      locationId: order.locationId,
      userId: order.userId,
      amount: order.amountInr,
      discountAmount: 0,
      currency: 'INR',
      status,
      provider,
      utr: extras.utr ?? null,
      notes: extras.notes?.trim() || null,
      succeededAt: status === PaymentStatus.SUCCESS ? new Date() : null,
    });

    if (status === PaymentStatus.SUCCESS) {
      await this.confirmOrderIfPlaced(order.id);
    }

    return payment;
  }

  async updateForHq(id: string, dto: UpdatePaymentDto): Promise<Payment> {
    const payment = await this.findOneForHq(id);

    if (dto.provider !== undefined) payment.provider = dto.provider;
    if (dto.utr !== undefined) payment.utr = dto.utr;
    if (dto.notes !== undefined) payment.notes = dto.notes;
    if (dto.gatewayOrderId !== undefined) {
      payment.gatewayOrderId = dto.gatewayOrderId;
    }
    if (dto.gatewayPaymentId !== undefined) {
      payment.gatewayPaymentId = dto.gatewayPaymentId;
    }
    if (dto.discountAmount !== undefined) {
      this.applyDiscount(payment, dto.discountAmount);
    }

    if (
      dto.status === PaymentStatus.SUCCESS &&
      payment.status !== PaymentStatus.SUCCESS
    ) {
      return this.markSuccess(payment, { utr: dto.utr ?? undefined });
    }

    if (dto.status !== undefined) {
      payment.status = dto.status;
      payment.succeededAt = null;
    }

    await this.paymentRepository.save(payment);
    return this.findOneForHq(id);
  }

  async markSuccessForHq(
    id: string,
    dto: MarkPaymentSuccessDto,
  ): Promise<Payment> {
    const payment = await this.findOneForHq(id);
    return this.markSuccess(payment, dto);
  }

  /**
   * HQ confirmed (or otherwise progressed) a placed order: treat the matching
   * order payment as received. Creates a payment if the order never had one.
   */
  async settleForConfirmedOrder(order: Order): Promise<Payment> {
    const pending = await this.paymentRepository.findOne({
      where: {
        orderId: order.id,
        kind: PaymentKind.ORDER,
        status: PaymentStatus.PENDING,
      },
      order: { createdAt: 'DESC' },
    });
    if (pending) {
      return this.markSuccess(pending, {});
    }

    const existing = await this.paymentRepository.findOne({
      where: { orderId: order.id, kind: PaymentKind.ORDER },
      order: { createdAt: 'DESC' },
    });
    if (existing) {
      return this.findOneForHq(existing.id);
    }

    const created = await this.createForOrder(order);
    if (created.status === PaymentStatus.PENDING) {
      return this.markSuccess(created, {});
    }
    return created;
  }

  /**
   * Apply a discount against a known list price. Works for subscription and
   * order payments. Creates an order payment if the order has none yet.
   */
  async applyDiscountForOrder(
    order: Order,
    discountAmount: number,
    listAmount: number,
  ): Promise<Payment> {
    if (discountAmount > listAmount) {
      throw new BadRequestException(
        'discountAmount cannot be greater than the order amount',
      );
    }
    const existing = await this.paymentRepository.findOne({
      where: { orderId: order.id, kind: PaymentKind.ORDER },
      order: { createdAt: 'DESC' },
    });
    const payment = existing ?? (await this.createForOrder(order));
    payment.discountAmount = discountAmount;
    payment.amount = listAmount - discountAmount;
    await this.paymentRepository.save(payment);
    return this.findOneForHq(payment.id);
  }

  /**
   * Hard-deletes order payments so HQ can remove an order and its collection
   * record together, including a successful payment.
   */
  async removeForOrder(orderId: string): Promise<void> {
    await this.paymentRepository.delete({
      orderId,
      kind: PaymentKind.ORDER,
    });
  }

  async removeForHq(id: string): Promise<Payment> {
    const payment = await this.findOneForHq(id);
    if (payment.status === PaymentStatus.SUCCESS) {
      throw new BadRequestException('Successful payments cannot be deleted');
    }
    await this.paymentRepository.delete(id);
    return payment;
  }

  private async markSuccess(
    payment: Payment,
    dto: MarkPaymentSuccessDto,
  ): Promise<Payment> {
    if (payment.status === PaymentStatus.SUCCESS) {
      return payment;
    }
    if (
      payment.status === PaymentStatus.REFUNDED ||
      payment.status === PaymentStatus.FAILED
    ) {
      throw new BadRequestException(
        `Cannot mark a ${payment.status} payment as success`,
      );
    }

    payment.status = PaymentStatus.SUCCESS;
    payment.succeededAt = new Date();
    if (dto.utr !== undefined) payment.utr = dto.utr.trim();
    if (dto.notes !== undefined) payment.notes = dto.notes.trim() || null;
    await this.paymentRepository.save(payment);

    if (payment.kind === PaymentKind.SUBSCRIPTION && payment.subscriptionId) {
      await this.subscriptionsService.activateFromPayment(
        payment.subscriptionId,
      );
    }
    if (payment.kind === PaymentKind.ORDER && payment.orderId) {
      await this.confirmOrderIfPlaced(payment.orderId);
    }

    return this.findOneForHq(payment.id);
  }

  private applyDiscount(payment: Payment, discountAmount: number): void {
    if (payment.kind !== PaymentKind.SUBSCRIPTION) {
      throw new BadRequestException(
        'Discounts can only be applied to subscription payments',
      );
    }
    const listAmount = payment.plan?.amount;
    if (listAmount == null) {
      throw new BadRequestException(
        'This payment has no plan to calculate a discount against',
      );
    }
    if (discountAmount > listAmount) {
      throw new BadRequestException(
        'discountAmount cannot be greater than the plan amount',
      );
    }
    payment.discountAmount = discountAmount;
    payment.amount = listAmount - discountAmount;
  }

  private async confirmOrderIfPlaced(orderId: string): Promise<void> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with id "${orderId}" not found`);
    }
    if (order.status === OrderStatus.PLACED) {
      order.status = OrderStatus.CONFIRMED;
      await this.orderRepository.save(order);
    }
  }

  private async insertPayment(data: Partial<Payment>): Promise<Payment> {
    try {
      const saved = await this.paymentRepository.save(
        this.paymentRepository.create(data),
      );
      return this.findOneById(saved.id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'A pending payment already exists for this purchase',
        );
      }
      throw error;
    }
  }

  private async paginate(
    where: FindOptionsWhere<Payment>,
    page: number,
    limit: number,
  ): Promise<PaginatedResponseDto<Payment>> {
    const skip = (page - 1) * limit;
    const [data, total] = await this.paymentRepository.findAndCount({
      where,
      relations: { plan: true, order: true, subscription: true },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  private async findOneById(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: { subscription: true, order: true, plan: true },
    });
    if (!payment) {
      throw new NotFoundException(`Payment with id "${id}" not found`);
    }
    return payment;
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
