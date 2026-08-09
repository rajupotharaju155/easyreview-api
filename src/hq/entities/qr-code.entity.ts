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
import { Location } from '../../locations/entities/location.entity';

@Entity('qr_codes')
export class QrCode {
  constructor(data: Partial<QrCode> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  /** Short public code used in scan URLs (`/q/:code`). */
  @Index({ unique: true })
  @Column({ type: 'varchar', length: 16 })
  code: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  batchId: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  locationId: string | null;

  @ManyToOne(() => Location, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'locationId' })
  location: Location | null;

  @Column({ type: 'text', nullable: true })
  targetUrl: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  assignedAt: Date | null;

  @CreateDateColumn({
    type: 'timestamptz',
  })
  createdAt: Date;

  @UpdateDateColumn({
    type: 'timestamptz',
  })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
