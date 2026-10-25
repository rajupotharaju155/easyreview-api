import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Customer } from '../../contacts/entities/customer.entity';
import { Location } from '../../locations/entities/location.entity';
import { InvoiceDocumentType } from '../enums/invoice-document-type.enum';
import { InvoiceStatus } from '../enums/invoice-status.enum';
import { INVOICE_NUMBER_MAX_LENGTH } from '../invoice-number';
import type { InvoiceBillTo, InvoiceSupplier } from '../invoice-snapshots';
import { InvoiceItem } from './invoice-item.entity';

const money = {
  type: 'numeric' as const,
  precision: 14,
  scale: 2,
  default: 0,
  transformer: decimalTransformer,
};

/**
 * Invoice header. Drafts are editable and unnumbered; issuing assigns the
 * number, freezes the supplier and recipient snapshots, and locks the
 * content. Issued invoices are cancelled, never deleted.
 */
@Entity('invoices')
@Index(['locationId', 'financialYear', 'invoiceNumber'], {
  unique: true,
  where: '"invoiceNumber" IS NOT NULL',
})
@Index(['locationId', 'status'])
@Index(['locationId', 'issueDate'])
export class Invoice {
  constructor(data: Partial<Invoice> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  /** Null for one-off (guest) invoices; billTo still holds the recipient. */
  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'varchar', length: 20 })
  documentType: InvoiceDocumentType;

  @Column({ type: 'varchar', length: 16, default: InvoiceStatus.DRAFT })
  status: InvoiceStatus;

  @Column({
    type: 'varchar',
    length: INVOICE_NUMBER_MAX_LENGTH,
    nullable: true,
  })
  invoiceNumber: string | null;

  /** e.g. "25-26". Set when issued. */
  @Column({ type: 'varchar', length: 5, nullable: true })
  financialYear: string | null;

  /** YYYY-MM-DD. Optional on drafts; defaults to today (IST) when issued. */
  @Column({ type: 'date', nullable: true })
  issueDate: string | null;

  @Column({ type: 'date', nullable: true })
  dueDate: string | null;

  /** GST state code. CGST+SGST when it matches the supplier, else IGST. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  placeOfSupplyStateCode: string | null;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'jsonb' })
  billTo: InvoiceBillTo;

  @Column({ type: 'jsonb', nullable: true })
  supplier: InvoiceSupplier | null;

  @Column(money)
  subtotal: number;

  @Column(money)
  discountTotal: number;

  @Column(money)
  taxableTotal: number;

  @Column(money)
  cgstTotal: number;

  @Column(money)
  sgstTotal: number;

  @Column(money)
  igstTotal: number;

  @Column(money)
  roundOff: number;

  @Column(money)
  grandTotal: number;

  /** Sum of the invoice's cash_entries, kept in step for lists and filters. */
  @Column(money)
  amountPaid: number;

  @Column({ type: 'text', nullable: true })
  notes: string | null;

  @Column({ type: 'text', nullable: true })
  terms: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  issuedAt: Date | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  cancelReason: string | null;

  @OneToMany(() => InvoiceItem, (item) => item.invoice)
  items: InvoiceItem[];

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
