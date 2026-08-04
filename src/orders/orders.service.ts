import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { EmailService } from '../email/email.service';
import type { OrderConfirmationEmailDetails } from '../email/templates/email.templates';
import { Location } from '../locations/entities/location.entity';
import {
  STANDEE_DESIGNS,
  STANDEE_PRICE_INR,
} from './constants/standee.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { DeliveryTo } from './enums/delivery-to.enum';
import { OrderStatus } from './enums/order-status.enum';

function formatOrderPlacedAtIst(value?: Date | string | null): string {
  const date =
    value instanceof Date
      ? value
      : value != null
        ? new Date(value)
        : new Date();
  const safeDate = Number.isNaN(date.getTime()) ? new Date() : date;
  const formatted = new Intl.DateTimeFormat('en-IN', {
    timeZone: 'Asia/Kolkata',
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true,
  }).format(safeDate);
  return `${formatted} IST`;
}

@Injectable()
export class OrdersService {
  private readonly logger = new Logger(OrdersService.name);

  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly emailService: EmailService,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const user = this.currentUserUtil.getCurrentUser();
    const location = await this.locationRepository.findOne({
      where: { id: createOrderDto.locationId, userId: user.id },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with id "${createOrderDto.locationId}" not found`,
      );
    }
    const design = STANDEE_DESIGNS[createOrderDto.designVariant];
    const deliveryAddress = this.resolveDeliveryAddress(
      createOrderDto,
      location,
    );
    const order = this.orderRepository.create({
      userId: user.id,
      locationId: location.id,
      designVariant: createOrderDto.designVariant,
      designName: design.name,
      amountInr: STANDEE_PRICE_INR,
      businessNameSnapshot: location.name,
      deliveryTo: createOrderDto.deliveryTo,
      addressLine1: deliveryAddress.addressLine1,
      addressLine2: deliveryAddress.addressLine2,
      addressLine3: deliveryAddress.addressLine3,
      pincode: deliveryAddress.pincode,
      phoneNumber: createOrderDto.phoneNumber,
      status: OrderStatus.PLACED,
      statusNote: null,
    });
    const savedOrder = await this.orderRepository.save(order);
    void this.sendOrderConfirmationEmail(savedOrder, user.email, user.name).catch(
      (error: unknown) => {
        this.logger.error(
          `Failed to send order confirmation email for order ${savedOrder.id}`,
          error instanceof Error ? error.stack : undefined,
        );
      },
    );
    return savedOrder;
  }

  async findAllPaginated(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<Order>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;
    const [data, total] = await this.orderRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Order> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const order = await this.orderRepository.findOne({
      where: { id, userId },
    });
    if (!order) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }
    return order;
  }

  private async sendOrderConfirmationEmail(
    order: Order,
    email: string,
    name: string | null,
  ): Promise<void> {
    const deliveryAddress = [
      order.addressLine1,
      order.addressLine2,
      order.addressLine3,
      order.pincode,
    ]
      .map((part) => part?.trim())
      .filter(Boolean)
      .join(', ');
    const details: OrderConfirmationEmailDetails = {
      orderId: order.id,
      designName: order.designName,
      businessName: order.businessNameSnapshot,
      amountInr: order.amountInr,
      phoneNumber: order.phoneNumber,
      deliveryAddress: deliveryAddress || 'Address on file',
      placedAtIst: formatOrderPlacedAtIst(order.createdAt),
    };
    await this.emailService.sendOrderConfirmation(
      email,
      details,
      name ?? undefined,
    );
    await this.emailService.sendAdminOrderReceived(details);
  }

  private resolveDeliveryAddress(
    createOrderDto: CreateOrderDto,
    location: Location,
  ): {
    addressLine1: string | null;
    addressLine2: string | null;
    addressLine3: string | null;
    pincode: string | null;
  } {
    if (createOrderDto.deliveryTo === DeliveryTo.OTHER) {
      return {
        addressLine1: createOrderDto.addressLine1 ?? null,
        addressLine2: createOrderDto.addressLine2 ?? null,
        addressLine3: createOrderDto.addressLine3 ?? null,
        pincode: createOrderDto.pincode ?? null,
      };
    }
    const formatted = location.formattedAddress?.trim() || null;
    const line1 =
      location.addressLine1?.trim() ||
      formatted ||
      [location.city, location.state, location.country]
        .map((part) => part?.trim())
        .filter(Boolean)
        .join(', ') ||
      null;
    if (!line1) {
      throw new BadRequestException(
        'This location has no address on file. Choose a different delivery address.',
      );
    }
    return {
      addressLine1: line1,
      addressLine2: null,
      addressLine3: null,
      pincode: location.pincode?.trim() || null,
    };
  }
}
