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
import { MenuCombo } from './menu-combo.entity';
import { MenuItem } from './menu-item.entity';

@Entity('menu_combo_items')
@Index(['comboId', 'menuItemId'], { unique: true })
export class MenuComboItem {
  constructor(data: Partial<MenuComboItem>) {
    Object.assign(this, data);
  }

  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  id: string;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  comboId: string;

  @ManyToOne(() => MenuCombo, {
    onDelete: 'CASCADE',
  })
  @JoinColumn({ name: 'comboId' })
  combo: MenuCombo;

  @Index()
  @Column({ type: 'varchar', length: ID_LENGTH })
  menuItemId: string;

  @ManyToOne(() => MenuItem, { onDelete: 'CASCADE' })
  @JoinColumn({ name: 'menuItemId' })
  menuItem: MenuItem;

  @Column({ type: 'int', default: 0 })
  sortOrder: number;

  @BeforeInsert()
  setId() {
    if (!this.id) {
      this.id = generateId();
    }
  }
}
