import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, IsNull, Repository } from 'typeorm';
import { generateId } from '../common/utils/id';
import { LocationAccessService } from '../locations/location-access.service';
import {
  INVOICE_PAYMENTS_CATEGORY_NAME,
  INVOICE_PAYMENTS_SYSTEM_KEY,
} from './cash-system-categories';
import {
  CashCategoriesQueryDto,
  CreateCashCategoryDto,
  UpdateCashCategoryDto,
} from './dto/cash-category.dto';
import { CashCategory } from './entities/cash-category.entity';
import { CashEntry } from './entities/cash-entry.entity';
import { CashEntryType } from './enums/cash-entry-type.enum';

export type CashCategoryResponse = {
  id: string;
  type: CashEntryType;
  name: string;
  systemKey: string | null;
  /** Reserved categories can't be picked, renamed or archived. */
  isReserved: boolean;
  archived: boolean;
};

@Injectable()
export class CashCategoriesService {
  constructor(
    @InjectRepository(CashCategory)
    private readonly categoryRepository: Repository<CashCategory>,
    @InjectRepository(CashEntry)
    private readonly entryRepository: Repository<CashEntry>,
    private readonly locationAccess: LocationAccessService,
  ) {}

  async list(
    locationId: string,
    query: CashCategoriesQueryDto,
  ): Promise<CashCategoryResponse[]> {
    await this.locationAccess.requireOwned(locationId);

    const categories = await this.categoryRepository.find({
      where: {
        locationId,
        ...(query.type ? { type: query.type } : {}),
        ...(query.includeArchived ? {} : { archivedAt: IsNull() }),
      },
      order: { type: 'ASC', createdAt: 'ASC' },
    });
    return categories.map((category) => this.toResponse(category));
  }

  async create(
    locationId: string,
    dto: CreateCashCategoryDto,
  ): Promise<CashCategoryResponse> {
    await this.locationAccess.requireOwned(locationId);
    await this.assertNameAvailable(locationId, dto.type, dto.name);

    const category = await this.categoryRepository.save(
      new CashCategory({
        locationId,
        type: dto.type,
        name: dto.name,
        systemKey: null,
        archivedAt: null,
      }),
    );
    return this.toResponse(category);
  }

  async update(
    locationId: string,
    categoryId: string,
    dto: UpdateCashCategoryDto,
  ): Promise<CashCategoryResponse> {
    await this.locationAccess.requireOwned(locationId);
    const category = await this.requireCategory(locationId, categoryId);
    if (category.systemKey === INVOICE_PAYMENTS_SYSTEM_KEY) {
      throw new BadRequestException('This category is managed by invoices');
    }

    if (dto.name !== undefined && dto.name !== category.name) {
      await this.assertNameAvailable(
        locationId,
        category.type,
        dto.name,
        category.id,
      );
      category.name = dto.name;
    }
    if (dto.archived === false && category.archivedAt) {
      await this.assertNameAvailable(
        locationId,
        category.type,
        category.name,
        category.id,
      );
      category.archivedAt = null;
    } else if (dto.archived === true && !category.archivedAt) {
      category.archivedAt = new Date();
    }

    return this.toResponse(await this.categoryRepository.save(category));
  }

  /** Deletes an unused category; archives one that past entries refer to. */
  async remove(
    locationId: string,
    categoryId: string,
  ): Promise<{ archived: boolean }> {
    await this.locationAccess.requireOwned(locationId);
    const category = await this.requireCategory(locationId, categoryId);
    if (category.systemKey === INVOICE_PAYMENTS_SYSTEM_KEY) {
      throw new BadRequestException('This category is managed by invoices');
    }

    const used = await this.entryRepository.exists({
      where: { categoryId: category.id },
      withDeleted: true,
    });
    if (used) {
      if (!category.archivedAt) {
        await this.categoryRepository.update(category.id, {
          archivedAt: new Date(),
        });
      }
      return { archived: true };
    }
    await this.categoryRepository.delete({ id: category.id });
    return { archived: false };
  }

  /**
   * Id of the reserved "Invoice payments" income category, created the first
   * time a business records an invoice payment. Businesses start with no
   * categories otherwise.
   */
  async invoicePaymentsCategoryId(
    locationId: string,
    manager: EntityManager,
  ): Promise<string> {
    await manager
      .createQueryBuilder()
      .insert()
      .into(CashCategory)
      .values({
        // Query-builder inserts skip @BeforeInsert, so set the id here.
        id: generateId(),
        locationId,
        type: CashEntryType.INCOME,
        name: INVOICE_PAYMENTS_CATEGORY_NAME,
        systemKey: INVOICE_PAYMENTS_SYSTEM_KEY,
        archivedAt: null,
      })
      .orIgnore()
      .execute();
    const category = await manager.findOneOrFail(CashCategory, {
      where: { locationId, systemKey: INVOICE_PAYMENTS_SYSTEM_KEY },
    });
    return category.id;
  }

  /** A category a manual entry of this type may use. */
  async requireUsableCategory(
    locationId: string,
    categoryId: string,
    type: CashEntryType,
  ): Promise<CashCategory> {
    const category = await this.requireCategory(locationId, categoryId);
    if (category.type !== type) {
      throw new BadRequestException(
        `Pick an ${type} category for this ${type} entry`,
      );
    }
    if (category.systemKey === INVOICE_PAYMENTS_SYSTEM_KEY) {
      throw new BadRequestException(
        'Invoice payments are recorded from the invoice',
      );
    }
    if (category.archivedAt) {
      throw new BadRequestException('This category is archived');
    }
    return category;
  }

  toResponse(category: CashCategory): CashCategoryResponse {
    return {
      id: category.id,
      type: category.type,
      name: category.name,
      systemKey: category.systemKey,
      isReserved: category.systemKey === INVOICE_PAYMENTS_SYSTEM_KEY,
      archived: category.archivedAt !== null,
    };
  }

  private async requireCategory(
    locationId: string,
    categoryId: string,
  ): Promise<CashCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId, locationId },
    });
    if (!category) {
      throw new NotFoundException('Category not found');
    }
    return category;
  }

  private async assertNameAvailable(
    locationId: string,
    type: CashEntryType,
    name: string,
    exceptId?: string,
  ): Promise<void> {
    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('category.locationId = :locationId', { locationId })
      .andWhere('category.type = :type', { type })
      .andWhere('category.archivedAt IS NULL')
      .andWhere('LOWER(category.name) = LOWER(:name)', { name: name.trim() });
    if (exceptId) qb.andWhere('category.id != :exceptId', { exceptId });
    if (await qb.getExists()) {
      throw new ConflictException(`A category named "${name}" already exists`);
    }
  }
}
