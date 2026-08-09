export type HqAdminCredential = {
  email: string;
  password: string;
};

export const HQ_ADMINS: HqAdminCredential[] = [
  { email: 'raju.debug@gmail.com', password: '9987672912' },
  { email: 'komalswain37@gmail.com', password: '7506191810' },
];

export const HQ_ADMIN_SUB = 'hq-admin';
export const HQ_TOKEN_TYPE = 'hq' as const;
/** Short-lived ticket minted by HQ for user-dashboard impersonation. */
export const LOGIN_AS_TOKEN_TYPE = 'login-as' as const;
export const LOGIN_AS_TICKET_EXPIRATION = '60s' as const;

/** Public marketing/rating site used for QR redirect targets. */
export const PUBLIC_SITE_BASE_URL = 'https://easyreview.co.in';

/** Default batch size when HQ generates claimable QR codes. */
export const QR_BATCH_DEFAULT_SIZE = 10;

/**
 * Ambiguous chars excluded (0/O, 1/I/L) so standee labels stay easy to type.
 * Length balances guessability vs scan URL size.
 */
export const QR_CODE_ALPHABET = '23456789ABCDEFGHJKLMNPQRSTUVWXYZ';
export const QR_CODE_LENGTH = 6;
