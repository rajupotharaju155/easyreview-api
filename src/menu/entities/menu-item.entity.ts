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
import { MenuPriceType } from '../enums/menu-price-type.enum';
import type { MenuItemVariantPrice } from '../menu-pricing';
import { MenuCategory } from './menu-category.entity';

@Entity('menu_items')
export class MenuItem {
  constructor(data: Partial<MenuItem>) {
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
  categoryId: string;

  @ManyToOne(() => MenuCategory, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'categoryId' })
  category: MenuCategory;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'boolean', default: false })
  isNonVeg: boolean;

  @Column({ type: 'boolean', default: false })
  isNotAvailable: boolean;

  @Column({ type: 'text', nullable: true })
  imageUrl: string | null;

  @Column({ type: 'boolean', default: false })
  isHalfServed: boolean;

  @Column({ type: 'double precision', nullable: true })
  halfPrice: number | null;

  @Column({ type: 'double precision', nullable: true })
  fullPrice: number | null;

  @Column({
    type: 'varchar',
    length: 16,
    default: MenuPriceType.FIXED,
  })
  priceType: MenuPriceType;

  @Column({ type: 'boolean', default: false })
  isMultiPriced: boolean;

  /** Prices keyed by category priceVariants[].id. Empty cells are omitted. */
  @Column({ type: 'jsonb', default: () => "'[]'" })
  variantPrices: MenuItemVariantPrice[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

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
