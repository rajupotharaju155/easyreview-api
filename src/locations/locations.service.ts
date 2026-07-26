import {
  ConflictException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { EntityManager, QueryFailedError, Repository, UpdateResult } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import {
  slugCandidatesFromName,
  slugWithSuffix,
} from '../common/utils/slug.util';
import { CreateLocationDto } from './dto/create-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import {
  LOCATION_METRIC_PERIOD_BASELINE,
  LocationMetric,
} from './entities/location-metric.entity';
import { Location } from './entities/location.entity';
import { Review } from './entities/review.entity';

@Injectable()
export class LocationsService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async create(createLocationDto: CreateLocationDto): Promise<Location> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const capturedAt = new Date();

    try {
      return await this.locationRepository.manager.transaction(
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
  ): Promise<PaginatedResponseDto<Location>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const { page = 1, limit = 10 } = paginationDto;
    const skip = (page - 1) * limit;

    const [data, total] = await this.locationRepository.findAndCount({
      where: { userId },
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });

    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOne(id: string): Promise<Location> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const location = await this.locationRepository.findOne({
      where: { id, userId },
    });

    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }

    return location;
  }

  async update(
    id: string,
    updateLocationDto: UpdateLocationDto,
  ): Promise<Location> {
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
    if (updateLocationDto.keywords !== undefined) {
      fields.keywords = updateLocationDto.keywords.length
        ? updateLocationDto.keywords
        : null;
    }
    if (updateLocationDto.languages !== undefined) {
      fields.languages = updateLocationDto.languages.length
        ? updateLocationDto.languages
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
