import {
  BadRequestException,
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { DataSource, EntityManager, Repository } from 'typeorm';
import { CashCategoriesService } from '../cash/cash-categories.service';
import { CashEntry } from '../cash/entities/cash-entry.entity';
import { CashEntryType } from '../cash/enums/cash-entry-type.enum';
import { CashPaymentMethod } from '../cash/enums/cash-payment-method.enum';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { CustomersService } from '../contacts/customers.service';
import {
  formatIsoDateParts,
  parseIsoDate,
  todayIst,
} from '../subscriptions/utils/ist-date.util';
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { CreateInvoicePaymentDto } from './dto/create-invoice-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoiceBillToDto } from './dto/invoice-bill-to.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoiceItem } from './entities/invoice-item.entity';
import { InvoiceSettings } from './entities/invoice-settings.entity';
import { Invoice } from './entities/invoice.entity';
import {
  chargesGst,
  InvoiceDocumentType,
  requiresSupplierGstin,
} from './enums/invoice-document-type.enum';
import { InvoicePaymentStatus } from './enums/invoice-payment-status.enum';
import { InvoiceStatus } from './enums/invoice-status.enum';
import { stateNameFromCode } from './gst/gst-states';
import { gstinStateCode, isValidGstin } from './gst/gstin';
import {
  calculateInvoice,
  InvoiceCalculation,
  InvoiceCalculationError,
  type GstSupplyType,
  type InvoiceTotals,
} from './invoice-calculator';
import { financialYearOf, formatInvoiceNumber } from './invoice-number';
import { toPaise, toRupees } from '../common/utils/money';
import { LocationAccessService } from '../locations/location-access.service';
import { InvoiceSettingsService } from './invoice-settings.service';
import type { InvoiceBillTo, InvoiceSupplier } from './invoice-snapshots';

export type InvoiceItemResponse = {
  id: string;
  description: string;
  hsnSacCode: string | null;
  quantity: number;
  unit: string | null;
  unitPrice: number;
  discountAmount: number;
  taxableValue: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
  sortOrder: number;
};

/** A cash entry linked to the invoice, in the shape the invoice UI uses. */
export type InvoicePaymentResponse = {
  id: string;
  amount: number;
  paidOn: string;
  method: CashPaymentMethod | null;
  referenceNumber: string | null;
  notes: string | null;
  createdAt: Date;
};

export type InvoiceSummaryResponse = InvoiceTotals & {
  id: string;
  locationId: string;
  customerId: string | null;
  documentType: InvoiceDocumentType;
  status: InvoiceStatus;
  invoiceNumber: string | null;
  financialYear: string | null;
  issueDate: string | null;
  dueDate: string | null;
  placeOfSupplyStateCode: string | null;
  placeOfSupplyStateName: string | null;
  supplyType: GstSupplyType;
  currency: string;
  billTo: InvoiceBillTo;
  amountPaid: number;
  balanceDue: number;
  /** Null for drafts and cancelled invoices. */
  paymentStatus: InvoicePaymentStatus | null;
  isOverdue: boolean;
  issuedAt: Date | null;
  cancelledAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
};

export type InvoiceResponse = InvoiceSummaryResponse & {
  supplier: InvoiceSupplier | null;
  notes: string | null;
  terms: string | null;
  cancelReason: string | null;
  items: InvoiceItemResponse[];
  payments: InvoicePaymentResponse[];
};

export type InvoicePreviewResponse = InvoiceCalculation & {
  documentType: InvoiceDocumentType;
  placeOfSupplyStateCode: string | null;
  supplyType: GstSupplyType;
};

export type InvoiceDashboardResponse = {
  draftCount: number;
  overdueCount: number;
  overdueAmount: number;
};

type DraftInput = {
  documentType: InvoiceDocumentType;
  customerId: string | null;
  billTo: InvoiceBillTo;
  placeOfSupplyStateCode: string | null;
  items: Array<{
    description: string;
    hsnSacCode: string | null;
    quantity: number;
    unit: string | null;
    unitPrice: number;
    discountAmount: number;
    taxRate: number;
  }>;
};

