import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from './location.entity';

export const LOCATION_METRIC_PERIOD_BASELINE = 'baseline';

@Entity('location_metrics')
@Index(['locationId', 'periodKey'], { unique: true })
export class LocationMetric {
  constructor(data: Partial<LocationMetric>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, (location) => location.metrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  /** e.g. baseline | 2026-07-30 */
  @Column({ type: 'varchar', length: 32 })
  periodKey: string;

  @Column({ type: 'timestamptz' })
  capturedAt: Date;

  @Column({ type: 'varchar', length: 64, default: 'places_api' })
  source: string;

  @Column({ type: 'float', nullable: true })
  rating: number | null;

  @Column({ type: 'int', nullable: true })
  reviewCount: number | null;

  /** Future: star breakdown, GBP clicks, etc. */
  @Column({ type: 'int', nullable: true })
  rating5Count: number | null;

  @Column({ type: 'int', nullable: true })
  rating4Count: number | null;

  @Column({ type: 'int', nullable: true })
  rating3Count: number | null;

  @Column({ type: 'int', nullable: true })
  rating2Count: number | null;

  @Column({ type: 'int', nullable: true })
  rating1Count: number | null;

  @Column({ type: 'int', nullable: true })
  callClicks: number | null;

  @Column({ type: 'int', nullable: true })
  directionClicks: number | null;

  @Column({ type: 'int', nullable: true })
  websiteClicks: number | null;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
