import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  OneToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from '../../locations/entities/location.entity';
import {
  DEFAULT_INVOICE_PREFIX,
  INVOICE_PREFIX_MAX_LENGTH,
} from '../invoice-number';

/** Per-location business details printed on invoices, plus defaults. */
@Entity('invoice_settings')
export class InvoiceSettings {
  constructor(data: Partial<InvoiceSettings> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @OneToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 160 })
  legalName: string;

  @Column({ type: 'varchar', length: 15, nullable: true })
  gstin: string | null;

  /** GST state code of the business; taken from the GSTIN when set. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  stateCode: string | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  address: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  phone: string | null;

  @Column({ type: 'varchar', length: 254, nullable: true })
  email: string | null;

  @Column({
    type: 'varchar',
    length: INVOICE_PREFIX_MAX_LENGTH,
    default: DEFAULT_INVOICE_PREFIX,
  })
  invoicePrefix: string;

  @Column({ type: 'int', nullable: true })
  defaultDueDays: number | null;

  @Column({ type: 'text', nullable: true })
  defaultNotes: string | null;

  @Column({ type: 'text', nullable: true })
  defaultTerms: string | null;

  @Column({ type: 'boolean', default: true })
  roundOffTotal: boolean;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankAccountName: string | null;

  @Column({ type: 'varchar', length: 34, nullable: true })
  bankAccountNumber: string | null;

  @Column({ type: 'varchar', length: 11, nullable: true })
  bankIfsc: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  bankName: string | null;

  @Column({ type: 'varchar', length: 100, nullable: true })
  upiId: string | null;

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
