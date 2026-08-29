import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  DeleteDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { MenuStyle } from '../../menu/enums/menu-style.enum';
import { User } from '../../users/entities/user.entity';
import { LocationMetric } from './location-metric.entity';
import { LocationScanMetric } from './location-scan-metric.entity';
import { Review } from './review.entity';

@Entity('locations')
@Index(['userId', 'placeId'], {
  unique: true,
  where: '"deletedAt" IS NULL',
})
export class Location {
  constructor(data: Partial<Location>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column()
  name: string;

  @Index({ unique: true })
  @Column({ type: 'varchar', length: 255, nullable: true })
  slug: string | null;

  @Column({ type: 'boolean', default: false })
  isEasyMenuEnabled: boolean;

  @Column({
    type: 'varchar',
    length: 32,
    default: MenuStyle.RESTAURANT_STYLE,
  })
  menuStyle: MenuStyle;

  @Column({ type: 'boolean', default: false })
  isEasyStoryEnabled: boolean;

  @Index()
  @Column({ type: 'varchar', length: 255 })
  placeId: string;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine1: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  city: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  state: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  country: string | null;

  @Column({ type: 'text', nullable: true })
  formattedAddress: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  phoneNumber: string | null;

  @Column({ type: 'text', nullable: true })
  websiteURI: string | null;

  @Column({ type: 'text', nullable: true })
  googleMapsURI: string | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  businessStatus: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  primaryType: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  primaryTypeDisplayName: string | null;

  @Column({ type: 'text', array: true, nullable: true })
  types: string[] | null;

  /** Cached latest metrics for fast list views. Source of truth is location_metrics. */
  @Column({ type: 'float', nullable: true })
  currentRating: number | null;

  @Column({ type: 'int', nullable: true })
  currentReviewCount: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  metricsCapturedAt: Date | null;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @ManyToOne(() => User, (user) => user.locations, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @OneToMany(() => LocationMetric, (metric) => metric.location)
  metrics: LocationMetric[];

  @OneToMany(() => LocationScanMetric, (metric) => metric.location)
  scanMetrics: LocationScanMetric[];

  @OneToMany(() => Review, (review) => review.location)
  reviews: Review[];

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  @DeleteDateColumn({
    type: 'timestamp',
  })
  deletedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
