import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { User } from '../../users/entities/user.entity';

export const PUSH_ENDPOINT_MAX_LENGTH = 2048;
export const PUSH_KEY_MAX_LENGTH = 255;
export const PUSH_USER_AGENT_MAX_LENGTH = 512;

/**
 * One browser or device a user allowed to receive push notifications on.
 * `endpoint` is the push service URL the browser handed out; `p256dh` and
 * `auth` are the browser's keys for encrypting what we send it.
 */
@Entity('push_subscriptions')
export class PushSubscription {
  constructor(data: Partial<PushSubscription> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: PUSH_ENDPOINT_MAX_LENGTH, unique: true })
  endpoint: string;

  @Column({ type: 'varchar', length: PUSH_KEY_MAX_LENGTH })
  p256dh: string;

  @Column({ type: 'varchar', length: PUSH_KEY_MAX_LENGTH })
  auth: string;

  @Column({
    type: 'varchar',
    length: PUSH_USER_AGENT_MAX_LENGTH,
    nullable: true,
  })
  userAgent: string | null;

  /** Last time a push to this device was accepted by its push service. */
  @Column({ type: 'timestamptz', nullable: true })
  lastUsedAt: Date | null;

  @CreateDateColumn({ type: 'timestamptz' })
  createdAt: Date;

  @UpdateDateColumn({ type: 'timestamptz' })
  updatedAt: Date;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
