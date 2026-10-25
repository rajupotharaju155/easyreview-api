import { Type } from 'class-transformer';
import { IsInt, IsOptional, Matches, Max, Min } from 'class-validator';

export const YEAR_MONTH_PATTERN = /^\d{4}-(0[1-9]|1[0-2])$/;

export class CashMonthlySummaryQueryDto {
  /** How many months back, including the current one. */
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(24)
  months?: number;
}

export class CashCategorySummaryQueryDto {
  /** YYYY-MM. Defaults to the current month (IST). */
  @IsOptional()
  @Matches(YEAR_MONTH_PATTERN, { message: 'month must be YYYY-MM' })
  month?: string;
}
