import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import {
  STANDEE_DESIGNS,
  STANDEE_PRICE_INR,
} from './constants/standee.constants';
import { CreateOrderDto } from './dto/create-order.dto';
import { Order } from './entities/order.entity';
import { DeliveryTo } from './enums/delivery-to.enum';
import { OrderStatus } from './enums/order-status.enum';

@Injectable()
export class OrdersService {
  constructor(
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async create(createOrderDto: CreateOrderDto): Promise<Order> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id: createOrderDto.locationId, userId },
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
      userId,
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
    return this.orderRepository.save(order);
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
