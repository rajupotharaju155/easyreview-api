import {
  HttpException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import {
  LOCATION_METRIC_PERIOD_BASELINE,
  LocationMetric,
} from '../locations/entities/location-metric.entity';
import { Location } from '../locations/entities/location.entity';
import { ReviewGrowthQueryDto } from './dto/review-growth-query.dto';
import {
  ReviewGrowthPointDto,
  ReviewGrowthResponseDto,
} from './dto/review-growth-response.dto';

type MetricSnapshot = {
  period: string;
  rating: number | null;
  reviewCount: number | null;
  capturedAt: string | null;
};

@Injectable()
export class AnalyticsService {
  private readonly logger = new Logger(AnalyticsService.name);

  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(LocationMetric)
    private readonly locationMetricRepository: Repository<LocationMetric>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async getReviewGrowth(
    locationId: string,
    query: ReviewGrowthQueryDto,
  ): Promise<ReviewGrowthResponseDto> {
    try {
      const userId = this.currentUserUtil.getCurrentUserId();
      const location = await this.locationRepository.findOne({
        where: { id: locationId, userId },
      });
      if (!location) {
        throw new NotFoundException(
          `Location with id "${locationId}" not found`,
        );
      }

      // Load all snapshots for this location, then aggregate/filter in memory.
      // ~1 row/day/location → even 5 years is ~1800 rows, tiny for Postgres.
      // Move from/to (and monthly DISTINCT ON / window pick) into SQL when a
      // location's history is large enough that this query shows up in latency.
      const metrics = await this.locationMetricRepository.find({
        where: { locationId },
        order: { periodKey: 'ASC' },
      });

      const baselineMetric = metrics.find(
        (metric) => metric.periodKey === LOCATION_METRIC_PERIOD_BASELINE,
      );
      const dailyMetrics = metrics.filter(
        (metric) => metric.periodKey !== LOCATION_METRIC_PERIOD_BASELINE,
      );

      const snapshots =
        query.granularity === 'monthly'
          ? this.toMonthlySnapshots(dailyMetrics)
          : dailyMetrics.map((metric) => this.toSnapshot(metric));

      const filtered = this.filterByRange(
        snapshots,
        query.granularity,
        query.from,
        query.to,
      );

      const seriesPoints =
        baselineMetric != null
          ? [
              {
                period: LOCATION_METRIC_PERIOD_BASELINE,
                rating: baselineMetric.rating,
                reviewCount: baselineMetric.reviewCount,
                capturedAt: this.toIsoString(baselineMetric.capturedAt),
              },
              ...filtered,
            ]
          : filtered;

      const series = this.withDeltas(seriesPoints);

      return new ReviewGrowthResponseDto({
        locationId,
        granularity: query.granularity,
        baseline: baselineMetric
          ? {
              rating: baselineMetric.rating,
              reviewCount: baselineMetric.reviewCount,
              capturedAt: this.toIsoString(baselineMetric.capturedAt),
            }
          : null,
        series,
      });
    } catch (error) {
      if (error instanceof HttpException) {
        throw error;
      }
      this.logger.error(
        `Failed to load review growth for location ${locationId}`,
        error instanceof Error ? error.stack : undefined,
      );
      throw error;
    }
  }

  private toSnapshot(metric: LocationMetric): MetricSnapshot {
    return {
      period: metric.periodKey,
      rating: metric.rating,
      reviewCount: metric.reviewCount,
      capturedAt: this.toIsoString(metric.capturedAt),
    };
  }

  /** Last metric in each calendar month, chosen by latest createdAt. */
  private toMonthlySnapshots(dailyMetrics: LocationMetric[]): MetricSnapshot[] {
    const byMonth = new Map<string, LocationMetric>();
    for (const metric of dailyMetrics) {
      const createdAt = this.toIsoString(metric.createdAt);
      const monthKey =
        createdAt && createdAt.length >= 7
          ? createdAt.slice(0, 7)
          : metric.periodKey.length >= 7
            ? metric.periodKey.slice(0, 7)
            : null;
      if (!monthKey) continue;

      const existing = byMonth.get(monthKey);
      if (
        !existing ||
        this.createdAtSortKey(metric) > this.createdAtSortKey(existing)
      ) {
        byMonth.set(monthKey, metric);
      }
    }

    return [...byMonth.entries()]
      .sort(([a], [b]) => a.localeCompare(b))
      .map(([monthKey, metric]) => ({
        period: monthKey,
        rating: metric.rating,
        reviewCount: metric.reviewCount,
        capturedAt: this.toIsoString(metric.capturedAt),
      }));
  }

  private filterByRange(
    snapshots: MetricSnapshot[],
    granularity: 'daily' | 'monthly',
    from?: string,
    to?: string,
  ): MetricSnapshot[] {
    const normalizedFrom = this.normalizeBound(from, granularity, 'start');
    const normalizedTo = this.normalizeBound(to, granularity, 'end');

    return snapshots.filter((snapshot) => {
      if (normalizedFrom && snapshot.period < normalizedFrom) return false;
      if (normalizedTo && snapshot.period > normalizedTo) return false;
      return true;
    });
  }

  private normalizeBound(
    value: string | undefined,
    granularity: 'daily' | 'monthly',
    _edge: 'start' | 'end',
  ): string | undefined {
    if (!value?.trim()) return undefined;
    const trimmed = value.trim();
    if (granularity === 'monthly') {
      return trimmed.slice(0, 7);
    }
    if (/^\d{4}-\d{2}$/.test(trimmed)) {
      return `${trimmed}-01`;
    }
    return trimmed;
  }

  private withDeltas(snapshots: MetricSnapshot[]): ReviewGrowthPointDto[] {
    return snapshots.map((snapshot, index) => {
      const previous = index > 0 ? snapshots[index - 1] : null;
      const reviewCountDelta =
        snapshot.reviewCount != null && previous?.reviewCount != null
          ? snapshot.reviewCount - previous.reviewCount
          : null;
      const ratingDelta =
        snapshot.rating != null && previous?.rating != null
          ? Number((snapshot.rating - previous.rating).toFixed(2))
          : null;

      return {
        period: snapshot.period,
        rating: snapshot.rating,
        reviewCount: snapshot.reviewCount,
        reviewCountDelta,
        ratingDelta,
        capturedAt: snapshot.capturedAt,
      };
    });
  }

  /** pg parsers often return timestamptz as ISO strings, not Date instances. */
  private toIsoString(value: Date | string | null | undefined): string | null {
    if (value == null) return null;
    if (typeof value === 'string') return value;
    if (value instanceof Date) return value.toISOString();
    return String(value);
  }

  private createdAtSortKey(metric: LocationMetric): string {
    return (
      this.toIsoString(metric.createdAt) ??
      this.toIsoString(metric.capturedAt) ??
      metric.periodKey
    );
  }
}
