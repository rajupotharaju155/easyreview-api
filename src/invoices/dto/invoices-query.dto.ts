import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { emptyToUndefined } from '../../common/utils/dto-transforms';
import { InvoicePaymentStatus } from '../enums/invoice-payment-status.enum';
import { InvoiceStatus } from '../enums/invoice-status.enum';

export class InvoicesQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(InvoiceStatus)
  status?: InvoiceStatus;

  /** Applies to issued invoices only. */
  @IsOptional()
  @IsEnum(InvoicePaymentStatus)
  paymentStatus?: InvoicePaymentStatus;

  /** Issued, not fully paid, and past the due date. */
  @IsOptional()
  @Transform(({ value }) => value === true || value === 'true')
  @IsBoolean()
  overdue?: boolean;

  @IsOptional()
  @IsString()
  @MinLength(1)
  customerId?: string;

  /** Matches invoice number or recipient name, company or phone. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
