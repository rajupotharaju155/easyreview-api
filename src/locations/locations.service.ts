import {
  ConflictException,
  HttpException,
  HttpStatus,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import {
  EntityManager,
  QueryFailedError,
  Repository,
  UpdateResult,
} from 'typeorm';
import { AiSettingsService } from '../ai-settings/ai-settings.service';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { generateId } from '../common/utils/id';
import {
  slugCandidatesFromName,
  slugWithSuffix,
} from '../common/utils/slug.util';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationWithScanSummaryDto } from './dto/location-with-scan-summary.dto';
import { PublicLocationDto } from './dto/public-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import {
  LOCATION_METRIC_PERIOD_BASELINE,
  LocationMetric,
} from './entities/location-metric.entity';
import { LocationScanMetric } from './entities/location-scan-metric.entity';
import { Location } from './entities/location.entity';
import { Review } from './entities/review.entity';
import { GooglePlacesService } from '../services/google-places.service';
import { SubscriptionsService } from '../subscriptions/subscriptions.service';

type ScanMetricField = 'scanCount' | 'aiReviewCount' | 'redirectToGoogleCount';

type ScanSummaryRow = {
  locationId: string;
  totalScanCount: string;
  todayScanCount: string;
  totalRedirectToGoogleCount: string;
  totalAiReviewCount: string;
};

