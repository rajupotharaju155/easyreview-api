import type { Urgency } from 'web-push';

/** What the dashboard's service worker reads from a push (public/sw.js). */
export type PushPayload = {
  /** What the push is about, e.g. `menu_order`; open dashboard tabs act on it. */
  type: string;
  title: string;
  body: string;
  /** Dashboard path opened when the notification is clicked. */
  url: string;
  /** Notifications with the same tag replace each other. */
  tag: string;
  /** Keep it on screen until the owner acts, e.g. for a new order. */
  requireInteraction?: boolean;
  /** Handed to open dashboard tabs as-is, e.g. the order's ids. */
  data?: Record<string, string | number | boolean | null>;
};

/** How the push service delivers a push. */
export type PushDeliveryOptions = {
  /** `high` wakes a sleeping phone right away; `normal` may wait. */
  urgency?: Urgency;
  /** The push service drops a push it couldn't deliver in this time. */
  ttlSeconds?: number;
};

/**
 * Hosts of the browsers' push services (Chrome/Edge, Firefox, Safari, legacy
 * Edge). Only these are accepted so the server never posts to arbitrary URLs.
 */
const PUSH_SERVICE_HOST_SUFFIXES = [
  'googleapis.com',
  'push.services.mozilla.com',
  'push.apple.com',
  'notify.windows.com',
];

export function isPushServiceEndpoint(endpoint: string): boolean {
  try {
    const { protocol, hostname } = new URL(endpoint);
    return (
      protocol === 'https:' &&
      PUSH_SERVICE_HOST_SUFFIXES.some(
        (suffix) => hostname === suffix || hostname.endsWith(`.${suffix}`),
      )
    );
  } catch {
    return false;
  }
}
