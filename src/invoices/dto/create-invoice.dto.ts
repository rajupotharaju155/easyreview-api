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
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { emptyToNull } from '../../common/utils/dto-transforms';
import { InvoiceDocumentType } from '../enums/invoice-document-type.enum';
import { GST_STATE_CODES } from '../gst/gst-states';
import { InvoiceBillToDto } from './invoice-bill-to.dto';
import { InvoiceItemDto } from './invoice-item.dto';

export const ISO_DATE_PATTERN = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
export const MAX_INVOICE_ITEMS = 100;

/** Creates a draft. Pass either a saved customerId or a one-off billTo. */
export class CreateInvoiceDto {
  @IsOptional()
  @IsEnum(InvoiceDocumentType)
  documentType?: InvoiceDocumentType;

  @ValidateIf((dto: CreateInvoiceDto) => !dto.billTo)
  @IsString()
  @MinLength(1)
  customerId?: string | null;

  @ValidateIf((dto: CreateInvoiceDto) => !dto.customerId)
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

  /** Defaults to the recipient's state, then the business's state. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(GST_STATE_CODES)
  placeOfSupplyStateCode?: string | null;

  @IsArray()
  @ArrayMinSize(1)
  @ArrayMaxSize(MAX_INVOICE_ITEMS)
  @ValidateNested({ each: true })
  @Type(() => InvoiceItemDto)
  items: InvoiceItemDto[];

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
