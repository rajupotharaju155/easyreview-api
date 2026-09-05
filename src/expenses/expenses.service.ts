import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { IsNull, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import {
  istCalendarMonthRange,
  istThisAndLastMonth,
} from '../subscriptions/utils/ist-date.util';
import { CreateExpenseCategoryDto } from './dto/create-expense-category.dto';
import { CreateExpenseDto } from './dto/create-expense.dto';
import { HqExpenseCategoriesQueryDto } from './dto/hq-expense-categories-query.dto';
import { HqExpenseSummaryDto } from './dto/hq-expense-summary.dto';
import { HqExpensesQueryDto } from './dto/hq-expenses-query.dto';
import { UpdateExpenseCategoryDto } from './dto/update-expense-category.dto';
import { UpdateExpenseDto } from './dto/update-expense.dto';
import { ExpenseCategory } from './entities/expense-category.entity';
import { Expense } from './entities/expense.entity';

function toCount(value: unknown): number {
  const n = Number(value);
  return Number.isFinite(n) ? n : 0;
}

@Injectable()
export class ExpensesService {
  constructor(
    @InjectRepository(Expense)
    private readonly expenseRepository: Repository<Expense>,
    @InjectRepository(ExpenseCategory)
    private readonly categoryRepository: Repository<ExpenseCategory>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  async listCategories(
    query: HqExpenseCategoriesQueryDto = {},
  ): Promise<ExpenseCategory[]> {
    return this.categoryRepository.find({
      where: query.includeArchived ? undefined : { archivedAt: IsNull() },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async createCategory(
    dto: CreateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const name = dto.name.trim();
    await this.assertUniqueCategoryName(name);
    const sortOrder = await this.nextSortOrder();
    return this.categoryRepository.save(
      this.categoryRepository.create({
        name,
        sortOrder,
        archivedAt: null,
      }),
    );
  }

  async updateCategory(
    categoryId: string,
    dto: UpdateExpenseCategoryDto,
  ): Promise<ExpenseCategory> {
    const category = await this.requireCategory(categoryId);

    if (dto.name !== undefined) {
      const name = dto.name.trim();
      if (!name) throw new BadRequestException('Category name is required');
      await this.assertUniqueCategoryName(name, categoryId);
      category.name = name;
    }

    if (dto.archived === true && !category.archivedAt) {
      category.archivedAt = new Date();
    }
    if (dto.archived === false) {
      category.archivedAt = null;
    }

    return this.categoryRepository.save(category);
  }

  async deleteCategory(categoryId: string): Promise<void> {
    await this.requireCategory(categoryId);
    const expenseCount = await this.expenseRepository.count({
      where: { categoryId },
    });
    if (expenseCount > 0) {
      throw new BadRequestException(
        'Archive this category instead. It still has expenses.',
      );
    }
    await this.categoryRepository.delete({ id: categoryId });
  }

  async findAllForHq(
    query: HqExpensesQueryDto,
  ): Promise<PaginatedResponseDto<Expense>> {
    const {
      page = 1,
      limit = 10,
      categoryId,
      locationId,
      orderId,
      search,
      month,
    } = query;
    const qb = this.expenseRepository
      .createQueryBuilder('expense')
      .leftJoinAndSelect('expense.category', 'category')
      .leftJoinAndSelect('expense.location', 'location')
      .leftJoinAndSelect('expense.order', 'order')
      .orderBy('expense.incurredAt', 'DESC')
      .addOrderBy('expense.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (categoryId) {
      qb.andWhere('expense.categoryId = :categoryId', { categoryId });
    }
    if (locationId) {
      qb.andWhere('expense.locationId = :locationId', { locationId });
    }
    if (orderId) {
      qb.andWhere('expense.orderId = :orderId', { orderId });
    }
    if (month) {
      const [year, monthNumber] = month.split('-').map(Number);
      const range = istCalendarMonthRange(year, monthNumber);
      qb.andWhere(
        'expense.incurredAt >= :monthFrom AND expense.incurredAt <= :monthTo',
        { monthFrom: range.from, monthTo: range.to },
      );
    }
    const term = search?.trim();
    if (term) {
      qb.andWhere(
        `(
          expense.id ILIKE :term
          OR COALESCE(expense.vendor, '') ILIKE :term
          OR COALESCE(expense.notes, '') ILIKE :term
          OR COALESCE(category.name, '') ILIKE :term
          OR COALESCE(location.name, '') ILIKE :term
          OR COALESCE(order.businessNameSnapshot, '') ILIKE :term
          OR COALESCE(order.designName, '') ILIKE :term
        )`,
        { term: `%${term}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findSummaryForHq(): Promise<HqExpenseSummaryDto> {
    const { thisMonth, lastMonth } = istThisAndLastMonth();
    const raw = await this.expenseRepository
      .createQueryBuilder('expense')
      .select(`COALESCE(SUM(expense.amount), 0)`, 'lifetimeAmount')
      .addSelect(`COUNT(*)`, 'lifetimeCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN expense.incurredAt >= :thisFrom AND expense.incurredAt <= :thisTo THEN expense.amount ELSE 0 END), 0)`,
        'thisMonthAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN expense.incurredAt >= :thisFrom AND expense.incurredAt <= :thisTo THEN 1 END)`,
        'thisMonthCount',
      )
      .addSelect(
        `COALESCE(SUM(CASE WHEN expense.incurredAt >= :lastFrom AND expense.incurredAt <= :lastTo THEN expense.amount ELSE 0 END), 0)`,
        'lastMonthAmount',
      )
      .addSelect(
        `COUNT(CASE WHEN expense.incurredAt >= :lastFrom AND expense.incurredAt <= :lastTo THEN 1 END)`,
        'lastMonthCount',
      )
      .setParameters({
        thisFrom: thisMonth.from,
        thisTo: thisMonth.to,
        lastFrom: lastMonth.from,
        lastTo: lastMonth.to,
      })
      .getRawOne<{
        lifetimeAmount: string | number;
        lifetimeCount: string | number;
        thisMonthAmount: string | number;
        thisMonthCount: string | number;
        lastMonthAmount: string | number;
        lastMonthCount: string | number;
      }>();

    return new HqExpenseSummaryDto({
      currency: 'INR',
      lifetime: {
        amount: toCount(raw?.lifetimeAmount),
        count: toCount(raw?.lifetimeCount),
      },
      thisMonth: {
        amount: toCount(raw?.thisMonthAmount),
        count: toCount(raw?.thisMonthCount),
        from: thisMonth.from,
        to: thisMonth.to,
      },
      lastMonth: {
        amount: toCount(raw?.lastMonthAmount),
        count: toCount(raw?.lastMonthCount),
        from: lastMonth.from,
        to: lastMonth.to,
      },
    });
  }

  async findOneForHq(id: string): Promise<Expense> {
    const expense = await this.expenseRepository.findOne({
      where: { id },
      relations: { category: true, location: true, order: true },
    });
    if (!expense) {
      throw new NotFoundException(`Expense with id "${id}" not found`);
    }
    return expense;
  }

  async createForHq(dto: CreateExpenseDto): Promise<Expense> {
    const category = await this.requireActiveCategory(dto.categoryId);
    await this.assertOptionalLocation(dto.locationId);
    await this.assertOptionalOrder(dto.orderId);

    const expense = this.expenseRepository.create({
      categoryId: category.id,
      amount: dto.amount,
      currency: 'INR',
      incurredAt: dto.incurredAt,
      vendor: dto.vendor?.trim() || null,
      paymentMethod: dto.paymentMethod ?? null,
      notes: dto.notes?.trim() || null,
      orderId: dto.orderId ?? null,
      locationId: dto.locationId ?? null,
    });
    const saved = await this.expenseRepository.save(expense);
    return this.findOneForHq(saved.id);
  }

  async updateForHq(id: string, dto: UpdateExpenseDto): Promise<Expense> {
    const expense = await this.findOneForHq(id);

    if (dto.categoryId !== undefined && dto.categoryId !== expense.categoryId) {
      const category = await this.requireActiveCategory(dto.categoryId);
      expense.categoryId = category.id;
    }
    if (dto.amount !== undefined) expense.amount = dto.amount;
    if (dto.incurredAt !== undefined) expense.incurredAt = dto.incurredAt;
    if (dto.vendor !== undefined) expense.vendor = dto.vendor;
    if (dto.paymentMethod !== undefined) {
      expense.paymentMethod = dto.paymentMethod;
    }
    if (dto.notes !== undefined) expense.notes = dto.notes;
    if (dto.orderId !== undefined) {
      await this.assertOptionalOrder(dto.orderId ?? undefined);
      expense.orderId = dto.orderId;
    }
    if (dto.locationId !== undefined) {
      await this.assertOptionalLocation(dto.locationId ?? undefined);
      expense.locationId = dto.locationId;
    }

    await this.expenseRepository.save(expense);
    return this.findOneForHq(id);
  }

  async removeForHq(id: string): Promise<Expense> {
    const expense = await this.findOneForHq(id);
    await this.expenseRepository.delete(id);
    return expense;
  }

  private async requireCategory(categoryId: string): Promise<ExpenseCategory> {
    const category = await this.categoryRepository.findOne({
      where: { id: categoryId },
    });
    if (!category) {
      throw new NotFoundException(
        `Expense category with id "${categoryId}" not found`,
      );
    }
    return category;
  }

  private async requireActiveCategory(
    categoryId: string,
  ): Promise<ExpenseCategory> {
    const category = await this.requireCategory(categoryId);
    if (category.archivedAt) {
      throw new BadRequestException(
        'This category is archived. Restore it before adding expenses.',
      );
    }
    return category;
  }

  private async assertOptionalLocation(
    locationId: string | undefined,
  ): Promise<void> {
    if (!locationId) return;
    const location = await this.locationRepository.findOne({
      where: { id: locationId },
    });
    if (!location) {
      throw new NotFoundException(`Location with id "${locationId}" not found`);
    }
  }

  private async assertOptionalOrder(
    orderId: string | undefined,
  ): Promise<void> {
    if (!orderId) return;
    const order = await this.orderRepository.findOne({
      where: { id: orderId },
    });
    if (!order) {
      throw new NotFoundException(`Order with id "${orderId}" not found`);
    }
  }

  private async assertUniqueCategoryName(
    name: string,
    excludeId?: string,
  ): Promise<void> {
    const qb = this.categoryRepository
      .createQueryBuilder('category')
      .where('LOWER(category.name) = LOWER(:name)', { name });
    if (excludeId) {
      qb.andWhere('category.id != :excludeId', { excludeId });
    }
    const conflict = await qb.getOne();
    if (conflict) {
      throw new ConflictException('Category already exists');
    }
  }

  private async nextSortOrder(): Promise<number> {
    const raw = await this.categoryRepository
      .createQueryBuilder('category')
      .select('MAX(category.sortOrder)', 'max')
      .getRawOne<{ max: string | number | null }>();
    return (Number(raw?.max) || 0) + 1;
  }
}
