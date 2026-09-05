import {
  addDaysToIsoDate,
  addMonthsToYearMonth,
  formatIsoDateParts,
  lastDayOfMonth,
  parseIsoDate,
  todayIst,
} from '../../subscriptions/utils/ist-date.util';
import { NetSeriesRange } from '../enums/net-series-range.enum';

export type NetSeriesBucket = {
  key: string;
  label: string;
  from: string;
  to: string;
};

const WEEKLY_COUNT = 12;
const MONTHLY_COUNT = 12;
const ANNUAL_COUNT = 6;

const MONTH_LABELS = [
  'Jan',
  'Feb',
  'Mar',
  'Apr',
  'May',
  'Jun',
  'Jul',
  'Aug',
  'Sep',
  'Oct',
  'Nov',
  'Dec',
];

function startOfIsoWeek(isoDate: string): string {
  const { year, month, day } = parseIsoDate(isoDate);
  const weekday = new Date(Date.UTC(year, month - 1, day)).getUTCDay();
  const daysFromMonday = weekday === 0 ? 6 : weekday - 1;
  return addDaysToIsoDate(isoDate, -daysFromMonday);
}

function dayLabel(isoDate: string): string {
  const { day, month } = parseIsoDate(isoDate);
  return `${day} ${MONTH_LABELS[month - 1]}`;
}

export function buildNetSeriesBuckets(
  range: NetSeriesRange,
  now = new Date(),
): NetSeriesBucket[] {
  const today = todayIst(now);

  if (range === NetSeriesRange.WEEKLY) {
    const thisMonday = startOfIsoWeek(today);
    return Array.from({ length: WEEKLY_COUNT }, (_, index) => {
      const from = addDaysToIsoDate(thisMonday, (index - (WEEKLY_COUNT - 1)) * 7);
      const to = addDaysToIsoDate(from, 6);
      return { key: from, label: dayLabel(from), from, to };
    });
  }

  const { year, month } = parseIsoDate(today);

  if (range === NetSeriesRange.MONTHLY) {
    return Array.from({ length: MONTHLY_COUNT }, (_, index) => {
      const point = addMonthsToYearMonth(year, month, index - (MONTHLY_COUNT - 1));
      const from = formatIsoDateParts(point.year, point.month, 1);
      const to = formatIsoDateParts(
        point.year,
        point.month,
        lastDayOfMonth(point.year, point.month),
      );
      return {
        key: from,
        label: MONTH_LABELS[point.month - 1],
        from,
        to,
      };
    });
  }

  return Array.from({ length: ANNUAL_COUNT }, (_, index) => {
    const pointYear = year - (ANNUAL_COUNT - 1 - index);
    const from = formatIsoDateParts(pointYear, 1, 1);
    const to = formatIsoDateParts(pointYear, 12, 31);
    return {
      key: from,
      label: String(pointYear),
      from,
      to,
    };
  });
}

export function netSeriesTruncUnit(range: NetSeriesRange): 'week' | 'month' | 'year' {
  if (range === NetSeriesRange.WEEKLY) return 'week';
  if (range === NetSeriesRange.MONTHLY) return 'month';
  return 'year';
}

export function toBucketKey(value: unknown): string {
  if (value instanceof Date) {
    return value.toISOString().slice(0, 10);
  }
  if (typeof value === 'string') return value.slice(0, 10);
  return String(value).slice(0, 10);
}

/** Drop leading empty buckets; keep zeros after the first period with data. */
export function trimLeadingEmptyPoints<
  T extends { payments: number; expenses: number },
>(points: T[]): T[] {
  const first = points.findIndex(
    (point) => point.payments > 0 || point.expenses > 0,
  );
  if (first === -1) return points.slice(-1);
  return points.slice(first);
}
