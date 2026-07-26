import {
  BeforeInsert,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Location } from './location.entity';

@Entity('reviews')
export class Review {
  constructor(data: Partial<Review>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, (location) => location.reviews, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'text', nullable: true })
  text: string | null;

  @Column({ type: 'float', nullable: true })
  rating: number | null;

  @Column({ type: 'timestamptz', nullable: true })
  publishedAt: Date | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  authorName: string | null;

  @Column({ type: 'text', nullable: true })
  authorPhotoUri: string | null;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
