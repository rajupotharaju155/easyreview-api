import type { Location } from './entities/location.entity';

/** Structured address columns; editing any of them rebuilds formattedAddress. */
export const ADDRESS_PART_KEYS = [
  'addressLine1',
  'localArea',
  'city',
  'state',
  'pincode',
  'country',
] as const;

type AddressParts = Partial<
  Record<(typeof ADDRESS_PART_KEYS)[number], string | null>
>;

/**
 * One-line address from its parts, e.g. "12 Main St, Downtown, Austin,
 * TX 78701, United States". State and postal code share a segment, which
 * reads naturally in most countries. Null when every part is empty.
 */
export function composeFormattedAddress(parts: AddressParts): string | null {
  const clean = (value: string | null | undefined) => value?.trim() || '';
  const region = [clean(parts.state), clean(parts.pincode)]
    .filter(Boolean)
    .join(' ');
  const address = [
    clean(parts.addressLine1),
    clean(parts.localArea),
    clean(parts.city),
    region,
    clean(parts.country),
  ]
    .filter(Boolean)
    .join(', ');
  return address || null;
}
