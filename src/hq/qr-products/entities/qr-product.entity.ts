import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../../common/utils/id';
import { QrProductCategory } from './qr-product-category.entity';

@Entity('qr_products')
@Index(['categoryId', 'createdAt'])
export class QrProduct {
  constructor(data: Partial<QrProduct>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  categoryId: string;

  @ManyToOne(() => QrProductCategory, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'categoryId' })
  category: QrProductCategory;

  @Column({ type: 'varchar', length: 160 })
  name: string;

  @Column({ type: 'text', nullable: true })
  description: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  dimensions: string | null;

  @Column({ type: 'int', default: 0 })
  priceInr: number;

  @Column({ type: 'text', array: true, default: () => "'{}'" })
  imageUrls: string[];

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @Column({ type: 'timestamptz', nullable: true })
  discontinuedAt: Date | null;

  @BeforeInsert()
  setId() {
    if (!this.id) this.id = generateId();
  }
}

