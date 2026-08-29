import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, In, Repository } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { MenuStyle } from './enums/menu-style.enum';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateComboDto } from './dto/create-combo.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateSpecialDto } from './dto/create-special.dto';
import { MoveItemDto } from './dto/move-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuComboItem } from './entities/menu-combo-item.entity';
import { MenuCombo } from './entities/menu-combo.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuSpecial } from './entities/menu-special.entity';
import { MenuStorageService, type MenuImageFile } from './menu-storage.service';
import {
  coercePriceVariants,
  coerceVariantPrices,
  dropRemovedVariantPrices,
  minVariantPrice,
  normalizePriceVariants,
  normalizeVariantPrices,
  remapVariantPrices,
  type MenuItemVariantPrice,
  type MenuPriceVariant,
} from './menu-pricing';

const MAX_IMAGE_URL_LENGTH = 2048;

export type MenuItemDto = {
  id: string;
  locationId: string;
  categoryId: string;
  name: string;
  description: string | null;
  isNonVeg: boolean;
  isNotAvailable: boolean;
  imageUrl: string | null;
  isHalfServed: boolean;
  halfPrice: number | null;
  fullPrice: number;
  isMultiPriced: boolean;
  variantPrices: MenuItemVariantPrice[];
  sortOrder: number;
};

export type MenuCategoryDto = {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  priceVariants: MenuPriceVariant[];
  items: MenuItemDto[];
};

export type MenuComboDto = {
  id: string;
  locationId: string;
  name: string;
  sortOrder: number;
  itemIds: string[];
  items: MenuItemDto[];
  itemsSubtotal: number;
  priceOverride: number | null;
  price: number;
  savings: number;
};

export type MenuSpecialDto = {
  id: string;
  locationId: string;
  menuItemId: string;
  sortOrder: number;
  item: MenuItemDto;
};

export type LocationMenuDto = {
  location: {
    id: string;
    name: string;
    slug: string | null;
    city: string | null;
    state: string | null;
    phoneNumber: string | null;
    formattedAddress: string | null;
    menuStyle: MenuStyle;
  };
  categories: MenuCategoryDto[];
  combos: MenuComboDto[];
  specials: MenuSpecialDto[];
};

@Injectable()
export class MenuService {
  constructor(
    @InjectRepository(MenuCategory)
    private readonly categoryRepository: Repository<MenuCategory>,
    @InjectRepository(MenuItem)
    private readonly itemRepository: Repository<MenuItem>,
    @InjectRepository(MenuCombo)
    private readonly comboRepository: Repository<MenuCombo>,
    @InjectRepository(MenuComboItem)
    private readonly comboItemRepository: Repository<MenuComboItem>,
    @InjectRepository(MenuSpecial)
    private readonly specialRepository: Repository<MenuSpecial>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly dataSource: DataSource,
    private readonly menuStorage: MenuStorageService,
  ) {}

  async getOwnedMenu(locationId: string): Promise<LocationMenuDto> {
    const location = await this.assertLocationOwned(locationId);
    return this.loadMenu(location);
  }

  async getPublicMenuBySlug(slug: string): Promise<LocationMenuDto> {
    const location = await this.locationRepository.findOne({
      where: { slug },
      select: [
        'id',
        'name',
        'slug',
        'city',
        'state',
        'phoneNumber',
        'formattedAddress',
        'isEasyMenuEnabled',
        'menuStyle',
      ],
    });

    if (!location || !location.slug || !location.isEasyMenuEnabled) {
      throw new NotFoundException(`Menu for slug "${slug}" not found`);
    }

    return this.loadMenu(location, { forPublic: true });
  }

  async createCategory(
    locationId: string,
    dto: CreateCategoryDto,
  ): Promise<MenuCategoryDto> {
    await this.assertLocationOwned(locationId);
    const sortOrder = await this.nextSortOrder(
      this.categoryRepository,
      locationId,
    );
    const category = await this.categoryRepository.save(
      new MenuCategory({
        locationId,
        name: dto.name.trim(),
        sortOrder,
        priceVariants: normalizePriceVariants(dto.priceVariants ?? []),
      }),
    );
    return { ...this.toCategoryDto(category), items: [] };
  }

