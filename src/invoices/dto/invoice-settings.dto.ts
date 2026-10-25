import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  Length,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  compactUpperOrNull,
  emptyToNull,
  emptyToUndefined,
  normalizePhoneOrNull,
} from '../../common/utils/dto-transforms';
import { PHONE_PATTERN } from '../../contacts/dto/create-customer.dto';
import { GST_STATE_CODES } from '../gst/gst-states';
import { INVOICE_PREFIX_PATTERN } from '../invoice-number';

/** Full replace of the business's invoice settings. */
export class UpdateInvoiceSettingsDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  legalName: string;

  @IsOptional()
  @Transform(compactUpperOrNull)
  @IsString()
  @Length(15, 15)
  gstin?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(GST_STATE_CODES)
  stateCode?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(normalizePhoneOrNull)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail()
  @MaxLength(254)
  email?: string | null;

  @IsOptional()
  @Transform(compactUpperOrNull)
  @Matches(INVOICE_PREFIX_PATTERN, {
    message: 'invoicePrefix must be 1-4 letters or digits',
  })
  invoicePrefix?: string | null;

  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(365)
  defaultDueDays?: number | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  defaultNotes?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2000)
  defaultTerms?: string | null;

  @IsOptional()
  @IsBoolean()
  roundOffTotal?: boolean;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  bankAccountName?: string | null;

  @IsOptional()
  @Transform(compactUpperOrNull)
  @Matches(/^[0-9A-Z]{6,34}$/, { message: 'bankAccountNumber is not valid' })
  bankAccountNumber?: string | null;

  @IsOptional()
  @Transform(compactUpperOrNull)
  @Matches(/^[A-Z]{4}0[A-Z0-9]{6}$/, { message: 'bankIfsc is not valid' })
  bankIfsc?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  bankName?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(/^[\w.-]{2,256}@[a-zA-Z]{2,64}$/, { message: 'upiId is not valid' })
  upiId?: string | null;
}
