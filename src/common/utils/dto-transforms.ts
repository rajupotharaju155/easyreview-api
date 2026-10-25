/** class-transformer helpers for optional text fields. */

export function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export function emptyToNull({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Trim, uppercase and drop inner spaces (GSTIN, IFSC, codes). */
export function compactUpperOrNull({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const compact = value.replace(/\s+/g, '').toUpperCase();
  return compact.length > 0 ? compact : null;
}

/** Keep a leading "+" and digits; drop spaces, dashes and brackets. */
export function normalizePhoneOrNull({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  if (trimmed.length === 0) return null;
  return trimmed.replace(/(?!^\+)[^\d]/g, '');
}
