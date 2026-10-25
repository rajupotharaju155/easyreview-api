import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { emptyToUndefined } from '../../common/utils/dto-transforms';
import { ISO_DATE_PATTERN } from '../../invoices/dto/create-invoice.dto';
import { CashEntryType } from '../enums/cash-entry-type.enum';

export class CashEntriesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(CashEntryType)
  type?: CashEntryType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'from must be YYYY-MM-DD' })
  from?: string;

  @IsOptional()
  @Matches(ISO_DATE_PATTERN, { message: 'to must be YYYY-MM-DD' })
  to?: string;

  /** Matches party, reference, notes or invoice number. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
