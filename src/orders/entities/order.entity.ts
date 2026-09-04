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
import { QrProduct } from '../../hq/qr-products/entities/qr-product.entity';
import { Location } from '../../locations/entities/location.entity';
import { User } from '../../users/entities/user.entity';
import { DeliveryTo } from '../enums/delivery-to.enum';
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

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  productId: string | null;

  @ManyToOne(() => QrProduct, { onDelete: 'RESTRICT', nullable: true })
  @JoinColumn({ name: 'productId' })
  product?: QrProduct | null;

  @Column({ type: 'varchar', length: 120 })
  designName: string;

  @Column({ type: 'int' })
  amountInr: number;

  @Column({ type: 'int', default: 1 })
  quantity: number;

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
