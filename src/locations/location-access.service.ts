import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository, SelectQueryBuilder } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from './entities/location.entity';

/** Checks that a location (business) belongs to the current user. */
@Injectable()
export class LocationAccessService {
  constructor(
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  /** The current user's location, or 404. */
  async requireOwned(locationId: string): Promise<void> {
    if (!(await this.ownedQuery(locationId).getExists())) {
      throw this.notFound(locationId);
    }
  }

  /**
   * Query for the location, limited to the current user's. Callers add
   * selects and joins to load what they need in the same query.
   */
  ownedQuery(locationId: string): SelectQueryBuilder<Location> {
    return this.locationRepository
      .createQueryBuilder('location')
      .where('location.id = :locationId', { locationId })
      .andWhere('location.userId = :userId', {
        userId: this.currentUserUtil.getCurrentUserId(),
      });
  }

  notFound(locationId: string): NotFoundException {
    return new NotFoundException(`Location with id "${locationId}" not found`);
  }
}
