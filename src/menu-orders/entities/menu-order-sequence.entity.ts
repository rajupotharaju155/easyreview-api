import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ID_LENGTH } from '../../common/utils/id';

/**
 * Last order token used per location and day. Incremented with an upsert
 * inside the order transaction, so concurrent orders serialize on the row
 * and a rolled-back order doesn't use up a token.
 */
@Entity('menu_order_sequences')
export class MenuOrderSequence {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  /** YYYY-MM-DD in the business's time zone. */
  @PrimaryColumn({ type: 'date' })
  orderDate: string;

  @Column({ type: 'int' })
  lastNumber: number;
}
