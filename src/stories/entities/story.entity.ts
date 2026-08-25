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
import { Location } from '../../locations/entities/location.entity';
import type { StoryTemplate } from '../story.constants';

@Entity('stories')
@Index(['locationId', 'createdAt'])
export class Story {
  constructor(data: Partial<Story>) {
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

  @Column({ type: 'varchar', length: 32 })
  template: StoryTemplate;

  @Column({ type: 'text', nullable: true })
  prompt: string | null;

  @Column({ type: 'varchar', length: 120, nullable: true })
  offerText: string | null;

  @Column({ type: 'varchar', length: 80, nullable: true })
  festival: string | null;

  @Column({ type: 'text' })
  composedPrompt: string;

  @Column({ type: 'text' })
  imageUrl: string;

  @Column({ type: 'varchar', length: 8, default: '9:16' })
  aspectRatio: string;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
