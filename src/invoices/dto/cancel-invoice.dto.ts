import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';

export class CancelInvoiceDto {
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  reason?: string | null;
}
