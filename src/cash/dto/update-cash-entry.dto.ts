import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';
import { ISO_DATE_PATTERN } from '../../invoices/dto/create-invoice.dto';
import {
  CASH_NOTES_MAX_LENGTH,
  CASH_PARTY_NAME_MAX_LENGTH,
  CASH_REFERENCE_MAX_LENGTH,
} from '../entities/cash-entry.entity';
import { CashPaymentMethod } from '../enums/cash-payment-method.enum';
import { MAX_CASH_AMOUNT } from './create-cash-entry.dto';

/** The type (income/expense) is fixed once created. */
export class UpdateCashEntryDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CASH_AMOUNT)
  amount?: number;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'entryDate must be YYYY-MM-DD' })
  entryDate?: string;

  @IsOptional()
  @IsEnum(CashPaymentMethod)
  paymentMethod?: CashPaymentMethod | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CASH_PARTY_NAME_MAX_LENGTH)
  partyName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CASH_REFERENCE_MAX_LENGTH)
  referenceNumber?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CASH_NOTES_MAX_LENGTH)
  notes?: string | null;
}
