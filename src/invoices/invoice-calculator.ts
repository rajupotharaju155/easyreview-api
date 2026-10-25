import { toPaise, toRupees } from '../common/utils/money';

/**
 * Single source of truth for invoice maths. Used for previews, drafts and
 * issuing, so the numbers a business sees are the numbers that get stored.
 *
 * Everything is computed in integer paise and converted back to rupees at the
 * end, so totals never drift from the sum of their lines.
 */

export type GstSupplyType = 'intra_state' | 'inter_state';

export type InvoiceLineInput = {
  quantity: number;
  unitPrice: number;
  discountAmount?: number | null;
  /** GST rate in percent. Ignored when the document doesn't charge GST. */
  taxRate?: number | null;
};

export type InvoiceLineAmounts = {
  grossAmount: number;
  discountAmount: number;
  taxableValue: number;
  taxRate: number;
  cgstAmount: number;
  sgstAmount: number;
  igstAmount: number;
  lineTotal: number;
};

export type InvoiceTotals = {
  subtotal: number;
  discountTotal: number;
  taxableTotal: number;
  cgstTotal: number;
  sgstTotal: number;
  igstTotal: number;
  roundOff: number;
  grandTotal: number;
};

export type InvoiceCalculation = {
  lines: InvoiceLineAmounts[];
  totals: InvoiceTotals;
};

export type InvoiceCalculationOptions = {
  chargesGst: boolean;
  supplyType: GstSupplyType;
  /** Round the grand total to the nearest rupee. */
  roundOffTotal: boolean;
};

/** GST rates (percent) currently notified, including legacy slabs. */
export const GST_RATES = [
  0, 0.1, 0.25, 1, 1.5, 3, 5, 6, 7.5, 12, 18, 28, 40,
] as const;

export class InvoiceCalculationError extends Error {}

export function calculateInvoice(
  lines: InvoiceLineInput[],
  options: InvoiceCalculationOptions,
): InvoiceCalculation {
  const computed = lines.map((line, index) =>
    calculateLine(line, index, options),
  );

  const sum = (key: keyof (typeof computed)[number]) =>
    computed.reduce((total, line) => total + line[key], 0);

  const subtotal = sum('gross');
  const discountTotal = sum('discount');
  const taxableTotal = sum('taxable');
  const cgstTotal = sum('cgst');
  const sgstTotal = sum('sgst');
  const igstTotal = sum('igst');
  const beforeRounding = taxableTotal + cgstTotal + sgstTotal + igstTotal;
  const grandTotal = options.roundOffTotal
    ? Math.round(beforeRounding / 100) * 100
    : beforeRounding;

  return {
    lines: computed.map((line) => ({
      grossAmount: toRupees(line.gross),
      discountAmount: toRupees(line.discount),
      taxableValue: toRupees(line.taxable),
      taxRate: line.taxRate,
      cgstAmount: toRupees(line.cgst),
      sgstAmount: toRupees(line.sgst),
      igstAmount: toRupees(line.igst),
      lineTotal: toRupees(line.taxable + line.cgst + line.sgst + line.igst),
    })),
    totals: {
      subtotal: toRupees(subtotal),
      discountTotal: toRupees(discountTotal),
      taxableTotal: toRupees(taxableTotal),
      cgstTotal: toRupees(cgstTotal),
      sgstTotal: toRupees(sgstTotal),
      igstTotal: toRupees(igstTotal),
      roundOff: toRupees(grandTotal - beforeRounding),
      grandTotal: toRupees(grandTotal),
    },
  };
}

function calculateLine(
  line: InvoiceLineInput,
  index: number,
  options: InvoiceCalculationOptions,
) {
  const label = `Line ${index + 1}`;
  if (!(line.quantity > 0)) {
    throw new InvoiceCalculationError(`${label}: quantity must be above 0`);
  }
  if (!(line.unitPrice >= 0)) {
    throw new InvoiceCalculationError(
      `${label}: unit price cannot be negative`,
    );
  }

  // Quantity allows 3 decimals; keep it integral too.
  const quantityMilli = Math.round(line.quantity * 1000);
  const gross = Math.round((quantityMilli * toPaise(line.unitPrice)) / 1000);
  const discount = toPaise(line.discountAmount ?? 0);
  if (discount < 0 || discount > gross) {
    throw new InvoiceCalculationError(
      `${label}: discount must be between 0 and the line amount`,
    );
  }
  const taxable = gross - discount;

  const taxRate = options.chargesGst ? (line.taxRate ?? 0) : 0;
  if (!options.chargesGst && (line.taxRate ?? 0) !== 0) {
    throw new InvoiceCalculationError(
      `${label}: GST can only be charged on a tax invoice`,
    );
  }
  if (!(GST_RATES as readonly number[]).includes(taxRate)) {
    throw new InvoiceCalculationError(
      `${label}: ${taxRate}% is not a valid GST rate`,
    );
  }

  let cgst = 0;
  let sgst = 0;
  let igst = 0;
  if (options.supplyType === 'inter_state') {
    igst = Math.round((taxable * taxRate) / 100);
  } else {
    // Each half is rounded on its own, so CGST and SGST always match.
    cgst = Math.round((taxable * taxRate) / 200);
    sgst = cgst;
  }

  return { gross, discount, taxable, taxRate, cgst, sgst, igst };
}
