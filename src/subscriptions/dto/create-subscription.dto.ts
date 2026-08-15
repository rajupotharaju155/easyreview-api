import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreateSubscriptionDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @IsString()
  @MinLength(1)
  planId: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(/^\d{4}-\d{2}-\d{2}$/, {
    message: 'startDate must be YYYY-MM-DD',
  })
  startDate?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
