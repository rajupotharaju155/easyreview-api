import { Transform } from 'class-transformer';
import {
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';

function emptyToNull({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class HqUpdateUserDto {
  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name?: string | null;
}
