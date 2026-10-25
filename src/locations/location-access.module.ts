import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from './entities/location.entity';
import { LocationAccessService } from './location-access.service';

/** Shared "does this business belong to the current user" check. */
@Module({
  imports: [TypeOrmModule.forFeature([Location])],
  providers: [LocationAccessService],
  exports: [LocationAccessService],
})
export class LocationAccessModule {}
