import { Controller, Get, Param, Query } from '@nestjs/common';
import { AnalyticsService } from './analytics.service';
import { ReviewGrowthQueryDto } from './dto/review-growth-query.dto';
import { ReviewGrowthResponseDto } from './dto/review-growth-response.dto';

@Controller('analytics')
export class AnalyticsController {
  constructor(private readonly analyticsService: AnalyticsService) {}

  @Get('locations/:locationId/reviews')
  getReviewGrowth(
    @Param('locationId') locationId: string,
    @Query() query: ReviewGrowthQueryDto,
  ): Promise<ReviewGrowthResponseDto> {
    return this.analyticsService.getReviewGrowth(locationId, query);
  }
}
