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
import { Order } from '../../orders/entities/order.entity';
import { Plan } from '../../plans/entities/plan.entity';
import { Subscription } from '../../subscriptions/entities/subscription.entity';
import { User } from '../../users/entities/user.entity';
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

@Entity('payments')
@Index(['subscriptionId'])
@Index(['orderId'])
@Index(['locationId'])
@Index(['userId'])
@Index(['status'])
@Index(['kind'])
@Index(['subscriptionId'], {
  unique: true,
  where: `"status" = 'pending' AND "subscriptionId" IS NOT NULL`,
})
@Index(['orderId'], {
  unique: true,
  where: `"status" = 'pending' AND "orderId" IS NOT NULL`,
})
export class Payment {
  constructor(data: Partial<Payment>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: 16 })
  kind: PaymentKind;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  subscriptionId: string | null;

  @ManyToOne(() => Subscription, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'subscriptionId' })
  subscription: Subscription | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  orderId: string | null;

  @ManyToOne(() => Order, { onDelete: 'CASCADE', nullable: true })
  @JoinColumn({ name: 'orderId' })
  order: Order | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  planId: string | null;

  @ManyToOne(() => Plan, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'planId' })
  plan: Plan | null;

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

  @Column({ type: 'int' })
  amount: number;

  @Column({ type: 'int', default: 0 })
  discountAmount: number;

  @Column({ type: 'varchar', length: 3, default: 'INR' })
  currency: string;

  @Column({ type: 'varchar', length: 16 })
  status: PaymentStatus;

  @Column({ type: 'varchar', length: 16, nullable: true })
  provider: PaymentProvider | null;

  @Column({ type: 'varchar', length: 64, nullable: true })
  utr: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayOrderId: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  gatewayPaymentId: string | null;

  @Column({ type: 'timestamptz', nullable: true })
  succeededAt: Date | null;

  @Column({ type: 'varchar', length: 500, nullable: true })
  notes: string | null;

  @Column({ type: 'jsonb', nullable: true })
  metadata: Record<string, unknown> | null;

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
