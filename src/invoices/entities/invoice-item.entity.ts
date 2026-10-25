import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Invoice } from './invoice.entity';

export const INVOICE_ITEM_DESCRIPTION_MAX_LENGTH = 500;
export const INVOICE_ITEM_UNIT_MAX_LENGTH = 20;

const money = {
  type: 'numeric' as const,
  precision: 14,
  scale: 2,
  default: 0,
  transformer: decimalTransformer,
};

@Entity('invoice_items')
export class InvoiceItem {
  constructor(data: Partial<InvoiceItem> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  invoiceId: string;

  @ManyToOne(() => Invoice, (invoice) => invoice.items, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'invoiceId' })
  invoice: Invoice;

  @Column({ type: 'varchar', length: INVOICE_ITEM_DESCRIPTION_MAX_LENGTH })
  description: string;

  @Column({ type: 'varchar', length: 8, nullable: true })
  hsnSacCode: string | null;

  @Column({
    type: 'numeric',
    precision: 12,
    scale: 3,
    transformer: decimalTransformer,
  })
  quantity: number;

  @Column({
    type: 'varchar',
    length: INVOICE_ITEM_UNIT_MAX_LENGTH,
    nullable: true,
  })
  unit: string | null;

  @Column(money)
  unitPrice: number;

  @Column(money)
  discountAmount: number;

  @Column(money)
  taxableValue: number;

  @Column({
    type: 'numeric',
    precision: 5,
    scale: 2,
    default: 0,
    transformer: decimalTransformer,
  })
  taxRate: number;

  @Column(money)
  cgstAmount: number;

  @Column(money)
  sgstAmount: number;

  @Column(money)
  igstAmount: number;

  @Column(money)
  lineTotal: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
