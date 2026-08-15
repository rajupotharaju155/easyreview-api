import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength, ValidateIf } from 'class-validator';

function emptyToNull({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class SubmitPaymentDto {
  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(64)
  utr?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
