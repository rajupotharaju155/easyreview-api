import { Transform } from 'class-transformer';
import { IsOptional, IsPositive, Max, Min } from 'class-validator';

export class PaginationDto {
  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsPositive({ message: 'Page must be a positive number' })
  @Min(1, { message: 'Page must be at least 1' })
  page?: number = 1;

  @IsOptional()
  @Transform(({ value }) => parseInt(value as string, 10))
  @IsPositive({ message: 'Limit must be a positive number' })
  @Min(1, { message: 'Limit must be at least 1' })
  @Max(100, { message: 'Limit cannot exceed 100' })
  limit?: number = 10;
}
