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
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from './location.entity';

@Entity('location_scan_metrics')
@Index(['locationId', 'date'], { unique: true })
export class LocationScanMetric {
  constructor(data: Partial<LocationScanMetric>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, (location) => location.scanMetrics, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  /** Calendar day (UTC) this row aggregates, e.g. 2026-07-27 */
  @Column({ type: 'date' })
  date: string;

  @Column({ type: 'int', default: 0 })
  scanCount: number;

  @Column({ type: 'int', default: 0 })
  aiReviewCount: number;

  @Column({ type: 'int', default: 0 })
  redirectToGoogleCount: number;

  @CreateDateColumn({
    type: 'timestamp',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamp',
  })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
