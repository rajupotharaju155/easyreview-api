import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsEnum,
  IsIn,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';
import { InvoiceDocumentType } from '../enums/invoice-document-type.enum';
import { GST_STATE_CODES } from '../gst/gst-states';
import { ISO_DATE_PATTERN, MAX_INVOICE_ITEMS } from './create-invoice.dto';
import { InvoiceBillToDto } from './invoice-bill-to.dto';
import { InvoiceItemDto } from './invoice-item.dto';

/**
 * Edits a draft. `items` replaces the whole list. To switch from a saved
 * customer to a one-off recipient, send `customerId: null` with `billTo`.
 */
export class UpdateInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  documentType?: InvoiceDocumentType;

  @IsOptional()
  @IsString()
  @MinLength(1)
  customerId?: string | null;

  @IsOptional()
  @ValidateNested()
  @Type(() => InvoiceBillToDto)
  billTo?: InvoiceBillToDto | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(ISO_DATE_PATTERN, { message: 'issueDate must be YYYY-MM-DD' })
  issueDate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(ISO_DATE_PATTERN, { message: 'dueDate must be YYYY-MM-DD' })
  dueDate?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(GST_STATE_CODES)
  placeOfSupplyStateCode?: string | null;

  @IsOptional()
  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVOICE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items?: InvoiceItemDto[];

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  notes?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  terms?: string | null;
}
