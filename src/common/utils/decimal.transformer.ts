import type { ValueTransformer } from 'typeorm';

/**
 * Postgres returns `numeric` columns as strings to avoid precision loss.
 * Money and quantities here stay well inside double precision, so read them
 * back as numbers.
 */
export const decimalTransformer: ValueTransformer = {
  to: (value: number | null | undefined) => value,
  from: (value: string | null) => (value === null ? null : Number(value)),
};
