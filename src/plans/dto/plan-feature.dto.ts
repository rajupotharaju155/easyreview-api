import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class PlanFeatureDto {
  @Transform(trimString)
  @IsString()
  @Matches(/^[a-z][a-z0-9_]*$/, {
    message: 'Feature id must be lowercase letters, numbers, and underscores',
  })
  @MaxLength(64)
  id: string;

  @Transform(trimString)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsBoolean()
  isIncluded: boolean;
}
