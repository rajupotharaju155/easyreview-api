import {
  BeforeInsert,
  Column,
  CreateDateColumn,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  OneToMany,
  PrimaryColumn,
  UpdateDateColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { Customer } from '../../contacts/entities/customer.entity';
import { Location } from '../../locations/entities/location.entity';
import { MenuOrderStatus } from '../enums/menu-order-status.enum';
import { MenuOrderType } from '../enums/menu-order-type.enum';
import { MenuOrderItem } from './menu-order-item.entity';

export const MENU_ORDER_CUSTOMER_NAME_MAX_LENGTH = 160;
export const MENU_ORDER_COUNTRY_CODE_MAX_LENGTH = 8;
export const MENU_ORDER_PHONE_MAX_LENGTH = 15;
export const MENU_ORDER_SPOT_NUMBER_MAX_LENGTH = 16;
export const MENU_ORDER_NOTE_MAX_LENGTH = 300;

/**
 * An order a guest placed from the public menu. `orderNumber` is a daily
 * token that restarts at 1 each day in the business's time zone. Name,
 * phone and prices are kept as placed, so later edits don't rewrite history.
 */
@Entity('menu_orders')
@Index(['locationId', 'orderDate', 'orderNumber'], { unique: true })
@Index(['locationId', 'createdAt'])
@Index(['locationId', 'status'])
export class MenuOrder {
  constructor(data: Partial<MenuOrder> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Column({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  @ManyToOne(() => Location, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'locationId' })
  location: Location;

  /** YYYY-MM-DD in the business's time zone when the order was placed. */
  @Column({ type: 'date' })
  orderDate: string;

  @Column({ type: 'int' })
  orderNumber: number;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  customerId: string | null;

  @ManyToOne(() => Customer, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'customerId' })
  customer: Customer | null;

  @Column({ type: 'varchar', length: MENU_ORDER_CUSTOMER_NAME_MAX_LENGTH })
  customerName: string;

  /** e.g. "+91" */
  @Column({ type: 'varchar', length: MENU_ORDER_COUNTRY_CODE_MAX_LENGTH })
  customerCountryCode: string;

  /** Digits only, without the country code. */
  @Column({ type: 'varchar', length: MENU_ORDER_PHONE_MAX_LENGTH })
  customerPhone: string;

  @Column({ type: 'varchar', length: 16 })
  orderType: MenuOrderType;

  /** Table number for dine-in, room number for room service. */
  @Column({
    type: 'varchar',
    length: MENU_ORDER_SPOT_NUMBER_MAX_LENGTH,
    nullable: true,
  })
  spotNumber: string | null;

  @Column({
    type: 'varchar',
    length: MENU_ORDER_NOTE_MAX_LENGTH,
    nullable: true,
  })
  note: string | null;

  @Column({ type: 'varchar', length: 16, default: MenuOrderStatus.NEW })
  status: MenuOrderStatus;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  totalAmount: number;

  /** ISO 4217, copied from the location when placed. */
  @Column({ type: 'varchar', length: 3 })
  currency: string;

  @OneToMany(() => MenuOrderItem, (item) => item.order)
  items: MenuOrderItem[];

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
