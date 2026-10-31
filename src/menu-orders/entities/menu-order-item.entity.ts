import {
  BeforeInsert,
  Check,
  Column,
  Entity,
  Index,
  JoinColumn,
  ManyToOne,
  PrimaryColumn,
} from 'typeorm';
import { decimalTransformer } from '../../common/utils/decimal.transformer';
import { generateId, ID_LENGTH } from '../../common/utils/id';
import { MenuCombo } from '../../menu/entities/menu-combo.entity';
import { MenuItem } from '../../menu/entities/menu-item.entity';
import { MenuOrderItemType } from '../enums/menu-order-item-type.enum';
import { MenuOrder } from './menu-order.entity';

/**
 * One line of a menu order: a menu item or a combo. Name and price are
 * copied at order time; the links go null if the item or combo is deleted.
 */
@Entity('menu_order_items')
@Check(`"quantity" > 0`)
export class MenuOrderItem {
  constructor(data: Partial<MenuOrderItem> = {}) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  orderId: string;

  @ManyToOne(() => MenuOrder, (order) => order.items, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'orderId' })
  order: MenuOrder;

  @Column({ type: 'varchar', length: 8 })
  itemType: MenuOrderItemType;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  menuItemId: string | null;

  @ManyToOne(() => MenuItem, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem | null;

  @Column({ type: 'varchar', length: ID_LENGTH, nullable: true })
  comboId: string | null;

  @ManyToOne(() => MenuCombo, { onDelete: 'SET NULL', nullable: true })
  @JoinColumn({ name: 'comboId' })
  combo: MenuCombo | null;

  @Column({ type: 'varchar', length: 160 })
  itemName: string;

  /** "Half", "Full" or a price variant name; null for single-priced items. */
  @Column({ type: 'varchar', length: 80, nullable: true })
  variantLabel: string | null;

  /** Names of the items inside a combo, as they were when ordered. */
  @Column({ type: 'jsonb', nullable: true })
  comboItemNames: string[] | null;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  unitPrice: number;

  @Column({ type: 'int' })
  quantity: number;

  @Column({
    type: 'numeric',
    precision: 14,
    scale: 2,
    transformer: decimalTransformer,
  })
  lineTotal: number;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
