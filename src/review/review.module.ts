import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { ReviewController } from './review.controller';
import { ReviewService } from './review.service';

@Module({
  imports: [LocationsModule],
  controllers: [ReviewController],
  providers: [ReviewService],
})
export class ReviewModule {}
