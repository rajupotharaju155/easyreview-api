import { GST_STATES } from './gst-states';

const GSTIN_PATTERN = /^[0-9]{2}[A-Z]{5}[0-9]{4}[A-Z][1-9A-Z]Z[0-9A-Z]$/;
const CHECKSUM_ALPHABET = '0123456789ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function normalizeGstin(value: string): string {
  return value.replace(/\s+/g, '').toUpperCase();
}

/** Structure, state code and check digit. Expects a normalized GSTIN. */
export function isValidGstin(gstin: string): boolean {
  if (!GSTIN_PATTERN.test(gstin)) return false;
  if (!(gstin.slice(0, 2) in GST_STATES)) return false;
  return gstin[14] === gstinCheckDigit(gstin.slice(0, 14));
}

export function gstinStateCode(gstin: string): string {
  return gstin.slice(0, 2);
}

function gstinCheckDigit(first14: string): string {
  const base = CHECKSUM_ALPHABET.length;
  let sum = 0;
  for (let i = 0; i < first14.length; i++) {
    const product =
      CHECKSUM_ALPHABET.indexOf(first14[i]) * (i % 2 === 0 ? 1 : 2);
    sum += Math.floor(product / base) + (product % base);
  }
  return CHECKSUM_ALPHABET[(base - (sum % base)) % base];
}
