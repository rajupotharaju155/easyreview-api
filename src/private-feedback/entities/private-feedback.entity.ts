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

@Entity('private_feedback')
export class PrivateFeedback {
  constructor(data: Partial<PrivateFeedback>) {
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

  @Column({ type: 'int' })
  rating: number;

  @Column({ type: 'text' })
  feedback: string;

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