  async updateCategory(
    locationId: string,
    categoryId: string,
    dto: UpdateCategoryDto,
  ): Promise<MenuCategoryDto> {
    await this.assertLocationOwned(locationId);
    const category = await this.requireCategory(locationId, categoryId);
    if (dto.name !== undefined) {
      category.name = dto.name.trim();
    }
    if (dto.priceVariants !== undefined) {
      const nextVariants = normalizePriceVariants(dto.priceVariants);
      category.priceVariants = nextVariants;
      const categoryItems = await this.itemRepository.find({
        where: { locationId, categoryId },
      });
      for (const item of categoryItems) {
        const nextPrices = dropRemovedVariantPrices(
          coerceVariantPrices(item.variantPrices),
          nextVariants,
        );
        item.variantPrices = nextPrices;
        if (item.isMultiPriced) {
          const min = minVariantPrice(nextPrices);
          if (min != null) item.fullPrice = min;
        }
      }
      if (categoryItems.length > 0) {
        await this.itemRepository.save(categoryItems);
      }
    }
    await this.categoryRepository.save(category);
    const items = await this.itemRepository.find({
      where: { locationId, categoryId },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
    return {
      ...this.toCategoryDto(category),
      items: items.map((item) => this.toItemDto(item)),
    };
  }

  async deleteCategory(locationId: string, categoryId: string): Promise<void> {
    await this.assertLocationOwned(locationId);
    const category = await this.requireCategory(locationId, categoryId);
    const items = await this.itemRepository.find({
      where: { locationId, categoryId },
      select: ['id', 'imageUrl'],
    });
    const itemIds = items.map((item) => item.id);
    const imageUrls = items
      .map((item) => item.imageUrl)
      .filter((url): url is string => Boolean(url));

    await this.dataSource.transaction(async (manager) => {
      if (itemIds.length > 0) {
        await manager.delete(MenuComboItem, { menuItemId: In(itemIds) });
        await manager.delete(MenuSpecial, { menuItemId: In(itemIds) });
        await manager.softDelete(MenuItem, { id: In(itemIds) });
      }

      await manager.softDelete(MenuCategory, { id: category.id });
    });

    await Promise.all(imageUrls.map((url) => this.menuStorage.deleteIfManaged(url)));
  }

  async uploadItemImage(
    locationId: string,
    file: MenuImageFile,
  ): Promise<{ url: string }> {
    await this.assertLocationOwned(locationId);
    const url = await this.menuStorage.uploadItemImage(locationId, file);
    return { url };
  }

  async reorderCategories(locationId: string, dto: ReorderDto): Promise<void> {
    await this.assertLocationOwned(locationId);
    await this.applyReorder(this.categoryRepository, locationId, dto.ids);
  }

  async createItem(
    locationId: string,
    dto: CreateItemDto,
  ): Promise<MenuItemDto> {
    await this.assertLocationOwned(locationId);
    const category = await this.requireCategory(locationId, dto.categoryId);
    this.assertImageUrl(dto.imageUrl);

    const pricing = this.resolveItemPricing({
      isMultiPriced: Boolean(dto.isMultiPriced),
      variantPrices: dto.variantPrices,
      isHalfServed: Boolean(dto.isHalfServed),
      halfPrice: dto.halfPrice,
      fullPrice: dto.fullPrice,
      variants: coercePriceVariants(category.priceVariants),
    });

    const sortOrder = await this.nextItemSortOrder(locationId, dto.categoryId);
    const item = await this.itemRepository.save(
      new MenuItem({
        locationId,
        categoryId: dto.categoryId,
        name: dto.name.trim(),
        description: dto.description?.trim() || null,
        isNonVeg: Boolean(dto.isNonVeg),
        isNotAvailable: Boolean(dto.isNotAvailable),
        imageUrl: dto.imageUrl?.trim() || null,
        isHalfServed: pricing.isHalfServed,
        halfPrice: pricing.halfPrice,
        fullPrice: pricing.fullPrice,
        isMultiPriced: pricing.isMultiPriced,
        variantPrices: pricing.variantPrices,
        sortOrder,
      }),
    );
    return this.toItemDto(item);
  }

  async updateItem(
    locationId: string,
    itemId: string,
    dto: UpdateItemDto,
  ): Promise<MenuItemDto> {
    await this.assertLocationOwned(locationId);
    const item = await this.requireItem(locationId, itemId);
    const previousCategoryId = item.categoryId;
    const previousCategory =
      dto.categoryId && dto.categoryId !== item.categoryId
        ? await this.requireCategory(locationId, item.categoryId)
        : null;

    if (dto.categoryId && dto.categoryId !== item.categoryId) {
      await this.requireCategory(locationId, dto.categoryId);
      item.categoryId = dto.categoryId;
      item.sortOrder = await this.nextItemSortOrder(locationId, dto.categoryId);
    }
    if (dto.name !== undefined) item.name = dto.name.trim();
    if (dto.description !== undefined) {
      item.description = dto.description?.trim() || null;
    }
    if (dto.isNonVeg !== undefined) item.isNonVeg = dto.isNonVeg;
    if (dto.isNotAvailable !== undefined) item.isNotAvailable = dto.isNotAvailable;
    const previousImageUrl = item.imageUrl;
    if (dto.imageUrl !== undefined) {
      this.assertImageUrl(dto.imageUrl);
      item.imageUrl = dto.imageUrl?.trim() || null;
    }

    const category = await this.requireCategory(locationId, item.categoryId);
    const targetVariants = coercePriceVariants(category.priceVariants);
    let variantPrices = coerceVariantPrices(item.variantPrices);
    if (dto.variantPrices !== undefined) {
      variantPrices = dto.variantPrices;
    } else if (previousCategory && item.categoryId !== previousCategoryId) {
      variantPrices = remapVariantPrices(
        variantPrices,
        coercePriceVariants(previousCategory.priceVariants),
        targetVariants,
      );
    }

    const wantsMultiPrice = dto.isMultiPriced ?? item.isMultiPriced;
    const remappedEmpty =
      wantsMultiPrice &&
      dto.variantPrices === undefined &&
      previousCategory != null &&
      normalizeVariantPrices(variantPrices, targetVariants).length === 0;

    const pricing = this.resolveItemPricing({
      isMultiPriced: remappedEmpty ? false : wantsMultiPrice,
      variantPrices,
      isHalfServed: dto.isHalfServed ?? item.isHalfServed,
      halfPrice: dto.halfPrice !== undefined ? dto.halfPrice : item.halfPrice,
      fullPrice: dto.fullPrice !== undefined ? dto.fullPrice : item.fullPrice,
      variants: targetVariants,
    });
    item.isHalfServed = pricing.isHalfServed;
    item.halfPrice = pricing.halfPrice;
    item.fullPrice = pricing.fullPrice;
    item.isMultiPriced = pricing.isMultiPriced;
    item.variantPrices = pricing.variantPrices;

    await this.itemRepository.save(item);
    if (
      dto.imageUrl !== undefined &&
      previousImageUrl &&
      previousImageUrl !== item.imageUrl
    ) {
      await this.menuStorage.deleteIfManaged(previousImageUrl);
    }
    return this.toItemDto(item);
  }

  async deleteItem(locationId: string, itemId: string): Promise<void> {
    await this.assertLocationOwned(locationId);
    const item = await this.requireItem(locationId, itemId);

    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MenuComboItem, { menuItemId: item.id });
      await manager.delete(MenuSpecial, { menuItemId: item.id });
      await manager.softDelete(MenuItem, { id: item.id });
    });
    await this.menuStorage.deleteIfManaged(item.imageUrl);
  }

  async moveItem(
    locationId: string,
    itemId: string,
    dto: MoveItemDto,
  ): Promise<MenuItemDto> {
    return this.updateItem(locationId, itemId, { categoryId: dto.categoryId });
  }

  async reorderItems(locationId: string, dto: ReorderItemsDto): Promise<void> {
    await this.assertLocationOwned(locationId);
    await this.requireCategory(locationId, dto.categoryId);
    await this.applyReorder(this.itemRepository, locationId, dto.ids, {
      categoryId: dto.categoryId,
    });
  }

  async createCombo(
    locationId: string,
    dto: CreateComboDto,
  ): Promise<MenuComboDto> {
    await this.assertLocationOwned(locationId);
    const items = await this.requireOwnedItems(locationId, dto.itemIds);
    const sortOrder = await this.nextSortOrder(this.comboRepository, locationId);

    const combo = await this.dataSource.transaction(async (manager) => {
      const saved = await manager.save(
        new MenuCombo({
          locationId,
          name: dto.name.trim(),
          priceOverride: dto.priceOverride ?? null,
          sortOrder,
        }),
      );
      await manager.save(
        dto.itemIds.map(
          (menuItemId, index) =>
            new MenuComboItem({
              comboId: saved.id,
              menuItemId,
              sortOrder: index,
            }),
        ),
      );
      return saved;
    });

    return this.toComboDto(combo, items, dto.itemIds);
  }

  async updateCombo(
    locationId: string,
    comboId: string,
    dto: UpdateComboDto,
  ): Promise<MenuComboDto> {
    await this.assertLocationOwned(locationId);
    const combo = await this.requireCombo(locationId, comboId);

    if (dto.name !== undefined) combo.name = dto.name.trim();
    if (dto.priceOverride !== undefined) combo.priceOverride = dto.priceOverride;

    const itemIds = dto.itemIds ?? (await this.getComboItemIds(combo.id));
    const items = await this.requireOwnedItems(locationId, itemIds);

    await this.dataSource.transaction(async (manager) => {
      await manager.save(combo);
      if (dto.itemIds) {
        await manager.delete(MenuComboItem, { comboId: combo.id });
        await manager.save(
          dto.itemIds.map(
            (menuItemId, index) =>
              new MenuComboItem({
                comboId: combo.id,
                menuItemId,
                sortOrder: index,
              }),
          ),
        );
      }
    });

    return this.toComboDto(combo, items, itemIds);
  }

  async deleteCombo(locationId: string, comboId: string): Promise<void> {
    await this.assertLocationOwned(locationId);
    const combo = await this.requireCombo(locationId, comboId);
    await this.dataSource.transaction(async (manager) => {
      await manager.delete(MenuComboItem, { comboId: combo.id });
      await manager.softDelete(MenuCombo, { id: combo.id });
    });
  }

  async reorderCombos(locationId: string, dto: ReorderDto): Promise<void> {
    await this.assertLocationOwned(locationId);
    await this.applyReorder(this.comboRepository, locationId, dto.ids);
  }

  async createSpecial(
    locationId: string,
    dto: CreateSpecialDto,
  ): Promise<MenuSpecialDto> {
    await this.assertLocationOwned(locationId);
    const item = await this.requireItem(locationId, dto.menuItemId);

    const existing = await this.specialRepository.findOne({
      where: { locationId, menuItemId: dto.menuItemId },
    });
    if (existing) {
      throw new BadRequestException('This item is already in Today\'s Special');
    }

    const sortOrder = await this.nextSortOrder(
      this.specialRepository,
      locationId,
    );
    const special = await this.specialRepository.save(
      new MenuSpecial({
        locationId,
        menuItemId: dto.menuItemId,
        sortOrder,
      }),
    );

    return {
      id: special.id,
      locationId,
      menuItemId: item.id,
      sortOrder: special.sortOrder,
      item: this.toItemDto(item),
    };
  }

  async deleteSpecial(locationId: string, specialId: string): Promise<void> {
    await this.assertLocationOwned(locationId);
    const special = await this.specialRepository.findOne({
      where: { id: specialId, locationId },
    });
    if (!special) {
      throw new NotFoundException('Today\'s Special item not found');
    }
    await this.specialRepository.delete({ id: special.id });
  }

  async reorderSpecials(locationId: string, dto: ReorderDto): Promise<void> {
    await this.assertLocationOwned(locationId);
    await this.applyReorder(this.specialRepository, locationId, dto.ids);
  }

  private async loadMenu(
    location: Location,
    options?: { forPublic?: boolean },
  ): Promise<LocationMenuDto> {
    const [categories, items, combos, specials] = await Promise.all([
      this.categoryRepository.find({
        where: { locationId: location.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.itemRepository.find({
        where: { locationId: location.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.comboRepository.find({
        where: { locationId: location.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
      this.specialRepository.find({
        where: { locationId: location.id },
        order: { sortOrder: 'ASC', createdAt: 'ASC' },
      }),
    ]);

    const comboItems =
      combos.length > 0
        ? await this.comboItemRepository.find({
            where: { comboId: In(combos.map((combo) => combo.id)) },
            order: { sortOrder: 'ASC' },
          })
        : [];

    const itemsById = new Map(items.map((item) => [item.id, item]));
    const guestItems = options?.forPublic
      ? items.filter((item) => !item.isNotAvailable)
      : items;
    const itemsByCategory = new Map<string, MenuItem[]>();
    for (const item of guestItems) {
      const list = itemsByCategory.get(item.categoryId) ?? [];
      list.push(item);
      itemsByCategory.set(item.categoryId, list);
    }

    const comboItemIds = new Map<string, string[]>();
    for (const row of comboItems) {
      const list = comboItemIds.get(row.comboId) ?? [];
      list.push(row.menuItemId);
      comboItemIds.set(row.comboId, list);
    }

    const publicCombos = options?.forPublic
      ? combos.filter((combo) => {
          const ids = comboItemIds.get(combo.id) ?? [];
          return ids.every((id) => {
            const item = itemsById.get(id);
            if (!item) return false;
            return !item.isNotAvailable;
          });
        })
      : combos;

    return {
      location: {
        id: location.id,
        name: location.name,
        slug: location.slug,
        city: location.city,
        state: location.state,
        phoneNumber: location.phoneNumber ?? null,
        formattedAddress: location.formattedAddress ?? null,
        menuStyle: location.menuStyle ?? MenuStyle.RESTAURANT_STYLE,
      },
      categories: categories.map((category) => ({
        ...this.toCategoryDto(category),
        items: (itemsByCategory.get(category.id) ?? []).map((item) =>
          this.toItemDto(item),
        ),
      })),
      combos: publicCombos.map((combo) => {
        const ids = comboItemIds.get(combo.id) ?? [];
        const comboMenuItems = ids
          .map((id) => itemsById.get(id))
          .filter((item): item is MenuItem => Boolean(item));
        return this.toComboDto(combo, comboMenuItems, ids);
      }),
      specials: specials
        .map((special) => {
          const item = itemsById.get(special.menuItemId);
          if (!item) return null;
          if (options?.forPublic && item.isNotAvailable) return null;
          return {
            id: special.id,
            locationId: special.locationId,
            menuItemId: special.menuItemId,
            sortOrder: special.sortOrder,
            item: this.toItemDto(item),
          };
        })
        .filter((row): row is MenuSpecialDto => Boolean(row)),
    };
  }

  private toItemDto(item: MenuItem): MenuItemDto {
    return {
      id: item.id,
      locationId: item.locationId,
      categoryId: item.categoryId,
      name: item.name,
      description: item.description,
      isNonVeg: item.isNonVeg,
      isNotAvailable: Boolean(item.isNotAvailable),
      imageUrl: item.imageUrl,
      isHalfServed: item.isHalfServed,
      halfPrice: item.halfPrice,
      fullPrice: item.fullPrice,
      isMultiPriced: Boolean(item.isMultiPriced),
      variantPrices: coerceVariantPrices(item.variantPrices),
      sortOrder: item.sortOrder,
    };
  }

  private toCategoryDto(category: MenuCategory): Omit<MenuCategoryDto, 'items'> {
    return {
      id: category.id,
      locationId: category.locationId,
      name: category.name,
      sortOrder: category.sortOrder,
      priceVariants: coercePriceVariants(category.priceVariants),
    };
  }

  private toComboDto(
    combo: MenuCombo,
    items: MenuItem[],
    itemIds: string[],
  ): MenuComboDto {
    const itemsSubtotal = roundMoney(
      items.reduce((sum, item) => sum + Number(item.fullPrice || 0), 0),
    );
    const priceOverride =
      combo.priceOverride == null ? null : Number(combo.priceOverride);
    const price = roundMoney(priceOverride ?? itemsSubtotal);
    const savings = roundMoney(Math.max(0, itemsSubtotal - price));

    return {
      id: combo.id,
      locationId: combo.locationId,
      name: combo.name,
      sortOrder: combo.sortOrder,
      itemIds,
      items: items.map((item) => this.toItemDto(item)),
      itemsSubtotal,
      priceOverride,
      price,
      savings,
    };
  }

  private async assertLocationOwned(locationId: string): Promise<Location> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id: locationId, userId },
      select: [
        'id',
        'name',
        'slug',
        'city',
        'state',
        'phoneNumber',
        'formattedAddress',
        'isEasyMenuEnabled',
        'menuStyle',
      ],
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }

    if (!location.isEasyMenuEnabled) {
      throw new ForbiddenException('EasyMenu is not enabled for this location');
    }

    return location;
  }

  private async requireCategory(
    locationId: string,
    categoryId: string,
  ): Promise<MenuCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, locationId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async requireItem(
    locationId: string,
    itemId: string,
  ): Promise<MenuItem> {
    const item = await this.itemRepository.findOne({
      where: { id: itemId, locationId },
    });
    if (!item) {
      throw new NotFoundException('Menu item not found');
    }
    return item;
  }

  private async requireCombo(
    locationId: string,
    comboId: string,
  ): Promise<MenuCombo> {
    const combo = await this.comboRepository.findOne({
      where: { id: comboId, locationId },
    });
    if (!combo) {
      throw new NotFoundException('Combo not found');
    }
    return combo;
  }

  private async requireOwnedItems(
    locationId: string,
    itemIds: string[],
  ): Promise<MenuItem[]> {
    const uniqueIds = [...new Set(itemIds)];
    if (uniqueIds.length !== itemIds.length) {
      throw new BadRequestException('A combo cannot contain the same item twice');
    }

    const items = await this.itemRepository.find({
      where: { locationId, id: In(uniqueIds) },
    });
    const byId = new Map(items.map((item) => [item.id, item]));
    const missing = uniqueIds.filter((id) => !byId.has(id));
    if (missing.length > 0) {
      throw new BadRequestException('One or more combo items were not found');
    }

    return uniqueIds.map((id) => byId.get(id)!);
  }

  private async getComboItemIds(comboId: string): Promise<string[]> {
    const rows = await this.comboItemRepository.find({
      where: { comboId },
      order: { sortOrder: 'ASC' },
    });
    return rows.map((row) => row.menuItemId);
  }

  private async nextSortOrder(
    repository: Repository<{ sortOrder: number }>,
    locationId: string,
  ): Promise<number> {
    const raw = await repository
      .createQueryBuilder('row')
      .select('MAX(row.sortOrder)', 'max')
      .where('row.locationId = :locationId', { locationId })
      .getRawOne<{ max: string | number | null }>();
    return (Number(raw?.max) || 0) + 1;
  }

  private async nextItemSortOrder(
    locationId: string,
    categoryId: string,
  ): Promise<number> {
    const raw = await this.itemRepository
      .createQueryBuilder('row')
      .select('MAX(row.sortOrder)', 'max')
      .where('row.locationId = :locationId', { locationId })
      .andWhere('row.categoryId = :categoryId', { categoryId })
      .getRawOne<{ max: string | number | null }>();
    return (Number(raw?.max) || 0) + 1;
  }

  private async applyReorder(
    repository: Repository<{ id: string; locationId: string; sortOrder: number }>,
    locationId: string,
    ids: string[],
    extraWhere?: Record<string, string>,
  ): Promise<void> {
    const rows = await repository.find({
      where: { locationId, ...(extraWhere ?? {}) } as never,
      select: ['id'],
    });
    const knownIds = new Set(rows.map((row) => row.id));
    if (ids.length !== knownIds.size || ids.some((id) => !knownIds.has(id))) {
      throw new BadRequestException(
        extraWhere
          ? 'Reorder list must include every item in this category exactly once'
          : 'Reorder list must include every item exactly once',
      );
    }

    const table = repository.metadata.tableName;
    const hasDeletedAt = Boolean(repository.metadata.deleteDateColumn);
    const hasUpdatedAt = Boolean(repository.metadata.updateDateColumn);
    const setClauses = ['"sortOrder" = v.sort_order'];
    if (hasUpdatedAt) setClauses.push('"updatedAt" = NOW()');

    const params: unknown[] = [ids, ids.map((_, index) => index), locationId];
    let where = 't.id = v.id AND t."locationId" = $3';
    if (hasDeletedAt) where += ' AND t."deletedAt" IS NULL';
    if (extraWhere) {
      for (const [column, value] of Object.entries(extraWhere)) {
        if (!/^[A-Za-z]+$/.test(column)) {
          throw new BadRequestException('Invalid reorder filter');
        }
        params.push(value);
        where += ` AND t."${column}" = $${params.length}`;
      }
    }

    await this.dataSource.query(
      `
      UPDATE "${table}" AS t
      SET ${setClauses.join(', ')}
      FROM unnest($1::varchar[], $2::int[]) AS v(id, sort_order)
      WHERE ${where}
      `,
      params,
    );
  }

  private resolveItemPricing(input: {
    isMultiPriced: boolean;
    variantPrices?: Array<{ variantId: string; price: number }> | null;
    isHalfServed: boolean;
    halfPrice: number | null | undefined;
    fullPrice: number | null | undefined;
    variants: MenuPriceVariant[];
  }): {
    isMultiPriced: boolean;
    variantPrices: MenuItemVariantPrice[];
    isHalfServed: boolean;
    halfPrice: number | null;
    fullPrice: number;
  } {
    if (input.isMultiPriced) {
      const variantPrices = normalizeVariantPrices(
        input.variantPrices ?? [],
        input.variants,
      );
      if (variantPrices.length === 0) {
        throw new BadRequestException(
          'Add at least one price for a procedure or product',
        );
      }
      return {
        isMultiPriced: true,
        variantPrices,
        isHalfServed: false,
        halfPrice: null,
        fullPrice: minVariantPrice(variantPrices) ?? 0,
      };
    }

    if (
      input.fullPrice == null ||
      Number.isNaN(Number(input.fullPrice))
    ) {
      throw new BadRequestException('Price is required');
    }
    this.assertItemPricing(input.isHalfServed, input.halfPrice);

    return {
      isMultiPriced: false,
      variantPrices: [],
      isHalfServed: Boolean(input.isHalfServed),
      halfPrice: input.isHalfServed ? (input.halfPrice ?? null) : null,
      fullPrice: Number(input.fullPrice),
    };
  }

  private assertItemPricing(
    isHalfServed: boolean,
    halfPrice: number | null | undefined,
  ): void {
    if (isHalfServed && (halfPrice == null || Number.isNaN(Number(halfPrice)))) {
      throw new BadRequestException(
        'Half price is required when the item is served as half',
      );
    }
  }

  private assertImageUrl(imageUrl: string | null | undefined): void {
    if (!imageUrl) return;
    if (imageUrl.startsWith('data:')) {
      throw new BadRequestException('Upload the photo instead of embedding it');
    }
    if (imageUrl.length > MAX_IMAGE_URL_LENGTH) {
      throw new BadRequestException('Image URL is too long');
    }
  }
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}
