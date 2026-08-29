const IST_TIME_ZONE = 'Asia/Kolkata';
/** IST has no DST. 00:00 IST is 18:30 UTC the previous day. */
const IST_OFFSET_MS = (5 * 60 + 30) * 60 * 1000;

/** Today's calendar date in IST as YYYY-MM-DD. */
export function todayIst(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
  }).format(now);
}

export function parseIsoDate(isoDate: string): {
  year: number;
  month: number;
  day: number;
} {
  const [year, month, day] = isoDate.split('-').map(Number);
  return { year, month, day };
}

export function formatIsoDateParts(
  year: number,
  month: number,
  day: number,
): string {
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}

export function addMonthsToYearMonth(
  year: number,
  month: number,
  delta: number,
): { year: number; month: number } {
  const utc = new Date(Date.UTC(year, month - 1 + delta, 1));
  return { year: utc.getUTCFullYear(), month: utc.getUTCMonth() + 1 };
}

export function lastDayOfMonth(year: number, month: number): number {
  return new Date(Date.UTC(year, month, 0)).getUTCDate();
}

/** Instant of 00:00:00 IST on the given calendar date. */
export function istMidnightUtc(isoDate: string): Date {
  const { year, month, day } = parseIsoDate(isoDate);
  return new Date(Date.UTC(year, month - 1, day) - IST_OFFSET_MS);
}

export type IstMonthRange = {
  from: string;
  to: string;
  startUtc: Date;
  endExclusiveUtc: Date;
};

export function istCalendarMonthRange(
  year: number,
  month: number,
): IstMonthRange {
  const from = formatIsoDateParts(year, month, 1);
  const to = formatIsoDateParts(year, month, lastDayOfMonth(year, month));
  const next = addMonthsToYearMonth(year, month, 1);
  return {
    from,
    to,
    startUtc: istMidnightUtc(from),
    endExclusiveUtc: istMidnightUtc(
      formatIsoDateParts(next.year, next.month, 1),
    ),
  };
}

export function istThisAndLastMonth(now = new Date()): {
  thisMonth: IstMonthRange;
  lastMonth: IstMonthRange;
} {
  const { year, month } = parseIsoDate(todayIst(now));
  const last = addMonthsToYearMonth(year, month, -1);
  return {
    thisMonth: istCalendarMonthRange(year, month),
    lastMonth: istCalendarMonthRange(last.year, last.month),
  };
}

export function addDaysToIsoDate(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  const utc = Date.UTC(year, month - 1, day + days);
  return new Date(utc).toISOString().slice(0, 10);
}

/** Inclusive last day: 15 Aug + 14 days → 28 Aug. */
export function endDateFromDuration(
  startDate: string,
  durationDays: number,
): string {
  return addDaysToIsoDate(startDate, durationDays - 1);
}
