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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { HqPaymentsQueryDto } from './dto/hq-payments-query.dto';
import { MarkPaymentSuccessDto } from './dto/mark-payment-success.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentKind } from './enums/payment-kind.enum';
import { PaymentProvider } from './enums/payment-provider.enum';
import { PaymentStatus } from './enums/payment-status.enum';

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
      locationId,
      userId,
      subscriptionId,
      orderId,
    } = query;
    const where: FindOptionsWhere<Payment> = {};
    if (kind) where.kind = kind;
    if (status) where.status = status;
    if (locationId) where.locationId = locationId;
    if (userId) where.userId = userId;
    if (subscriptionId) where.subscriptionId = subscriptionId;
    if (orderId) where.orderId = orderId;
    return this.paginate(where, page, limit);
  }

  async findOneForHq(id: string): Promise<Payment> {
    const payment = await this.paymentRepository.findOne({
      where: { id },
      relations: {
        subscription: true,
        order: true,
        plan: true,
        location: true,
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
    } = {},
  ): Promise<Payment> {
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
      amount: plan.amount,
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

    if (dto.status === PaymentStatus.SUCCESS) {
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
