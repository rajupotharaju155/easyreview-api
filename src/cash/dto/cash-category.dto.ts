import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { emptyToUndefined } from '../../common/utils/dto-transforms';
import { CASH_CATEGORY_NAME_MAX_LENGTH } from '../entities/cash-category.entity';
import { CashEntryType } from '../enums/cash-entry-type.enum';

export class CreateCashCategoryDto {
  @IsEnum(CashEntryType)
  type: CashEntryType;

  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(CASH_CATEGORY_NAME_MAX_LENGTH)
  name: string;
}

export class UpdateCashCategoryDto {
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(CASH_CATEGORY_NAME_MAX_LENGTH)
  name?: string;

  /** false restores an archived category. */
  @IsOptional()
  @IsBoolean()
  archived?: boolean;
}

export class CashCategoriesQueryDto {
  @IsOptional()
  @IsEnum(CashEntryType)
  type?: CashEntryType;

  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  includeArchived?: boolean;
}
