import {
  BeforeInsert,
  Check,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from '../../locations/entities/location.entity';
import { CashEntryType } from '../enums/cash-entry-type.enum';

export const CASH_CATEGORY_NAME_MAX_LENGTH = 60;

/**
 * Income or expense category for a business. Businesses create their own;
 * only the reserved "Invoice payments" category carries a `systemKey`.
 * Categories with entries are archived rather than deleted so past entries
 * keep their category.
 */
@Entity('cash_categories')
@Check(`"type" IN ('income', 'expense')`)
@Index(['locationId', 'systemKey'], {
  unique: true,
  where: '"systemKey" IS NOT NULL',
})
export class CashCategory {
  constructor(data: Partial<CashCategory> = {}) {
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

  @Column({ type: 'varchar', length: 8 })
  type: CashEntryType;

  @Column({ type: 'varchar', length: CASH_CATEGORY_NAME_MAX_LENGTH })
  name: string;

  @Column({ type: 'varchar', length: 32, nullable: true })
  systemKey: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  archivedAt: Date | null;

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
