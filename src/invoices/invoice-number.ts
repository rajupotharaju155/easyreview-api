import { parseIsoDate } from '../subscriptions/utils/ist-date.util';

/** GST allows at most 16 characters: letters, digits, "-" and "/". */
export const INVOICE_NUMBER_MAX_LENGTH = 16;
export const INVOICE_PREFIX_MAX_LENGTH = 4;
export const INVOICE_PREFIX_PATTERN = /^[A-Z0-9]{1,4}$/;
export const DEFAULT_INVOICE_PREFIX = 'INV';

/** Indian financial year (April–March) for a YYYY-MM-DD date, e.g. "25-26". */
export function financialYearOf(isoDate: string): string {
  const { year, month } = parseIsoDate(isoDate);
  const startYear = month >= 4 ? year : year - 1;
  const short = (y: number) => String(y % 100).padStart(2, '0');
  return `${short(startYear)}-${short(startYear + 1)}`;
}

/** e.g. INV/25-26/0001. Numbering restarts every financial year. */
export function formatInvoiceNumber(
  prefix: string,
  financialYear: string,
  sequence: number,
): string {
  const number = `${prefix}/${financialYear}/${String(sequence).padStart(4, '0')}`;
  if (number.length > INVOICE_NUMBER_MAX_LENGTH) {
    throw new Error(
      `Invoice number "${number}" exceeds ${INVOICE_NUMBER_MAX_LENGTH} characters`,
    );
  }
  return number;
}
