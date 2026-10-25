import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  Min,
} from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';
import { CashPaymentMethod } from '../../cash/enums/cash-payment-method.enum';
import { ISO_DATE_PATTERN } from './create-invoice.dto';

export class CreateInvoicePaymentDto {
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  amount: number;

  /** YYYY-MM-DD. Defaults to today (IST). */
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(ISO_DATE_PATTERN, { message: 'paidOn must be YYYY-MM-DD' })
  paidOn?: string | null;

  @IsEnum(CashPaymentMethod)
  method: CashPaymentMethod;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(100)
  referenceNumber?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  notes?: string | null;
}
