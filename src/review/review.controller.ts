import { Body, Controller, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { ReviewSuggestionsResponseDto } from './dto/review-suggestions-response.dto';
import { SuggestReviewsDto } from './dto/suggest-reviews.dto';
import { ReviewService } from './review.service';

@Controller('review')
@Public()
export class ReviewController {
  constructor(private readonly reviewService: ReviewService) {}

  @Post('suggestions')
  suggestReviews(
    @Body() suggestReviewsDto: SuggestReviewsDto,
  ): Promise<ReviewSuggestionsResponseDto> {
    return this.reviewService.suggestReviews(suggestReviewsDto);
  }
}
