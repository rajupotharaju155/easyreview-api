import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Location } from '../locations/entities/location.entity';
import { LocationAccessService } from '../locations/location-access.service';
import { MenuOrdersQueryDto } from './dto/menu-orders-query.dto';
import { UpdateMenuOrderSettingsDto } from './dto/update-menu-order-settings.dto';
import { UpdateMenuOrderStatusDto } from './dto/update-menu-order-status.dto';
import { MenuOrderItem } from './entities/menu-order-item.entity';
import { MenuOrder } from './entities/menu-order.entity';
import { MenuOrderItemType } from './enums/menu-order-item-type.enum';
import {
  canMoveMenuOrderStatus,
  MenuOrderStatus,
} from './enums/menu-order-status.enum';
import { MenuOrderType } from './enums/menu-order-type.enum';

export type MenuOrderItemDto = {
  id: string;
  itemType: MenuOrderItemType;
  menuItemId: string | null;
  comboId: string | null;
  itemName: string;
  variantLabel: string | null;
  comboItemNames: string[] | null;
  unitPrice: number;
  quantity: number;
  lineTotal: number;
};

export type MenuOrderDto = {
  id: string;
  locationId: string;
  orderDate: string;
  orderNumber: number;
  customerId: string | null;
  customerName: string;
  customerCountryCode: string;
  customerPhone: string;
  orderType: MenuOrderType;
  spotNumber: string | null;
  note: string | null;
  status: MenuOrderStatus;
  totalAmount: number;
  currency: string;
  createdAt: Date;
  updatedAt: Date;
  items?: MenuOrderItemDto[];
};

/** New-order count for the badge, and the latest order to catch up on missed alerts. */
export type MenuOrderSummaryDto = {
  latestOrderId: string | null;
  newCount: number;
};

export type MenuOrderSettingsDto = {
  menuOrderingEnabled: boolean;
  menuWhatsappNumber: string | null;
  /** Business phone, used when menuWhatsappNumber is not set. */
  phoneNumber: string | null;
  menuOrderTypes: MenuOrderType[];
};

const SETTINGS_FIELDS: Array<keyof Location> = [
  'id',
  'phoneNumber',
  'menuOrderingEnabled',
  'menuWhatsappNumber',
  'menuOrderTypes',
];

/** Orders inbox for the business owner. */
@Injectable()
export class MenuOrdersService {
  constructor(
    @InjectRepository(MenuOrder)
    private readonly orderRepository: Repository<MenuOrder>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly locationAccess: LocationAccessService,
  ) {}

  async list(
    locationId: string,
    query: MenuOrdersQueryDto,
  ): Promise<PaginatedResponseDto<MenuOrderDto>> {
    await this.locationAccess.requireOwned(locationId);
    const { page = 1, limit = 20, status, date } = query;

    const [orders, total] = await this.orderRepository.findAndCount({
      where: {
        locationId,
        ...(status?.length ? { status: In(status) } : {}),
        ...(date ? { orderDate: date } : {}),
      },
      relations: { items: true },
      order: { createdAt: 'DESC', items: { sortOrder: 'ASC' } },
      skip: (page - 1) * limit,
      take: limit,
    });

    return new PaginatedResponseDto(
      orders.map((order) => this.toDto(order)),
      total,
      page,
      limit,
    );
  }

  async get(locationId: string, orderId: string): Promise<MenuOrderDto> {
    await this.locationAccess.requireOwned(locationId);
    return this.toDto(await this.requireOrder(locationId, orderId));
  }

  async updateStatus(
    locationId: string,
    orderId: string,
    dto: UpdateMenuOrderStatusDto,
  ): Promise<MenuOrderDto> {
    await this.locationAccess.requireOwned(locationId);
    const order = await this.requireOrder(locationId, orderId);
    if (order.status === dto.status) return this.toDto(order);
    if (!canMoveMenuOrderStatus(order.status, dto.status)) {
      throw new BadRequestException(
        `A ${order.status} order can't be marked ${dto.status}`,
      );
    }
    await this.orderRepository.update(order.id, { status: dto.status });
    return this.toDto(await this.requireOrder(locationId, orderId));
  }

  async summary(locationId: string): Promise<MenuOrderSummaryDto> {
    await this.locationAccess.requireOwned(locationId);
    const [latest, newCount] = await Promise.all([
      this.orderRepository.findOne({
        where: { locationId },
        select: ['id'],
        order: { createdAt: 'DESC' },
      }),
      this.orderRepository.count({
        where: { locationId, status: MenuOrderStatus.NEW },
      }),
    ]);
    return { latestOrderId: latest?.id ?? null, newCount };
  }

  async getSettings(locationId: string): Promise<MenuOrderSettingsDto> {
    return this.toSettingsDto(await this.requireSettings(locationId));
  }

  async updateSettings(
    locationId: string,
    dto: UpdateMenuOrderSettingsDto,
  ): Promise<MenuOrderSettingsDto> {
    await this.requireSettings(locationId);
    const fields: Partial<Location> = {};
    if (dto.menuOrderingEnabled !== undefined) {
      fields.menuOrderingEnabled = dto.menuOrderingEnabled;
    }
    if (dto.menuWhatsappNumber !== undefined) {
      fields.menuWhatsappNumber = dto.menuWhatsappNumber;
    }
    if (dto.menuOrderTypes !== undefined) {
      fields.menuOrderTypes = dto.menuOrderTypes;
    }
    if (Object.keys(fields).length > 0) {
      await this.locationRepository.update(locationId, fields);
    }
    return this.getSettings(locationId);
  }

  private async requireSettings(locationId: string): Promise<Location> {
    const location = await this.locationAccess
      .ownedQuery(locationId)
      .select(SETTINGS_FIELDS.map((field) => `location.${field}`))
      .getOne();
    if (!location) throw this.locationAccess.notFound(locationId);
    return location;
  }

  private async requireOrder(
    locationId: string,
    orderId: string,
  ): Promise<MenuOrder> {
    const order = await this.orderRepository.findOne({
      where: { id: orderId, locationId },
      relations: { items: true },
      order: { items: { sortOrder: 'ASC' } },
    });
    if (!order) {
      throw new NotFoundException('Order not found');
    }
    return order;
  }

  private toSettingsDto(location: Location): MenuOrderSettingsDto {
    return {
      menuOrderingEnabled: location.menuOrderingEnabled,
      menuWhatsappNumber: location.menuWhatsappNumber,
      phoneNumber: location.phoneNumber,
      menuOrderTypes: location.menuOrderTypes,
    };
  }

  private toDto(order: MenuOrder): MenuOrderDto {
    return {
      id: order.id,
      locationId: order.locationId,
      orderDate: order.orderDate,
      orderNumber: order.orderNumber,
      customerId: order.customerId,
      customerName: order.customerName,
      customerCountryCode: order.customerCountryCode,
      customerPhone: order.customerPhone,
      orderType: order.orderType,
      spotNumber: order.spotNumber,
      note: order.note,
      status: order.status,
      totalAmount: order.totalAmount,
      currency: order.currency,
      createdAt: order.createdAt,
      updatedAt: order.updatedAt,
      items: order.items?.map((item) => this.toItemDto(item)),
    };
  }

  private toItemDto(item: MenuOrderItem): MenuOrderItemDto {
    return {
      id: item.id,
      itemType: item.itemType,
      menuItemId: item.menuItemId,
      comboId: item.comboId,
      itemName: item.itemName,
      variantLabel: item.variantLabel,
      comboItemNames: item.comboItemNames,
      unitPrice: item.unitPrice,
      quantity: item.quantity,
      lineTotal: item.lineTotal,
    };
  }
}
