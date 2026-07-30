export type ReviewGrowthPointDto = {
  period: string;
  rating: number | null;
  reviewCount: number | null;
  reviewCountDelta: number | null;
  ratingDelta: number | null;
  capturedAt: string | null;
};

export type ReviewGrowthBaselineDto = {
  rating: number | null;
  reviewCount: number | null;
  capturedAt: string | null;
};

export class ReviewGrowthResponseDto {
  locationId: string;
  granularity: 'daily' | 'monthly';
  baseline: ReviewGrowthBaselineDto | null;
  series: ReviewGrowthPointDto[];

  constructor(data: ReviewGrowthResponseDto) {
    Object.assign(this, data);
  }
}
