import { IsIn, IsOptional, IsString, Matches } from 'class-validator';

export class ReviewGrowthQueryDto {
  @IsIn(['daily', 'monthly'])
  granularity: 'daily' | 'monthly';

  /** Inclusive start date YYYY-MM-DD (daily) or YYYY-MM (monthly). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/)
  from?: string;

  /** Inclusive end date YYYY-MM-DD (daily) or YYYY-MM (monthly). */
  @IsOptional()
  @IsString()
  @Matches(/^\d{4}-\d{2}(-\d{2})?$/)
  to?: string;
}
