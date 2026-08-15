const IST_TIME_ZONE = 'Asia/Kolkata';

/** Today's calendar date in IST as YYYY-MM-DD. */
export function todayIst(): string {
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: IST_TIME_ZONE,
  }).format(new Date());
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
