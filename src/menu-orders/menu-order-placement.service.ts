import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, In, Repository } from 'typeorm';
import { toPaise, toRupees } from '../common/utils/money';
import {
  phoneMatchVariants,
  toNationalNumber,
} from '../common/utils/phone.util';
import { todayInTimeZone } from '../common/utils/time-zone.util';
import { CustomersService } from '../contacts/customers.service';
import { Location } from '../locations/entities/location.entity';
import { MenuCategory } from '../menu/entities/menu-category.entity';
import { MenuComboItem } from '../menu/entities/menu-combo-item.entity';
import { MenuCombo } from '../menu/entities/menu-combo.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import {
  coercePriceVariants,
  comboPricing,
  orderableItemPrice,
} from '../menu/menu-pricing';
import { Product } from '../plans/enums/product.enum';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';
import {
  CreateMenuOrderDto,
  CreateMenuOrderLineDto,
} from './dto/create-menu-order.dto';
import { MenuOrderItem } from './entities/menu-order-item.entity';
import { MenuOrder } from './entities/menu-order.entity';
import { MenuOrderItemType } from './enums/menu-order-item-type.enum';
import { MenuOrderStatus } from './enums/menu-order-status.enum';
import { SPOT_ORDER_TYPES } from './enums/menu-order-type.enum';
import { buildMenuOrderMessage, buildWhatsappUrl } from './menu-order-message';

/** E.164 allows at most 15 digits including the country code. */
const MAX_INTERNATIONAL_PHONE_DIGITS = 15;
const MIN_NATIONAL_PHONE_DIGITS = 4;

export type PlacedMenuOrderDto = {
  id: string;
  orderNumber: number;
  totalAmount: number;
  currency: string;
  /** Opens WhatsApp with the order prefilled; null when no number is set. */
  whatsappUrl: string | null;
};

type PricedLine = Pick<
  MenuOrderItem,
  | 'itemType'
  | 'menuItemId'
  | 'comboId'
  | 'itemName'
  | 'variantLabel'
  | 'comboItemNames'
  | 'unitPrice'
  | 'quantity'
  | 'lineTotal'
>;