@Injectable()
export class InvoicesService {
  constructor(
    @InjectRepository(Invoice)
    private readonly invoiceRepository: Repository<Invoice>,
    @InjectRepository(InvoiceItem)
    private readonly itemRepository: Repository<InvoiceItem>,
    @InjectRepository(CashEntry)
    private readonly cashEntryRepository: Repository<CashEntry>,
    private readonly settingsService: InvoiceSettingsService,
    private readonly locationAccess: LocationAccessService,
    private readonly customersService: CustomersService,
    private readonly cashCategoriesService: CashCategoriesService,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly dataSource: DataSource,
  ) {}

  /** Totals for an unsaved invoice, computed exactly as they would be stored. */
  async preview(
    locationId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoicePreviewResponse> {
    const { settings } = await this.settingsService.load(locationId);
    const draft = await this.buildDraftInput(locationId, settings, dto);
    const { supplyType, calculation } = this.calculate(settings, draft);
    return {
      ...calculation,
      documentType: draft.documentType,
      placeOfSupplyStateCode: draft.placeOfSupplyStateCode,
      supplyType,
    };
  }

  async list(
    locationId: string,
    query: InvoicesQueryDto,
  ): Promise<PaginatedResponseDto<InvoiceSummaryResponse>> {
    const { settings } = await this.settingsService.load(locationId);
    const { page = 1, limit = 10 } = query;
    const today = todayIst();

    const qb = this.invoiceRepository
      .createQueryBuilder('invoice')
      .where('invoice.locationId = :locationId', { locationId });

    if (query.status) {
      qb.andWhere('invoice.status = :status', { status: query.status });
    }
    if (query.paymentStatus) {
      qb.andWhere('invoice.status = :issued', {
        issued: InvoiceStatus.ISSUED,
      });
      if (query.paymentStatus === InvoicePaymentStatus.UNPAID) {
        qb.andWhere('invoice.amountPaid = 0');
      } else if (query.paymentStatus === InvoicePaymentStatus.PARTIALLY_PAID) {
        qb.andWhere(
          'invoice.amountPaid > 0 AND invoice.amountPaid < invoice.grandTotal',
        );
      } else {
        qb.andWhere('invoice.amountPaid >= invoice.grandTotal');
      }
    }
    if (query.overdue) {
      qb.andWhere('invoice.status = :issued', { issued: InvoiceStatus.ISSUED })
        .andWhere('invoice.amountPaid < invoice.grandTotal')
        .andWhere('invoice.dueDate < :today', { today });
    }
    if (query.customerId) {
      qb.andWhere('invoice.customerId = :customerId', {
        customerId: query.customerId,
      });
    }
    if (query.search) {
      const term = `%${query.search.replace(/[\\%_]/g, '\\$&')}%`;
      qb.andWhere(
        `(invoice.invoiceNumber ILIKE :term
          OR invoice.billTo ->> 'name' ILIKE :term
          OR invoice.billTo ->> 'companyName' ILIKE :term
          OR invoice.billTo ->> 'phone' ILIKE :term)`,
        { term },
      );
    }

    const [invoices, total] = await qb
      .orderBy('invoice.issueDate', 'DESC', 'NULLS FIRST')
      .addOrderBy('invoice.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit)
      .getManyAndCount();

    return new PaginatedResponseDto(
      invoices.map((invoice) =>
        this.toSummary(invoice, settings.stateCode, today),
      ),
      total,
      page,
      limit,
    );
  }

  /** Draft and overdue counts for the EasyCash overview. */
  async dashboard(locationId: string): Promise<InvoiceDashboardResponse> {
    await this.locationAccess.requireOwned(locationId);
    const row: Record<string, string | null> | undefined =
      await this.invoiceRepository
        .createQueryBuilder('invoice')
        .select([
          `COUNT(*) FILTER (WHERE invoice.status = :draft) AS "draftCount"`,
          `COUNT(*) FILTER (WHERE invoice.status = :issued AND invoice.amountPaid < invoice.grandTotal AND invoice.dueDate < :today) AS "overdueCount"`,
          `COALESCE(SUM(invoice.grandTotal - invoice.amountPaid) FILTER (WHERE invoice.status = :issued AND invoice.amountPaid < invoice.grandTotal AND invoice.dueDate < :today), 0) AS "overdueAmount"`,
        ])
        .where('invoice.locationId = :locationId', { locationId })
        .setParameters({
          draft: InvoiceStatus.DRAFT,
          issued: InvoiceStatus.ISSUED,
          today: todayIst(),
        })
        .getRawOne();

    const num = (key: string) => Number(row?.[key] ?? 0);
    return {
      draftCount: num('draftCount'),
      overdueCount: num('overdueCount'),
      overdueAmount: num('overdueAmount'),
    };
  }

  async get(locationId: string, invoiceId: string): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  async create(
    locationId: string,
    dto: CreateInvoiceDto,
  ): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    const draft = await this.buildDraftInput(locationId, settings, dto);
    const { calculation } = this.calculate(settings, draft);
    this.assertDueDate(dto.issueDate ?? null, dto.dueDate ?? null);

    const invoiceId = await this.dataSource.transaction(async (manager) => {
      const invoice = await manager.save(
        new Invoice({
          locationId,
          customerId: draft.customerId,
          documentType: draft.documentType,
          status: InvoiceStatus.DRAFT,
          issueDate: dto.issueDate ?? null,
          dueDate: dto.dueDate ?? null,
          placeOfSupplyStateCode: draft.placeOfSupplyStateCode,
          billTo: draft.billTo,
          supplier: null,
          ...calculation.totals,
          amountPaid: 0,
          notes: dto.notes !== undefined ? dto.notes : settings.defaultNotes,
          terms: dto.terms !== undefined ? dto.terms : settings.defaultTerms,
        }),
      );
      await this.replaceItems(manager, invoice.id, draft, calculation);
      return invoice.id;
    });

    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  async update(
    locationId: string,
    invoiceId: string,
    dto: UpdateInvoiceDto,
  ): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    const invoice = await this.requireInvoice(locationId, invoiceId, {
      items: true,
    });
    this.assertDraft(invoice);

    const recipientChanged =
      dto.customerId !== undefined || dto.billTo !== undefined;
    const customerId =
      dto.customerId !== undefined ? dto.customerId : invoice.customerId;
    const draft = await this.buildDraftInput(locationId, settings, {
      documentType: dto.documentType ?? invoice.documentType,
      customerId,
      // A saved customer always supplies its own details.
      billTo: customerId ? null : (dto.billTo ?? invoice.billTo),
      placeOfSupplyStateCode:
        dto.placeOfSupplyStateCode !== undefined
          ? dto.placeOfSupplyStateCode
          : recipientChanged
            ? null
            : invoice.placeOfSupplyStateCode,
      items:
        dto.items ??
        [...invoice.items]
          .sort((a, b) => a.sortOrder - b.sortOrder)
          .map((item) => ({
            description: item.description,
            hsnSacCode: item.hsnSacCode,
            quantity: item.quantity,
            unit: item.unit,
            unitPrice: item.unitPrice,
            discountAmount: item.discountAmount,
            taxRate: item.taxRate,
          })),
    });
    const { calculation } = this.calculate(settings, draft);

    const issueDate =
      dto.issueDate !== undefined ? dto.issueDate : invoice.issueDate;
    const dueDate = dto.dueDate !== undefined ? dto.dueDate : invoice.dueDate;
    this.assertDueDate(issueDate, dueDate);

    await this.dataSource.transaction(async (manager) => {
      await manager.update(Invoice, invoice.id, {
        customerId: draft.customerId,
        documentType: draft.documentType,
        issueDate,
        dueDate,
        placeOfSupplyStateCode: draft.placeOfSupplyStateCode,
        billTo: draft.billTo,
        ...calculation.totals,
        ...(dto.notes !== undefined ? { notes: dto.notes } : {}),
        ...(dto.terms !== undefined ? { terms: dto.terms } : {}),
      });
      await this.replaceItems(manager, invoice.id, draft, calculation);
    });

    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  /** Only drafts can be deleted. Issued invoices are cancelled instead. */
  async remove(locationId: string, invoiceId: string): Promise<void> {
    await this.locationAccess.requireOwned(locationId);
    const invoice = await this.requireInvoice(locationId, invoiceId);
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Issued invoices cannot be deleted. Cancel the invoice instead.',
      );
    }
    await this.invoiceRepository.delete({ id: invoice.id });
  }

