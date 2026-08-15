import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class MarkPaymentSuccessDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  utr?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
