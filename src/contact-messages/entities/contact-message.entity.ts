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
import { User } from '../../users/entities/user.entity';
import { SubmittedFrom } from '../enums/submitted-from.enum';

@Entity('contact_messages')
export class ContactMessage {
  constructor(data: Partial<ContactMessage>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: 120 })
  name: string;

  @Column({ type: 'varchar', length: 255 })
  email: string;

  @Column({ type: 'varchar', length: 8 })
  countryCode: string;

  @Column({ type: 'varchar', length: 15 })
  phone: string;

  @Column({ type: 'text' })
  message: string;

  @Column({ type: 'varchar', length: 16 })
  submittedFrom: SubmittedFrom;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  userId: string | null;

  @ManyToOne(() => User, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'userId' })
  user: User | null;

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
