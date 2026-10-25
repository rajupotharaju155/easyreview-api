import {
  BeforeInsert,
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
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from '../../locations/entities/location.entity';
import { Contact } from './contact.entity';

export const CUSTOMER_GSTIN_LENGTH = 15;
export const CUSTOMER_ADDRESS_MAX_LENGTH = 500;
export const CUSTOMER_CITY_MAX_LENGTH = 120;
export const CUSTOMER_PINCODE_MAX_LENGTH = 10;
export const CUSTOMER_NOTES_MAX_LENGTH = 500;

/**
 * A billing relationship between a location and a contact. Identity fields
 * (name, phone, email) live on the contact; billing fields live here.
 * Soft-deleted so issued invoices keep their reference.
 */
@Entity('customers')
@Index(['locationId', 'contactId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Customer {
  constructor(data: Partial<Customer> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  contactId: string;

  @ManyToOne(() => Contact, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'contactId' })
  contact: Contact;

  @Column({ type: 'varchar', length: CUSTOMER_GSTIN_LENGTH, nullable: true })
  gstin: string | null;

  @Column({
    type: 'varchar',
    length: CUSTOMER_ADDRESS_MAX_LENGTH,
    nullable: true,
  })
  billingAddress: string | null;

  @Column({ type: 'varchar', length: CUSTOMER_CITY_MAX_LENGTH, nullable: true })
  city: string | null;

  /** GST state code, e.g. "36" for Telangana. Drives place of supply. */
  @Column({ type: 'varchar', length: 2, nullable: true })
  stateCode: string | null;

  @Column({
    type: 'varchar',
    length: CUSTOMER_PINCODE_MAX_LENGTH,
    nullable: true,
  })
  pincode: string | null;

  @Column({
    type: 'varchar',
    length: CUSTOMER_NOTES_MAX_LENGTH,
    nullable: true,
  })
  notes: string | null;

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
