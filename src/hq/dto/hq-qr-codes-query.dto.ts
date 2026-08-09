import { Transform } from 'class-transformer';
import { IsOptional, IsPositive, IsString, Max, Min, MinLength } from 'class-validator';

export class HqQrCodesQueryDto {
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
  limit?: number = 20;

  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  batchId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  locationId?: string;
}
