import { Column, Entity, PrimaryColumn } from 'typeorm';
import { ID_LENGTH } from '../../common/utils/id';

/**
 * Last invoice number used per location and financial year. Incremented with
 * an upsert inside the issuing transaction, so concurrent issues serialize on
 * the row and a rolled-back issue doesn't leave a gap.
 */
@Entity('invoice_number_sequences')
export class InvoiceNumberSequence {
  @PrimaryColumn({ type: 'varchar', length: ID_LENGTH })
  locationId: string;

  /** e.g. "25-26" */
  @PrimaryColumn({ type: 'varchar', length: 5 })
  financialYear: string;

  @Column({ type: 'int' })
  lastNumber: number;
}
