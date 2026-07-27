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
import { User } from '../../users/entities/user.entity';
import { DeliveryTo } from '../enums/delivery-to.enum';
import { DesignVariant } from '../enums/design-variant.enum';
import { OrderStatus } from '../enums/order-status.enum';

@Entity('orders')
export class Order {
  constructor(data: Partial<Order>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  userId: string;

  @ManyToOne(() => User, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'userId' })
  user: User;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  @Column({ type: 'varchar', length: 32 })
  designVariant: DesignVariant;

  @Column({ type: 'varchar', length: 120 })
  designName: string;

  @Column({ type: 'int' })
  amountInr: number;

  @Column({ type: 'varchar', length: 255 })
  businessNameSnapshot: string;

  @Column({ type: 'varchar', length: 16 })
  deliveryTo: DeliveryTo;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine1: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine2: string | null;

  @Column({ type: 'varchar', length: 255, nullable: true })
  addressLine3: string | null;

  @Column({ type: 'varchar', length: 32, nullable: true })
  pincode: string | null;

  @Column({ type: 'varchar', length: 64 })
  phoneNumber: string;

  @Index()
  @Column({
    type: 'varchar',
    length: 32,
    default: OrderStatus.PLACED,
  })
  status: OrderStatus;

  @Column({ type: 'varchar', length: 500, nullable: true })
  statusNote: string | null;

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
