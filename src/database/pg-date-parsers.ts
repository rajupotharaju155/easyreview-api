import { types } from 'pg';

/**
 * Return Postgres timestamps as ISO UTC strings without going through
 * JavaScript Date (which shifts wall-clock by the local timezone).
 *
 * Assumes timestamp / timestamptz values are stored as UTC wall-clock.
 */
export function configurePgUtcTimestampParsers(): void {
  const toIsoUtc = (value: string): string => {
    const trimmed = value.trim();
    if (!trimmed) {
      return trimmed;
    }
    const match = trimmed.match(
      /^(\d{4}-\d{2}-\d{2})[ T](\d{2}:\d{2}:\d{2}(?:\.\d+)?)/,
    );
    if (!match) {
      return trimmed;
    }
    const [, date, time] = match;
    return `${date}T${time}Z`;
  };

  types.setTypeParser(types.builtins.TIMESTAMP, toIsoUtc);
  types.setTypeParser(types.builtins.TIMESTAMPTZ, toIsoUtc);
  // Keep DATE as YYYY-MM-DD so IST calendar days are not shifted by JS Date.
  types.setTypeParser(types.builtins.DATE, (value: string) => value);
}