  /**
   * Finalizes a draft: re-reads the customer and business details, recomputes
   * totals, assigns the next number for the financial year, and freezes the
   * supplier and recipient snapshots.
   */
  async issue(locationId: string, invoiceId: string): Promise<InvoiceResponse> {
    const { location, settings } = await this.settingsService.load(locationId);
    const invoice = await this.requireInvoice(locationId, invoiceId, {
      items: true,
    });
    this.assertDraft(invoice);

    if (!settings.id) {
      throw new BadRequestException(
        'Save your business invoice settings before issuing an invoice',
      );
    }
    if (requiresSupplierGstin(invoice.documentType)) {
      if (!settings.gstin) {
        throw new BadRequestException(
          'Add your GSTIN in invoice settings to issue a GST document',
        );
      }
    }

    // Saved customers may have changed since the draft was written.
    let billTo = invoice.billTo;
    if (invoice.customerId) {
      const customer = await this.customersService
        .requireCustomer(locationId, invoice.customerId)
        .catch(() => null);
      if (customer) billTo = this.customersService.toBillTo(customer);
    }

    const draft: DraftInput = {
      documentType: invoice.documentType,
      customerId: invoice.customerId,
      billTo,
      placeOfSupplyStateCode:
        invoice.placeOfSupplyStateCode ??
        this.defaultPlaceOfSupply(billTo, settings),
      items: [...invoice.items]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxRate: item.taxRate,
        })),
    };
    if (draft.items.length === 0) {
      throw new BadRequestException('Add at least one item before issuing');
    }
    if (chargesGst(draft.documentType) && !draft.placeOfSupplyStateCode) {
      throw new BadRequestException('Place of supply is required');
    }
    const { calculation } = this.calculate(settings, draft);
    if (calculation.totals.grandTotal <= 0) {
      throw new BadRequestException('Invoice total must be above zero');
    }

    const issueDate = invoice.issueDate ?? todayIst();
    const dueDate =
      invoice.dueDate ??
      (settings.defaultDueDays !== null
        ? addDays(issueDate, settings.defaultDueDays)
        : null);
    this.assertDueDate(issueDate, dueDate);
    const financialYear = financialYearOf(issueDate);

    await this.dataSource.transaction(async (manager) => {
      // Lock the draft so a double-click can't issue it twice.
      const locked = await manager.findOne(Invoice, {
        where: { id: invoice.id },
        lock: { mode: 'pessimistic_write' },
      });
      if (!locked || locked.status !== InvoiceStatus.DRAFT) {
        throw new ConflictException('Invoice has already been issued');
      }

      const sequence = await this.nextSequence(
        manager,
        locationId,
        financialYear,
      );
      await manager.update(Invoice, invoice.id, {
        status: InvoiceStatus.ISSUED,
        invoiceNumber: formatInvoiceNumber(
          settings.invoicePrefix,
          financialYear,
          sequence,
        ),
        financialYear,
        issueDate,
        dueDate,
        placeOfSupplyStateCode: draft.placeOfSupplyStateCode,
        billTo: draft.billTo,
        supplier: this.settingsService.toSupplier(settings, location),
        ...calculation.totals,
        issuedAt: new Date(),
      });
      await this.replaceItems(manager, invoice.id, draft, calculation);
    });

    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  async cancel(
    locationId: string,
    invoiceId: string,
    dto: CancelInvoiceDto,
  ): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    const invoice = await this.requireInvoice(locationId, invoiceId);
    if (invoice.status !== InvoiceStatus.ISSUED) {
      throw new BadRequestException('Only issued invoices can be cancelled');
    }
    if (invoice.amountPaid > 0) {
      throw new BadRequestException(
        'Remove the recorded payments before cancelling this invoice',
      );
    }

    await this.invoiceRepository.update(invoice.id, {
      status: InvoiceStatus.CANCELLED,
      cancelledAt: new Date(),
      cancelReason: dto.reason ?? null,
    });
    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  async addPayment(
    locationId: string,
    invoiceId: string,
    dto: CreateInvoicePaymentDto,
  ): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    await this.requireInvoice(locationId, invoiceId);
    const paidOn = dto.paidOn ?? todayIst();
    if (paidOn > todayIst()) {
      throw new BadRequestException('Payment date cannot be in the future');
    }

    await this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId, locationId },
        lock: { mode: 'pessimistic_write' },
      });
      if (!invoice || invoice.status !== InvoiceStatus.ISSUED) {
        throw new BadRequestException(
          'Payments can only be recorded on issued invoices',
        );
      }
      const balance = toPaise(invoice.grandTotal) - toPaise(invoice.amountPaid);
      if (toPaise(dto.amount) > balance) {
        throw new BadRequestException(
          `Amount is more than the balance due (₹${toRupees(balance).toFixed(2)})`,
        );
      }

      const customer = invoice.customerId
        ? await this.customersService
            .requireCustomer(locationId, invoice.customerId)
            .catch(() => null)
        : null;
      await manager.save(
        new CashEntry({
          locationId,
          type: CashEntryType.INCOME,
          categoryId:
            await this.cashCategoriesService.invoicePaymentsCategoryId(
              locationId,
              manager,
            ),
          amount: dto.amount,
          entryDate: paidOn,
          paymentMethod: dto.method,
          partyName: invoice.billTo.companyName ?? invoice.billTo.name,
          contactId: customer?.contactId ?? null,
          invoiceId,
          referenceNumber: dto.referenceNumber ?? null,
          notes: dto.notes ?? null,
          createdByUserId: this.currentUserUtil.getCurrentUserId(),
        }),
      );
      await manager.update(Invoice, invoiceId, {
        amountPaid: toRupees(toPaise(invoice.amountPaid) + toPaise(dto.amount)),
      });
    });

    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  async removePayment(
    locationId: string,
    invoiceId: string,
    paymentId: string,
  ): Promise<InvoiceResponse> {
    const { settings } = await this.settingsService.load(locationId);
    await this.requireInvoice(locationId, invoiceId);

    await this.dataSource.transaction(async (manager) => {
      const invoice = await manager.findOne(Invoice, {
        where: { id: invoiceId, locationId },
        lock: { mode: 'pessimistic_write' },
      });
      const payment = await manager.findOne(CashEntry, {
        where: { id: paymentId, invoiceId, locationId },
      });
      if (!invoice || !payment) {
        throw new NotFoundException('Payment not found');
      }
      // Hard delete, so amountPaid always equals the sum of linked entries.
      await manager.delete(CashEntry, { id: payment.id });
      await manager.update(Invoice, invoiceId, {
        amountPaid: toRupees(
          Math.max(0, toPaise(invoice.amountPaid) - toPaise(payment.amount)),
        ),
      });
    });

    return this.loadResponse(locationId, invoiceId, settings.stateCode);
  }

  /**
   * Resolves the recipient, document type and place of supply for a draft.
   * A saved customer wins over a one-off billTo.
   */
  private async buildDraftInput(
    locationId: string,
    settings: InvoiceSettings,
    input: {
      documentType?: InvoiceDocumentType;
      customerId?: string | null;
      billTo?: InvoiceBillToDto | InvoiceBillTo | null;
      placeOfSupplyStateCode?: string | null;
      items: CreateInvoiceDto['items'];
    },
  ): Promise<DraftInput> {
    let billTo: InvoiceBillTo;
    let customerId: string | null = null;
    if (input.customerId) {
      const customer = await this.customersService.requireCustomer(
        locationId,
        input.customerId,
      );
      customerId = customer.id;
      billTo = this.customersService.toBillTo(customer);
    } else if (input.billTo) {
      billTo = this.toBillTo(input.billTo);
    } else {
      throw new BadRequestException(
        'Choose a customer or enter bill-to details',
      );
    }

    const documentType =
      input.documentType ??
      (settings.gstin
        ? InvoiceDocumentType.TAX_INVOICE
        : InvoiceDocumentType.INVOICE);

    return {
      documentType,
      customerId,
      billTo,
      placeOfSupplyStateCode:
        input.placeOfSupplyStateCode ??
        this.defaultPlaceOfSupply(billTo, settings),
      items: input.items.map((item) => ({
        description: item.description,
        hsnSacCode: item.hsnSacCode ?? null,
        quantity: item.quantity,
        unit: item.unit ?? null,
        unitPrice: item.unitPrice,
        discountAmount: item.discountAmount ?? 0,
        taxRate: item.taxRate ?? 0,
      })),
    };
  }

  private calculate(
    settings: InvoiceSettings,
    draft: DraftInput,
  ): { supplyType: GstSupplyType; calculation: InvoiceCalculation } {
    const supplyType = supplyTypeOf(
      settings.stateCode,
      draft.placeOfSupplyStateCode,
    );
    try {
      const calculation = calculateInvoice(draft.items, {
        chargesGst: chargesGst(draft.documentType),
        supplyType,
        roundOffTotal: settings.roundOffTotal,
      });
      return { supplyType, calculation };
    } catch (error) {
      if (error instanceof InvoiceCalculationError) {
        throw new BadRequestException(error.message);
      }
      throw error;
    }
  }

  private defaultPlaceOfSupply(
    billTo: InvoiceBillTo,
    settings: InvoiceSettings,
  ): string | null {
    return billTo.stateCode ?? settings.stateCode ?? null;
  }

  private toBillTo(input: InvoiceBillToDto | InvoiceBillTo): InvoiceBillTo {
    const gstin = input.gstin ?? null;
    let stateCode = input.stateCode ?? null;
    if (gstin) {
      if (!isValidGstin(gstin)) {
        throw new BadRequestException('Bill-to GSTIN is not valid');
      }
      if (stateCode && stateCode !== gstinStateCode(gstin)) {
        throw new BadRequestException('Bill-to state does not match the GSTIN');
      }
      stateCode = gstinStateCode(gstin);
    }
    return {
      name: input.name,
      companyName: input.companyName ?? null,
      phone: input.phone ?? null,
      email: input.email ?? null,
      gstin,
      address: input.address ?? null,
      city: input.city ?? null,
      stateCode,
      pincode: input.pincode ?? null,
    };
  }

  private async replaceItems(
    manager: EntityManager,
    invoiceId: string,
    draft: DraftInput,
    calculation: InvoiceCalculation,
  ): Promise<void> {
    await manager.delete(InvoiceItem, { invoiceId });
    await manager.save(
      draft.items.map((item, index) => {
        const amounts = calculation.lines[index];
        return new InvoiceItem({
          invoiceId,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountAmount: amounts.discountAmount,
          taxableValue: amounts.taxableValue,
          taxRate: amounts.taxRate,
          cgstAmount: amounts.cgstAmount,
          sgstAmount: amounts.sgstAmount,
          igstAmount: amounts.igstAmount,
          lineTotal: amounts.lineTotal,
          sortOrder: index,
        });
      }),
    );
  }

  /** Next number for the year. Holds the sequence row lock until commit. */
  private async nextSequence(
    manager: EntityManager,
    locationId: string,
    financialYear: string,
  ): Promise<number> {
    const rows: Array<{ lastNumber: number }> = await manager.query(
      `INSERT INTO invoice_number_sequences ("locationId", "financialYear", "lastNumber")
       VALUES ($1, $2, 1)
       ON CONFLICT ("locationId", "financialYear")
       DO UPDATE SET "lastNumber" = invoice_number_sequences."lastNumber" + 1
       RETURNING "lastNumber"`,
      [locationId, financialYear],
    );
    return Number(rows[0].lastNumber);
  }

  private async requireInvoice(
    locationId: string,
    invoiceId: string,
    relations: { items?: boolean } = {},
  ): Promise<Invoice> {
    const invoice = await this.invoiceRepository.findOne({
      where: { id: invoiceId, locationId },
      relations,
    });
    if (!invoice) {
      throw new NotFoundException('Invoice not found');
    }
    return invoice;
  }

  private assertDraft(invoice: Invoice): void {
    if (invoice.status !== InvoiceStatus.DRAFT) {
      throw new BadRequestException(
        'Issued invoices cannot be edited. Cancel it and issue a new one.',
      );
    }
  }

  private assertDueDate(issueDate: string | null, dueDate: string | null) {
    if (issueDate && dueDate && dueDate < issueDate) {
      throw new BadRequestException('Due date cannot be before the issue date');
    }
  }

  private async loadResponse(
    locationId: string,
    invoiceId: string,
    supplierStateCode: string | null,
  ): Promise<InvoiceResponse> {
    const invoice = await this.requireInvoice(locationId, invoiceId, {
      items: true,
    });
    const payments = await this.cashEntryRepository.find({
      where: { invoiceId },
      order: { entryDate: 'ASC', createdAt: 'ASC' },
    });
    return this.toResponse(invoice, payments, supplierStateCode, todayIst());
  }

  private toSummary(
    invoice: Invoice,
    supplierStateCode: string | null,
    today: string,
  ): InvoiceSummaryResponse {
    const issued = invoice.status === InvoiceStatus.ISSUED;
    const balancePaise = issued
      ? toPaise(invoice.grandTotal) - toPaise(invoice.amountPaid)
      : 0;
    const supplierState = invoice.supplier?.stateCode ?? supplierStateCode;

    return {
      id: invoice.id,
      locationId: invoice.locationId,
      customerId: invoice.customerId,
      documentType: invoice.documentType,
      status: invoice.status,
      invoiceNumber: invoice.invoiceNumber,
      financialYear: invoice.financialYear,
      issueDate: invoice.issueDate,
      dueDate: invoice.dueDate,
      placeOfSupplyStateCode: invoice.placeOfSupplyStateCode,
      placeOfSupplyStateName: stateNameFromCode(invoice.placeOfSupplyStateCode),
      supplyType: supplyTypeOf(supplierState, invoice.placeOfSupplyStateCode),
      currency: invoice.currency,
      billTo: invoice.billTo,
      subtotal: invoice.subtotal,
      discountTotal: invoice.discountTotal,
      taxableTotal: invoice.taxableTotal,
      cgstTotal: invoice.cgstTotal,
      sgstTotal: invoice.sgstTotal,
      igstTotal: invoice.igstTotal,
      roundOff: invoice.roundOff,
      grandTotal: invoice.grandTotal,
      amountPaid: invoice.amountPaid,
      balanceDue: toRupees(balancePaise),
      paymentStatus: issued ? paymentStatusOf(invoice) : null,
      isOverdue:
        issued &&
        balancePaise > 0 &&
        invoice.dueDate !== null &&
        invoice.dueDate < today,
      issuedAt: invoice.issuedAt,
      cancelledAt: invoice.cancelledAt,
      createdAt: invoice.createdAt,
      updatedAt: invoice.updatedAt,
    };
  }

  private toResponse(
    invoice: Invoice,
    payments: CashEntry[],
    supplierStateCode: string | null,
    today: string,
  ): InvoiceResponse {
    return {
      ...this.toSummary(invoice, supplierStateCode, today),
      supplier: invoice.supplier,
      notes: invoice.notes,
      terms: invoice.terms,
      cancelReason: invoice.cancelReason,
      items: [...(invoice.items ?? [])]
        .sort((a, b) => a.sortOrder - b.sortOrder)
        .map((item) => ({
          id: item.id,
          description: item.description,
          hsnSacCode: item.hsnSacCode,
          quantity: item.quantity,
          unit: item.unit,
          unitPrice: item.unitPrice,
          discountAmount: item.discountAmount,
          taxableValue: item.taxableValue,
          taxRate: item.taxRate,
          cgstAmount: item.cgstAmount,
          sgstAmount: item.sgstAmount,
          igstAmount: item.igstAmount,
          lineTotal: item.lineTotal,
          sortOrder: item.sortOrder,
        })),
      payments: payments.map((payment) => ({
        id: payment.id,
        amount: payment.amount,
        paidOn: payment.entryDate,
        method: payment.paymentMethod,
        referenceNumber: payment.referenceNumber,
        notes: payment.notes,
        createdAt: payment.createdAt,
      })),
    };
  }
}

function supplyTypeOf(
  supplierStateCode: string | null,
  placeOfSupplyStateCode: string | null,
): GstSupplyType {
  return supplierStateCode &&
    placeOfSupplyStateCode &&
    supplierStateCode !== placeOfSupplyStateCode
    ? 'inter_state'
    : 'intra_state';
}

function paymentStatusOf(invoice: Invoice): InvoicePaymentStatus {
  const paid = toPaise(invoice.amountPaid);
  if (paid <= 0) return InvoicePaymentStatus.UNPAID;
  if (paid >= toPaise(invoice.grandTotal)) return InvoicePaymentStatus.PAID;
  return InvoicePaymentStatus.PARTIALLY_PAID;
}

function addDays(isoDate: string, days: number): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const date = new Date(Date.UTC(year, month - 1, day + days));
  return formatIsoDateParts(
    date.getUTCFullYear(),
    date.getUTCMonth() + 1,
    date.getUTCDate(),
  );
}
