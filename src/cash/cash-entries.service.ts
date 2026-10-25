import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { In, Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import {
  addMonthsToYearMonth,
  formatIsoDateParts,
  lastDayOfMonth,
  parseIsoDate,
  todayIst,
} from '../subscriptions/utils/ist-date.util';
import { toPaise, toRupees } from '../common/utils/money';
import { LocationAccessService } from '../locations/location-access.service';
import { CashCategoriesService } from './cash-categories.service';
import { CashEntriesQueryDto } from './dto/cash-entries-query.dto';
import {
  CashCategorySummaryQueryDto,
  CashMonthlySummaryQueryDto,
} from './dto/cash-summary-query.dto';
import {
  CreateCashEntriesDto,
  CreateCashEntryDto,
} from './dto/create-cash-entry.dto';
import { UpdateCashEntryDto } from './dto/update-cash-entry.dto';
import { CashCategory } from './entities/cash-category.entity';
import { CashEntry } from './entities/cash-entry.entity';
import { Invoice } from '../invoices/entities/invoice.entity';
import { InvoiceStatus } from '../invoices/enums/invoice-status.enum';
import { CashEntryType } from './enums/cash-entry-type.enum';
import { CashPaymentMethod } from './enums/cash-payment-method.enum';

export type CashEntryResponse = {
  id: string;
  type: CashEntryType;
  amount: number;
  entryDate: string;
  category: { id: string; name: string; systemKey: string | null };
  paymentMethod: CashPaymentMethod | null;
  partyName: string | null;
  referenceNumber: string | null;
  notes: string | null;
  /** Set for payments against an invoice; those are managed from the invoice. */
  invoice: { id: string; invoiceNumber: string | null } | null;
  createdAt: Date;
  updatedAt: Date;
};

export type CashMonthTotals = {
  /** YYYY-MM */
  month: string;
  moneyIn: number;
  moneyOut: number;
  net: number;
};

export type CashCategoryTotal = {
  categoryId: string;
  name: string;
  systemKey: string | null;
  amount: number;
  count: number;
};

export type CashCategorySummary = CashMonthTotals & {
  income: CashCategoryTotal[];
  expense: CashCategoryTotal[];
  /** Unpaid balance on invoices issued in this month. */
  toCollect: number;
};

export type CashLifetimeSummary = {
  moneyIn: number;
  moneyOut: number;
  net: number;
  /** Unpaid balance on all issued invoices. */
  toCollect: number;
};

const DEFAULT_SUMMARY_MONTHS = 6;

@Injectable()
export class CashEntriesService {
  constructor(
    @InjectRepository(CashEntry)
    private readonly entryRepository: Repository<CashEntry>,
    @InjectRepository(CashCategory)
    private readonly categoryRepository: Repository<CashCategory>,
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    private readonly categoriesService: CashCategoriesService,
    private readonly locationAccess: LocationAccessService,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async list(
    locationId: string,
    query: CashEntriesQueryDto,
  ): Promise<PaginatedResponseDto<CashEntryResponse>> {
    await this.locationAccess.requireOwned(locationId);
    const { page = 1, limit = 10 } = query;

    const qb = this.entryRepository
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.category', 'category')
      .leftJoin('entry.invoice', 'invoice')
      .addSelect(['invoice.id', 'invoice.invoiceNumber'])
      .where('entry.locationId = :locationId', { locationId });

    if (query.type) qb.andWhere('entry.type = :type', { type: query.type });
    if (query.categoryId) {
      qb.andWhere('entry.categoryId = :categoryId', {
        categoryId: query.categoryId,
      });
    }
    if (query.from) {
      qb.andWhere('entry.entryDate >= :from', { from: query.from });
    }
    if (query.to) qb.andWhere('entry.entryDate <= :to', { to: query.to });
    if (query.search) {
      const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        `(entry.partyName ILIKE :term OR entry.referenceNumber ILIKE :term
          OR entry.notes ILIKE :term OR invoice.invoiceNumber ILIKE :term)`,
        { term },
      );
    }

    const [entries, total] = await qb
      .orderBy('entry.entryDate', 'DESC')
      .addOrderBy('entry.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(
      entries.map((entry) => this.toResponse(entry)),
      total,
      page,
      limit,
    );
  }

  /** Saves all entries in one transaction, or none if any is invalid. */
  async createMany(
    locationId: string,
    dto: CreateCashEntriesDto,
  ): Promise<{ created: number }> {
    await this.locationAccess.requireOwned(locationId);
    const checkedCategories = new Set<string>();
    const entries: CashEntry[] = [];
    for (const item of dto.entries) {
      entries.push(
        await this.buildManualEntry(locationId, item, checkedCategories),
      );
    }
    await this.entryRepository.manager.transaction((manager) =>
      manager.save(entries),
    );
    return { created: entries.length };
  }

  async update(
    locationId: string,
    entryId: string,
    dto: UpdateCashEntryDto,
  ): Promise<CashEntryResponse> {
    await this.locationAccess.requireOwned(locationId);
    const entry = await this.requireEntry(locationId, entryId);
    this.assertManual(entry);

    if (dto.categoryId !== undefined && dto.categoryId !== entry.categoryId) {
      await this.categoriesService.requireUsableCategory(
        locationId,
        dto.categoryId,
        entry.type,
      );
    }
    if (dto.entryDate !== undefined) this.assertNotFuture(dto.entryDate);

    await this.entryRepository.update(entry.id, {
      ...(dto.categoryId !== undefined ? { categoryId: dto.categoryId } : {}),
      ...(dto.amount !== undefined ? { amount: dto.amount } : {}),
      ...(dto.entryDate !== undefined ? { entryDate: dto.entryDate } : {}),
      ...(dto.paymentMethod !== undefined
        ? { paymentMethod: dto.paymentMethod }
        : {}),
      ...(dto.partyName !== undefined ? { partyName: dto.partyName } : {}),
      ...(dto.referenceNumber !== undefined
        ? { referenceNumber: dto.referenceNumber }
        : {}),
      ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
    });
    return this.toResponse(await this.requireEntry(locationId, entry.id));
  }

  /** Soft delete; invoice payments are removed from the invoice instead. */
  async remove(locationId: string, entryId: string): Promise<void> {
    await this.locationAccess.requireOwned(locationId);
    const entry = await this.requireEntry(locationId, entryId);
    this.assertManual(entry);
    await this.entryRepository.softDelete({ id: entry.id });
  }

  /** Money in, money out and net for each of the last N months. */
  async monthlySummary(
    locationId: string,
    query: CashMonthlySummaryQueryDto,
  ): Promise<CashMonthTotals[]> {
    await this.locationAccess.requireOwned(locationId);
    const months = query.months ?? DEFAULT_SUMMARY_MONTHS;
    const { year, month } = parseIsoDate(todayIst());
    const first = addMonthsToYearMonth(year, month, -(months - 1));
    const start = formatIsoDateParts(first.year, first.month, 1);
    const end = formatIsoDateParts(year, month, lastDayOfMonth(year, month));

    const rows: Array<{ month: string; moneyIn: string; moneyOut: string }> =
      await this.entryRepository
        .createQueryBuilder('entry')
        .select(`to_char(entry.entryDate, 'YYYY-MM')`, 'month')
        .addSelect(
          `COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = :income), 0)`,
          'moneyIn',
        )
        .addSelect(
          `COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = :expense), 0)`,
          'moneyOut',
        )
        .where('entry.locationId = :locationId', { locationId })
        .andWhere('entry.entryDate BETWEEN :start AND :end', { start, end })
        .setParameters({
          income: CashEntryType.INCOME,
          expense: CashEntryType.EXPENSE,
        })
        .groupBy(`to_char(entry.entryDate, 'YYYY-MM')`)
        .getRawMany();

    const byMonth = new Map(rows.map((row) => [row.month, row]));
    return Array.from({ length: months }, (_, index) => {
      const ym = addMonthsToYearMonth(first.year, first.month, index);
      const key = `${ym.year}-${String(ym.month).padStart(2, '0')}`;
      const row = byMonth.get(key);
      return monthTotals(
        key,
        Number(row?.moneyIn ?? 0),
        Number(row?.moneyOut ?? 0),
      );
    });
  }

  /** Totals per category for one month. */
  async categorySummary(
    locationId: string,
    query: CashCategorySummaryQueryDto,
  ): Promise<CashCategorySummary> {
    await this.locationAccess.requireOwned(locationId);
    const month = query.month ?? todayIst().slice(0, 7);
    const [year, monthNumber] = month.split('-').map(Number);
    const start = formatIsoDateParts(year, monthNumber, 1);
    const end = formatIsoDateParts(
      year,
      monthNumber,
      lastDayOfMonth(year, monthNumber),
    );

    const rows: Array<{
      categoryId: string;
      type: CashEntryType;
      amount: string;
      count: string;
    }> = await this.entryRepository
      .createQueryBuilder('entry')
      .select('entry.categoryId', 'categoryId')
      .addSelect('entry.type', 'type')
      .addSelect('SUM(entry.amount)', 'amount')
      .addSelect('COUNT(*)', 'count')
      .where('entry.locationId = :locationId', { locationId })
      .andWhere('entry.entryDate BETWEEN :start AND :end', { start, end })
      .groupBy('entry.categoryId')
      .addGroupBy('entry.type')
      .getRawMany();

    const categories = rows.length
      ? await this.categoryRepository.find({
          where: { id: In(rows.map((row) => row.categoryId)) },
        })
      : [];
    const categoryById = new Map(categories.map((c) => [c.id, c]));

    const totalsFor = (type: CashEntryType): CashCategoryTotal[] =>
      rows
        .filter((row) => row.type === type)
        .map((row) => {
          const category = categoryById.get(row.categoryId);
          return {
            categoryId: row.categoryId,
            name: category?.name ?? 'Unknown',
            systemKey: category?.systemKey ?? null,
            amount: Number(row.amount),
            count: Number(row.count),
          };
        })
        .sort((a, b) => b.amount - a.amount);

    const income = totalsFor(CashEntryType.INCOME);
    const expense = totalsFor(CashEntryType.EXPENSE);
    const sum = (list: CashCategoryTotal[]) =>
      toRupees(list.reduce((total, item) => total + toPaise(item.amount), 0));

    return {
      ...monthTotals(month, sum(income), sum(expense)),
      income,
      expense,
      toCollect: await this.unpaidInvoiceBalance(locationId, { start, end }),
    };
  }

  /** All-time money in, money out and net, plus everything still unpaid. */
  async lifetimeSummary(locationId: string): Promise<CashLifetimeSummary> {
    await this.locationAccess.requireOwned(locationId);
    const row: { moneyIn: string | null; moneyOut: string | null } | undefined =
      await this.entryRepository
        .createQueryBuilder('entry')
        .select(
          `COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = :income), 0)`,
          'moneyIn',
        )
        .addSelect(
          `COALESCE(SUM(entry.amount) FILTER (WHERE entry.type = :expense), 0)`,
          'moneyOut',
        )
        .where('entry.locationId = :locationId', { locationId })
        .setParameters({
          income: CashEntryType.INCOME,
          expense: CashEntryType.EXPENSE,
        })
        .getRawOne();
    const { moneyIn, moneyOut, net } = monthTotals(
      '',
      Number(row?.moneyIn ?? 0),
      Number(row?.moneyOut ?? 0),
    );
    return {
      moneyIn,
      moneyOut,
      net,
      toCollect: await this.unpaidInvoiceBalance(locationId),
    };
  }

  /** Unpaid balance on issued invoices, optionally only those issued in a date range. */
  private async unpaidInvoiceBalance(
    locationId: string,
    issued?: { start: string; end: string },
  ): Promise<number> {
    const query = this.invoiceRepository
      .createQueryBuilder('invoice')
      .select(
        'COALESCE(SUM(invoice.grandTotal - invoice.amountPaid), 0)',
        'balance',
      )
      .where('invoice.locationId = :locationId', { locationId })
      .andWhere('invoice.status = :issuedStatus', {
        issuedStatus: InvoiceStatus.ISSUED,
      });
    if (issued) {
      query.andWhere('invoice.issueDate BETWEEN :start AND :end', issued);
    }
    const row: { balance: string } | undefined = await query.getRawOne();
    return Number(row?.balance ?? 0);
  }

  private async requireEntry(
    locationId: string,
    entryId: string,
  ): Promise<CashEntry> {
    const entry = await this.entryRepository
      .createQueryBuilder('entry')
      .innerJoinAndSelect('entry.category', 'category')
      .leftJoin('entry.invoice', 'invoice')
      .addSelect(['invoice.id', 'invoice.invoiceNumber'])
      .where('entry.id = :entryId', { entryId })
      .andWhere('entry.locationId = :locationId', { locationId })
      .getOne();
    if (!entry) {
      throw new NotFoundException('Entry not found');
    }
    return entry;
  }

  private assertManual(entry: CashEntry): void {
    if (entry.invoiceId) {
      throw new BadRequestException(
        'This is an invoice payment. Change it from the invoice.',
      );
    }
  }

  private async buildManualEntry(
    locationId: string,
    dto: CreateCashEntryDto,
    checkedCategories = new Set<string>(),
  ): Promise<CashEntry> {
    const categoryKey = `${dto.type}:${dto.categoryId}`;
    if (!checkedCategories.has(categoryKey)) {
      await this.categoriesService.requireUsableCategory(
        locationId,
        dto.categoryId,
        dto.type,
      );
      checkedCategories.add(categoryKey);
    }
    const entryDate = dto.entryDate ?? todayIst();
    this.assertNotFuture(entryDate);
    return new CashEntry({
      locationId,
      type: dto.type,
      categoryId: dto.categoryId,
      amount: dto.amount,
      entryDate,
      paymentMethod: dto.paymentMethod ?? null,
      partyName: dto.partyName ?? null,
      contactId: null,
      invoiceId: null,
      referenceNumber: dto.referenceNumber ?? null,
      notes: dto.notes ?? null,
      createdByUserId: this.currentUserUtil.getCurrentUserId(),
    });
  }

  private assertNotFuture(entryDate: string): void {
    if (entryDate > todayIst()) {
      throw new BadRequestException('Entry date cannot be in the future');
    }
  }

  private toResponse(entry: CashEntry): CashEntryResponse {
    return {
      id: entry.id,
      type: entry.type,
      amount: entry.amount,
      entryDate: entry.entryDate,
      category: {
        id: entry.category.id,
        name: entry.category.name,
        systemKey: entry.category.systemKey,
      },
      paymentMethod: entry.paymentMethod,
      partyName: entry.partyName,
      referenceNumber: entry.referenceNumber,
      notes: entry.notes,
      invoice: entry.invoice
        ? { id: entry.invoice.id, invoiceNumber: entry.invoice.invoiceNumber }
        : null,
      createdAt: entry.createdAt,
      updatedAt: entry.updatedAt,
    };
  }
}

function monthTotals(
  month: string,
  moneyIn: number,
  moneyOut: number,
): CashMonthTotals {
  return {
    month,
    moneyIn,
    moneyOut,
    net: toRupees(toPaise(moneyIn) - toPaise(moneyOut)),
  };
}
