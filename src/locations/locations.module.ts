import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { LocationMetric } from './entities/location-metric.entity';
import { LocationScanMetric } from './entities/location-scan-metric.entity';
import { Location } from './entities/location.entity';
import { Review } from './entities/review.entity';
import { GooglePlacesService } from '../services/google-places.service';
import { LocationsController } from './locations.controller';
import { LocationsService } from './locations.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Location,
      LocationMetric,
      LocationScanMetric,
      Review,
    ]),
    AiSettingsModule,
  ],
  controllers: [LocationsController],
  providers: [LocationsService, GooglePlacesService],
  exports: [LocationsService],
})
export class LocationsModule {}
