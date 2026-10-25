import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';
import { ISO_DATE_PATTERN } from '../../invoices/dto/create-invoice.dto';
import {
  CASH_NOTES_MAX_LENGTH,
  CASH_PARTY_NAME_MAX_LENGTH,
  CASH_REFERENCE_MAX_LENGTH,
} from '../entities/cash-entry.entity';
import { CashEntryType } from '../enums/cash-entry-type.enum';
import { CashPaymentMethod } from '../enums/cash-payment-method.enum';

export const MAX_CASH_AMOUNT = 999_999_999_999;
export const MAX_CASH_ENTRIES_PER_BATCH = 50;

export class CreateCashEntryDto {
  @IsEnum(CashEntryType)
  type: CashEntryType;

  @IsString()
  @MinLength(1)
  categoryId: string;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0.01)
  @Max(MAX_CASH_AMOUNT)
  amount: number;

  /** YYYY-MM-DD. Defaults to today (IST). */
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(ISO_DATE_PATTERN, { message: 'entryDate must be YYYY-MM-DD' })
  entryDate?: string | null;

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

/** Several entries saved together, e.g. one day's expenses. All or none. */
export class CreateCashEntriesDto {
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_CASH_ENTRIES_PER_BATCH)
  @ValidateNested({ each: true })
  @Type(() => CreateCashEntryDto)
  entries: CreateCashEntryDto[];
}
