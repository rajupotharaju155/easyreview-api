/**
 * Countries whose international numbers keep the leading 0, e.g. Italy
 * "+39 06 …". Everywhere else the 0 is a domestic trunk prefix.
 */
const DIAL_CODES_KEEPING_LEADING_ZERO = new Set([
  '+39',
  '+378',
  '+379',
  '+225',
]);

/**
 * National number as it appears after the country code: digits only, with
 * the domestic trunk prefix dropped ("09029965109" with +91 → "9029965109").
 */
export function toNationalNumber(dialCode: string, phone: string): string {
  const digits = phone.replace(/\D/g, '');
  return DIAL_CODES_KEEPING_LEADING_ZERO.has(dialCode)
    ? digits
    : digits.replace(/^0+/, '');
}

/**
 * Ways the same number may already be saved on a contact: with and without
 * the country code, and with a stray trunk 0 either way.
 */
export function phoneMatchVariants(
  dialCode: string,
  nationalNumber: string,
): string[] {
  return [
    `${dialCode}${nationalNumber}`,
    nationalNumber,
    `${dialCode}0${nationalNumber}`,
    `0${nationalNumber}`,
  ];
}