@Injectable()
export class LocationsService {
  private readonly logger = new Logger(LocationsService.name);

  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(LocationScanMetric)
    private readonly scanMetricRepository: Repository<LocationScanMetric>,
    @InjectRepository(LocationMetric)
    private readonly locationMetricRepository: Repository<LocationMetric>,
    private readonly googlePlacesService: GooglePlacesService,
    private readonly currentUserUtil: CurrentUserUtil,
    private readonly aiSettingsService: AiSettingsService,
    private readonly subscriptionsService: SubscriptionsService,
  ) {}

  async create(
    createLocationDto: CreateLocationDto,
  ): Promise<LocationWithScanSummaryDto> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const capturedAt = new Date();

    try {
      const savedLocation = await this.locationRepository.manager.transaction(
        async (manager) => {
          const slug = await this.allocateUniqueSlug(
            manager,
            createLocationDto.name,
            createLocationDto.city,
          );

          const location = manager.create(Location, {
            name: createLocationDto.name,
            slug,
            placeId: createLocationDto.placeId,
            addressLine1: createLocationDto.addressLine1 ?? null,
            city: createLocationDto.city ?? null,
            state: createLocationDto.state ?? null,
            pincode: createLocationDto.pincode ?? null,
            country: createLocationDto.country ?? null,
            formattedAddress: createLocationDto.formattedAddress ?? null,
            phoneNumber: createLocationDto.phoneNumber ?? null,
            websiteURI: createLocationDto.websiteURI ?? null,
            googleMapsURI: createLocationDto.googleMapsURI ?? null,
            businessStatus: createLocationDto.businessStatus ?? null,
            primaryType: createLocationDto.primaryType ?? null,
            primaryTypeDisplayName:
              createLocationDto.primaryTypeDisplayName ?? null,
            types: createLocationDto.types?.length
              ? createLocationDto.types
              : null,
            currentRating: createLocationDto.rating ?? null,
            currentReviewCount: createLocationDto.userRatingCount ?? null,
            metricsCapturedAt: capturedAt,
            userId,
          });

          const savedLocation = await manager.save(location);

          const metric = manager.create(LocationMetric, {
            locationId: savedLocation.id,
            periodKey: LOCATION_METRIC_PERIOD_BASELINE,
            capturedAt,
            source: 'places_api',
            rating: createLocationDto.rating ?? null,
            reviewCount: createLocationDto.userRatingCount ?? null,
          });

          await manager.save(metric);

          if (createLocationDto.reviews?.length) {
            const reviews = createLocationDto.reviews.map((review) =>
              manager.create(Review, {
                locationId: savedLocation.id,
                text: review.text?.trim() || null,
                rating: review.rating ?? null,
                publishedAt: review.publishedAt
                  ? new Date(review.publishedAt)
                  : null,
                authorName: review.authorName?.trim() || null,
                authorPhotoUri: review.authorPhotoUri?.trim() || null,
              }),
            );
            await manager.save(reviews);
          }

          return savedLocation;
        },
      );

      await this.tryGrantAdminDemoSubscription(savedLocation);

      return this.withScanSummary(savedLocation);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This Google location is already added to your account',
        );
      }
      throw error;
    }
  }

  private async tryGrantAdminDemoSubscription(
    location: Location,
  ): Promise<void> {
    try {
      await this.subscriptionsService.grantAdminDemoIfEligible(location);
    } catch (error) {
      this.logger.warn(
        `Failed to grant admin demo subscription for location ${location.id}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async allocateUniqueSlug(
    manager: EntityManager,
    name: string,
    city?: string | null,
  ): Promise<string> {
    const candidates = slugCandidatesFromName(name, city);
    const twoWordBase = candidates[0] || 'location';

    for (const candidate of candidates) {
      if (await this.isSlugAvailable(manager, candidate)) {
        return candidate;
      }
    }

    for (let attempt = 0; attempt < 8; attempt += 1) {
      const candidate = slugWithSuffix(twoWordBase);
      if (await this.isSlugAvailable(manager, candidate)) {
        return candidate;
      }
    }

    throw new ConflictException('Unable to allocate a unique location slug');
  }

  private async isSlugAvailable(
    manager: EntityManager,
    slug: string,
  ): Promise<boolean> {
    const existing = await manager.findOne(Location, {
      where: { slug },
      withDeleted: true,
      select: ['id'],
    });
    return !existing;
  }

  async findAllPaginated(
    paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<LocationWithScanSummaryDto>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.locationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    const withSummaries = await this.withScanSummaries(data);
    return new PaginatedResponseDto(withSummaries, total, page, limit);
  }

  async findOne(id: string): Promise<LocationWithScanSummaryDto> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id, userId },
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }

    return this.withScanSummary(location);
  }

  async refreshMetrics(id: string): Promise<LocationMetric> {
    const location = await this.locationRepository.findOne({
      where: { id },
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }

    const placeDetails = await this.googlePlacesService.fetchPlaceDetails(
      location.placeId,
    );
    const capturedAt = new Date();
    const periodKey = this.currentMetricPeriodKey(capturedAt);

    let metric = await this.locationMetricRepository.findOne({
      where: { locationId: location.id, periodKey },
    });

    if (metric) {
      metric.capturedAt = capturedAt;
      metric.source = 'places_api';
      metric.rating = placeDetails.rating;
      metric.reviewCount = placeDetails.userRatingCount;
    } else {
      metric = this.locationMetricRepository.create({
        locationId: location.id,
        periodKey,
        capturedAt,
        source: 'places_api',
        rating: placeDetails.rating,
        reviewCount: placeDetails.userRatingCount,
      });
    }

    const savedMetric = await this.locationMetricRepository.save(metric);

    await this.locationRepository.update(location.id, {
      currentRating: placeDetails.rating,
      currentReviewCount: placeDetails.userRatingCount,
      metricsCapturedAt: capturedAt,
    });

    return savedMetric;
  }

  /**
   * Refreshes Places metrics for every location. Continues on per-location errors
   * so one bad placeId cannot abort the scheduled job.
   */
  async refreshAllMetrics(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    failures: Array<{ locationId: string; error: string }>;
  }> {
    const locations = await this.locationRepository.find({
      select: ['id'],
    });

    let succeeded = 0;
    let failed = 0;
    const failures: Array<{ locationId: string; error: string }> = [];

    for (const location of locations) {
      try {
        await this.refreshMetrics(location.id);
        succeeded += 1;
      } catch (error) {
        failed += 1;
        const message = error instanceof Error ? error.message : String(error);
        this.logger.warn(
          `Failed to refresh metrics for location ${location.id}: ${message}`,
        );
        failures.push({ locationId: location.id, error: message });
      }
    }

    this.logger.log(
      `refreshAllMetrics finished: total=${locations.length} succeeded=${succeeded} failed=${failed}`,
    );

    return {
      total: locations.length,
      succeeded,
      failed,
      failures,
    };
  }

  /** Daily snapshot key, e.g. 2026-07-30 */
  private currentMetricPeriodKey(date: Date): string {
    const year = date.getUTCFullYear();
    const month = String(date.getUTCMonth() + 1).padStart(2, '0');
    const day = String(date.getUTCDate()).padStart(2, '0');
    return `${year}-${month}-${day}`;
  }

  async findLocationBySlug(slug: string): Promise<PublicLocationDto> {
    const location = await this.locationRepository.findOne({
      where: { slug },
      select: [
        'id',
        'name',
        'placeId',
        'slug',
        'city',
        'state',
        'primaryTypeDisplayName',
      ],
    });

    if (!location || !location.slug) {
      throw new NotFoundException(`Location with slug "${slug}" not found`);
    }

    const hasActiveSubscription =
      await this.subscriptionsService.hasActiveForLocation(location.id);
    if (!hasActiveSubscription) {
      throw new HttpException(
        'This business does not have an active subscription',
        HttpStatus.PAYMENT_REQUIRED,
      );
    }

    void this.safeIncrementScanMetric(location.id, 'scanCount');

    const { questions, keywords, languages } =
      await this.aiSettingsService.findPublicForRatingPage(location.id);

    return new PublicLocationDto({
      id: location.id,
      name: location.name,
      placeId: location.placeId,
      slug: location.slug,
      city: location.city,
      state: location.state,
      primaryTypeDisplayName: location.primaryTypeDisplayName,
      keywords,
      languages,
      questions,
    });
  }

  async incrementAiReviewCount(locationId: string): Promise<void> {
    void this.safeIncrementScanMetric(locationId, 'aiReviewCount');
  }

  async incrementRedirectToGoogleCount(
    locationId: string,
  ): Promise<LocationScanMetric> {
    try {
      return await this.incrementScanMetric(
        locationId,
        'redirectToGoogleCount',
      );
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundException(
          `Location with id "${locationId}" not found`,
        );
      }
      throw error;
    }
  }

  private async safeIncrementScanMetric(
    locationId: string,
    field: ScanMetricField,
  ): Promise<void> {
    try {
      await this.incrementScanMetric(locationId, field);
    } catch (error) {
      this.logger.warn(
        `Failed to increment ${field} for location ${locationId}: ${
          error instanceof Error ? error.message : String(error)
        }`,
      );
    }
  }

  private async incrementScanMetric(
    locationId: string,
    field: ScanMetricField,
  ): Promise<LocationScanMetric> {
    const date = this.todayUtcDate();
    const id = generateId();
    const scanCount = field === 'scanCount' ? 1 : 0;
    const aiReviewCount = field === 'aiReviewCount' ? 1 : 0;
    const redirectToGoogleCount = field === 'redirectToGoogleCount' ? 1 : 0;

    await this.scanMetricRepository.query(
      `
      INSERT INTO location_scan_metrics
        (id, "locationId", "date", "scanCount", "aiReviewCount", "redirectToGoogleCount", "createdAt", "updatedAt")
      VALUES
        ($1, $2, $3::date, $4, $5, $6, NOW(), NOW())
      ON CONFLICT ("locationId", "date")
      DO UPDATE SET
        "scanCount" = location_scan_metrics."scanCount" + EXCLUDED."scanCount",
        "aiReviewCount" = location_scan_metrics."aiReviewCount" + EXCLUDED."aiReviewCount",
        "redirectToGoogleCount" = location_scan_metrics."redirectToGoogleCount" + EXCLUDED."redirectToGoogleCount",
        "updatedAt" = NOW()
      `,
      [id, locationId, date, scanCount, aiReviewCount, redirectToGoogleCount],
    );

    const metric = await this.scanMetricRepository.findOne({
      where: { locationId, date },
    });

    if (!metric) {
      throw new NotFoundException(
        `Scan metrics for location "${locationId}" on ${date} not found after upsert`,
      );
    }

    return metric;
  }

  private todayUtcDate(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async withScanSummary(
    location: Location,
  ): Promise<LocationWithScanSummaryDto> {
    const [enriched] = await this.withScanSummaries([location]);
    return enriched;
  }

  private async withScanSummaries(
    locations: Location[],
  ): Promise<LocationWithScanSummaryDto[]> {
    if (locations.length === 0) {
      return [];
    }

    const ids = locations.map((location) => location.id);
    const today = this.todayUtcDate();
    const rows = await this.scanMetricRepository
      .createQueryBuilder('m')
      .select('m.locationId', 'locationId')
      .addSelect('COALESCE(SUM(m.scanCount), 0)', 'totalScanCount')
      .addSelect(
        `COALESCE(SUM(CASE WHEN m.date = :today::date THEN m.scanCount ELSE 0 END), 0)`,
        'todayScanCount',
      )
      .addSelect(
        'COALESCE(SUM(m.redirectToGoogleCount), 0)',
        'totalRedirectToGoogleCount',
      )
      .addSelect('COALESCE(SUM(m.aiReviewCount), 0)', 'totalAiReviewCount')
      .where('m.locationId IN (:...ids)', { ids })
      .setParameter('today', today)
      .groupBy('m.locationId')
      .getRawMany<ScanSummaryRow>();

    const summaryByLocationId = new Map(
      rows.map((row) => [
        row.locationId,
        {
          totalScanCount: Number(row.totalScanCount) || 0,
          todayScanCount: Number(row.todayScanCount) || 0,
          totalRedirectToGoogleCount:
            Number(row.totalRedirectToGoogleCount) || 0,
          totalAiReviewCount: Number(row.totalAiReviewCount) || 0,
        },
      ]),
    );

    return locations.map((location) => {
      const summary = summaryByLocationId.get(location.id);
      return Object.assign(location, {
        totalScanCount: summary?.totalScanCount ?? 0,
        todayScanCount: summary?.todayScanCount ?? 0,
        totalRedirectToGoogleCount: summary?.totalRedirectToGoogleCount ?? 0,
        totalAiReviewCount: summary?.totalAiReviewCount ?? 0,
      });
    });
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<LocationWithScanSummaryDto> {
    await this.findOne(id);

    const fields: Partial<Location> = {};
    if (updateLocationDto.name !== undefined) {
      fields.name = updateLocationDto.name;
    }
    if (updateLocationDto.placeId !== undefined) {
      fields.placeId = updateLocationDto.placeId;
    }
    if (updateLocationDto.addressLine1 !== undefined) {
      fields.addressLine1 = updateLocationDto.addressLine1;
    }
    if (updateLocationDto.city !== undefined) {
      fields.city = updateLocationDto.city;
    }
    if (updateLocationDto.state !== undefined) {
      fields.state = updateLocationDto.state;
    }
    if (updateLocationDto.pincode !== undefined) {
      fields.pincode = updateLocationDto.pincode;
    }
    if (updateLocationDto.country !== undefined) {
      fields.country = updateLocationDto.country;
    }
    if (updateLocationDto.formattedAddress !== undefined) {
      fields.formattedAddress = updateLocationDto.formattedAddress;
    }
    if (updateLocationDto.phoneNumber !== undefined) {
      fields.phoneNumber = updateLocationDto.phoneNumber;
    }
    if (updateLocationDto.websiteURI !== undefined) {
      fields.websiteURI = updateLocationDto.websiteURI;
    }
    if (updateLocationDto.googleMapsURI !== undefined) {
      fields.googleMapsURI = updateLocationDto.googleMapsURI;
    }
    if (updateLocationDto.businessStatus !== undefined) {
      fields.businessStatus = updateLocationDto.businessStatus;
    }
    if (updateLocationDto.primaryType !== undefined) {
      fields.primaryType = updateLocationDto.primaryType;
    }
    if (updateLocationDto.primaryTypeDisplayName !== undefined) {
      fields.primaryTypeDisplayName = updateLocationDto.primaryTypeDisplayName;
    }
    if (updateLocationDto.types !== undefined) {
      fields.types = updateLocationDto.types.length
        ? updateLocationDto.types
        : null;
    }

    try {
      await this.locationRepository.update(id, fields);
      return this.findOne(id);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(
          'This Google location is already added to your account',
        );
      }
      throw error;
    }
  }

  async remove(id: string): Promise<UpdateResult> {
    await this.findOne(id);
    return this.locationRepository.softDelete(id);
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23503'
    );
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
