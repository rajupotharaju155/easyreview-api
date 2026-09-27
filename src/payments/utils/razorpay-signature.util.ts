import { createHmac, timingSafeEqual } from 'node:crypto';

export const MIN_RAZORPAY_AMOUNT_SUBUNITS = 100;

/** Converts a rupee amount stored on plans and payments into paise. */
export function toCurrencySubunits(amount: number): number {
  return Math.round(amount * 100);
}

/** HMAC-SHA256 hex digest of "orderId|paymentId" using the Razorpay key secret. */
export function razorpayPaymentSignature(
  orderId: string,
  paymentId: string,
  keySecret: string,
): string {
  return createHmac('sha256', keySecret)
    .update(`${orderId}|${paymentId}`)
    .digest('hex');
}

/** Constant-time compare of the expected signature and razorpay_signature. */
export function razorpaySignaturesMatch(
  expected: string,
  actual: string,
): boolean {
  const expectedBuffer = Buffer.from(expected);
  const actualBuffer = Buffer.from(actual);
  if (expectedBuffer.length !== actualBuffer.length) return false;
  return timingSafeEqual(expectedBuffer, actualBuffer);
}
