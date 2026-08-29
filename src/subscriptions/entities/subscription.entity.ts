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
import { Plan } from '../../plans/entities/plan.entity';
import { Product } from '../../plans/enums/product.enum';
import { User } from '../../users/entities/user.entity';
import { SubscriptionSource } from '../enums/subscription-source.enum';
import { SubscriptionStatus } from '../enums/subscription-status.enum';

@Entity('subscriptions')
@Index(['locationId'])
@Index(['userId'])
@Index(['status'])
@Index(['product'])
@Index('UQ_subscriptions_open_location_product', ['locationId', 'product'], {
  unique: true,
  where: `"status" IN ('pending_payment', 'active')`,
})
export class Subscription {
  constructor(data: Partial<Subscription>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Column({ type: 'varchar', length: ID_LENGTH })
  planId: string;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT' })
  @JoinColumn({ name: 'planId' })
  plan: Plan;

  @Column({ type: 'varchar', length: 32, default: Product.EASY_REVIEW })
  product: Product;

  @Column({ type: 'varchar', length: 32 })
  status: SubscriptionStatus;

  @Column({ type: 'date', nullable: true })
  startDate: string | null;

  @Column({ type: 'date', nullable: true })
  endDate: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  cancelledAt: Date | null;

  @Column({ type: 'varchar', length: 16 })
  source: SubscriptionSource;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewaySubscriptionId: string | null;

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
