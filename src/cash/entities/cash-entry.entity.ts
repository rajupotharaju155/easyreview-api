import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Contact } from '../../contacts/entities/contact.entity';
import { Invoice } from '../../invoices/entities/invoice.entity';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { CashEntryType } from '../enums/cash-entry-type.enum';
import { CashPaymentMethod } from '../enums/cash-payment-method.enum';
import { CashCategory } from './cash-category.entity';

export const CASH_PARTY_NAME_MAX_LENGTH = 160;
export const CASH_REFERENCE_MAX_LENGTH = 100;
export const CASH_NOTES_MAX_LENGTH = 500;

/**
 * Every rupee in or out of a business, including payments against invoices
 * (`invoiceId` set). The direction comes from `type`; `amount` is always
 * positive. Manual entries are soft-deleted; invoice payments are removed
 * outright so the invoice's paid amount always matches its entries.
 */
@Entity('cash_entries')
@Check(`"type" IN ('income', 'expense')`)
@Check(`"amount" > 0`)
@Check(`"invoiceId" IS NULL OR "type" = 'income'`)
@Index(['locationId', 'entryDate'])
@Index(['locationId', 'type', 'entryDate'])
export class CashEntry {
  constructor(data: Partial<CashEntry> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 8 })
  type: CashEntryType;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  categoryId: string;

  @ManyToOne(() => CashCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: CashCategory;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  amount: number;

  /** YYYY-MM-DD in IST. Decides which month the entry counts in. */
  @Column({ type: 'date' })
  entryDate: string;

  @Column({ type: 'varchar', length: 16, nullable: true })
  paymentMethod: CashPaymentMethod | null;

  @Column({
    type: 'varchar',
    length: CASH_PARTY_NAME_MAX_LENGTH,
    nullable: true,
  })
  partyName: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  contactId: string | null;

  @ManyToOne(() => Contact, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'contactId' })
  contact: Contact | null;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  invoiceId: string | null;

  @ManyToOne(() => Invoice, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice | null;

  @Column({
    type: 'varchar',
    length: CASH_REFERENCE_MAX_LENGTH,
    nullable: true,
  })
  referenceNumber: string | null;

  @Column({ type: 'varchar', length: CASH_NOTES_MAX_LENGTH, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  createdByUserId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'createdByUserId' })
  createdByUser: User | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @DeleteDateColumn({ type: 'timestamptz' })
  deletedAt: Date | null;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