/** Places orders guests submit from the public menu. */
@Injectable()
export class MenuOrderPlacementService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(MenuItem)
    private readonly itemRepository: Repository<MenuItem>,
    @InjectRepository(MenuCategory)
    private readonly categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuCombo)
    private readonly comboRepository: Repository<MenuCombo>,
    @InjectRepository(MenuComboItem)
    private readonly comboItemRepository: Repository<MenuComboItem>,
    private readonly subscriptionsService: SubscriptionsService,
    private readonly customersService: CustomersService,
    private readonly dataSource: DataSource,
  ) {}

  async place(
    slug: string,
    dto: CreateMenuOrderDto,
  ): Promise<PlacedMenuOrderDto> {
    const location = await this.requireOrderableLocation(slug);

    if (!location.menuOrderTypes.includes(dto.orderType)) {
      throw new BadRequestException('This order type is not available');
    }
    const spotNumber = SPOT_ORDER_TYPES.includes(dto.orderType)
      ? (dto.spotNumber ?? null)
      : null;

    const customerPhone = toNationalNumber(
      dto.customerCountryCode,
      dto.customerPhone,
    );
    const dialDigits = dto.customerCountryCode.replace(/\D/g, '');
    if (
      customerPhone.length < MIN_NATIONAL_PHONE_DIGITS ||
      dialDigits.length + customerPhone.length > MAX_INTERNATIONAL_PHONE_DIGITS
    ) {
      throw new BadRequestException('phone number is not valid');
    }

    const lines = await this.priceLines(location.id, dto.items);
    const totalAmount = toRupees(
      lines.reduce((sum, line) => sum + toPaise(line.lineTotal), 0),
    );
    const orderDate = todayInTimeZone(location.timezone);

    const order = await this.dataSource.transaction(async (manager) => {
      const orderNumber = await this.nextOrderNumber(
        manager,
        location.id,
        orderDate,
      );
      const customerId = await this.customersService.findOrCreateByPhone(
        manager,
        location.id,
        {
          name: dto.customerName,
          phone: `${dto.customerCountryCode}${customerPhone}`,
          // Customers added by hand may be saved without the code or with a 0.
          matchPhones: phoneMatchVariants(
            dto.customerCountryCode,
            customerPhone,
          ),
        },
      );

      const saved = await manager.save(
        new MenuOrder({
          locationId: location.id,
          orderDate,
          orderNumber,
          customerId,
          customerName: dto.customerName,
          customerCountryCode: dto.customerCountryCode,
          customerPhone,
          orderType: dto.orderType,
          spotNumber,
          note: dto.note ?? null,
          status: MenuOrderStatus.NEW,
          totalAmount,
          currency: location.currency,
        }),
      );
      await manager.save(
        lines.map(
          (line, index) =>
            new MenuOrderItem({ ...line, orderId: saved.id, sortOrder: index }),
        ),
      );
      return saved;
    });

    const message = buildMenuOrderMessage({ ...order, items: lines });
    return {
      id: order.id,
      orderNumber: order.orderNumber,
      totalAmount: order.totalAmount,
      currency: order.currency,
      whatsappUrl: buildWhatsappUrl(
        location.menuWhatsappNumber ?? location.phoneNumber,
        message,
      ),
    };
  }

  private async requireOrderableLocation(slug: string): Promise<Location> {
    const location = await this.locationRepository.findOne({
      where: { slug },
      select: [
        'id',
        'slug',
        'phoneNumber',
        'menuOrderingEnabled',
        'menuWhatsappNumber',
        'menuOrderTypes',
        'currency',
        'timezone',
      ],
    });
    if (!location || !location.slug) {
      throw new NotFoundException(`Menu for slug "${slug}" not found`);
    }
    const live = await this.subscriptionsService.hasActiveForLocation(
      location.id,
      Product.EASY_MENU,
    );
    if (!live) {
      throw new NotFoundException(`Menu for slug "${slug}" not found`);
    }
    if (!location.menuOrderingEnabled) {
      throw new BadRequestException('This business is not taking orders');
    }
    return location;
  }

  /** Prices every cart line from the current menu; the client's prices are never used. */
  private async priceLines(
    locationId: string,
    input: CreateMenuOrderLineDto[],
  ): Promise<PricedLine[]> {
    const itemIds = input.flatMap((line) =>
      line.menuItemId ? [line.menuItemId] : [],
    );
    const comboIds = input.flatMap((line) =>
      line.comboId ? [line.comboId] : [],
    );

    const [combos, comboItems]: [MenuCombo[], MenuComboItem[]] =
      await Promise.all([
        comboIds.length
          ? this.comboRepository.find({
              where: { id: In(comboIds), locationId },
            })
          : [],
        comboIds.length
          ? this.comboItemRepository.find({
              where: { comboId: In(comboIds) },
              order: { sortOrder: 'ASC' },
            })
          : [],
      ]);

    const items = await this.itemRepository.find({
      where: {
        id: In([...itemIds, ...comboItems.map((row) => row.menuItemId)]),
        locationId,
      },
    });
    const categoryIds = [...new Set(items.map((item) => item.categoryId))];
    const categories = categoryIds.length
      ? await this.categoryRepository.find({
          where: { id: In(categoryIds), locationId },
        })
      : [];

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const combosById = new Map(combos.map((combo) => [combo.id, combo]));
    const categoriesById = new Map(
      categories.map((category) => [category.id, category]),
    );
    const comboItemIds = new Map<string, string[]>();
    for (const row of comboItems) {
      const list = comboItemIds.get(row.comboId) ?? [];
      list.push(row.menuItemId);
      comboItemIds.set(row.comboId, list);
    }

    return input.map((line) => {
      if (Boolean(line.menuItemId) === Boolean(line.comboId)) {
        throw new BadRequestException(
          'Each cart line needs either a menu item or a combo',
        );
      }

      if (line.menuItemId) {
        const item = itemsById.get(line.menuItemId);
        const category = item ? categoriesById.get(item.categoryId) : null;
        const price =
          item && category
            ? orderableItemPrice(
                item,
                coercePriceVariants(category.priceVariants),
                line.priceOption,
              )
            : null;
        if (!item || !price) {
          throw new BadRequestException(
            `${item?.name ?? 'An item'} in your cart is no longer available`,
          );
        }
        return this.toLine(line.quantity, price.unitPrice, {
          itemType: MenuOrderItemType.ITEM,
          menuItemId: item.id,
          comboId: null,
          itemName: item.name,
          variantLabel: price.variantLabel,
          comboItemNames: null,
        });
      }

      const combo = combosById.get(line.comboId!);
      const ids = combo ? (comboItemIds.get(combo.id) ?? []) : [];
      const members = ids.map((id) => itemsById.get(id));
      const available =
        members.length > 0 &&
        members.every((item) => item && !item.isNotAvailable);
      if (!combo || !available) {
        throw new BadRequestException(
          `${combo?.name ?? 'A combo'} in your cart is no longer available`,
        );
      }
      const comboMembers = members as MenuItem[];
      return this.toLine(
        line.quantity,
        comboPricing(comboMembers, combo.priceOverride).price,
        {
          itemType: MenuOrderItemType.COMBO,
          menuItemId: null,
          comboId: combo.id,
          itemName: combo.name,
          variantLabel: null,
          comboItemNames: comboMembers.map((item) => item.name),
        },
      );
    });
  }

  private toLine(
    quantity: number,
    unitPrice: number,
    fields: Omit<PricedLine, 'unitPrice' | 'quantity' | 'lineTotal'>,
  ): PricedLine {
    return {
      ...fields,
      unitPrice,
      quantity,
      lineTotal: toRupees(toPaise(unitPrice) * quantity),
    };
  }

  /** Next token for the day. Holds the sequence row lock until commit. */
  private async nextOrderNumber(
    manager: EntityManager,
    locationId: string,
    orderDate: string,
  ): Promise<number> {
    const rows: Array<{ lastNumber: number }> = await manager.query(
      `INSERT INTO menu_order_sequences ("locationId", "orderDate", "lastNumber")
       VALUES ($1, $2, 1)
       ON CONFLICT ("locationId", "orderDate")
       DO UPDATE SET "lastNumber" = menu_order_sequences."lastNumber" + 1
       RETURNING "lastNumber"`,
      [locationId, orderDate],
    );
    return Number(rows[0].lastNumber);
  }
}
