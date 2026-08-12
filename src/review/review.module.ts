import { Module } from '@nestjs/common';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { LocationsModule } from '../locations/locations.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [LocationsModule, AiSettingsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
