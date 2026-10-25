import { Transform, Type } from 'class-transformer';
import {
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  emptyToNull,
  emptyToUndefined,
} from '../../common/utils/dto-transforms';
import {
  INVOICE_ITEM_DESCRIPTION_MAX_LENGTH,
  INVOICE_ITEM_UNIT_MAX_LENGTH,
} from '../entities/invoice-item.entity';
import { GST_RATES } from '../invoice-calculator';

const MAX_AMOUNT = 999_999_999_999;

export class InvoiceItemDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(INVOICE_ITEM_DESCRIPTION_MAX_LENGTH)
  description: string;

  /** HSN (goods) or SAC (services): 4, 6 or 8 digits. */
  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^\d{4}(\d{2}){0,2}$/, {
    message: 'hsnSacCode must be 4, 6 or 8 digits',
  })
  hsnSacCode?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 3 })
  @Min(0.001)
  @Max(10_000_000)
  quantity: number;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(INVOICE_ITEM_UNIT_MAX_LENGTH)
  unit?: string | null;

  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  unitPrice: number;

  @IsOptional()
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  @Max(MAX_AMOUNT)
  discountAmount?: number | null;

  @IsOptional()
  @Type(() => Number)
  @IsIn(GST_RATES as readonly number[])
  taxRate?: number | null;
}
