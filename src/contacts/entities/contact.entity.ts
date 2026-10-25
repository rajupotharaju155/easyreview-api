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

export const CONTACT_NAME_MAX_LENGTH = 160;
export const CONTACT_PHONE_MAX_LENGTH = 32;
export const CONTACT_EMAIL_MAX_LENGTH = 254;
export const CONTACT_COMPANY_MAX_LENGTH = 160;

/**
 * A person or business a location knows about. Shared identity record:
 * customers (EasyInvoice) and, later, leads (EasyLeads) point here.
 */
@Entity('contacts')
@Index(['locationId', 'phone'])
@Index(['locationId', 'email'])
export class Contact {
  constructor(data: Partial<Contact> = {}) {
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

  @Column({ type: 'varchar', length: CONTACT_NAME_MAX_LENGTH })
  name: string;

  @Column({
    type: 'varchar',
    length: CONTACT_PHONE_MAX_LENGTH,
    nullable: true,
  })
  phone: string | null;

  @Column({
    type: 'varchar',
    length: CONTACT_EMAIL_MAX_LENGTH,
    nullable: true,
  })
  email: string | null;

  @Column({
    type: 'varchar',
    length: CONTACT_COMPANY_MAX_LENGTH,
    nullable: true,
  })
  companyName: string | null;

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
