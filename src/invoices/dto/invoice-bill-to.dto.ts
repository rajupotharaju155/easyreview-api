import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsIn,
  IsOptional,
  IsString,
  Length,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  compactUpperOrNull,
  emptyToNull,
  emptyToUndefined,
  normalizePhoneOrNull,
} from '../../common/utils/dto-transforms';
import {
  PHONE_PATTERN,
  PINCODE_PATTERN,
} from '../../contacts/dto/create-customer.dto';
import { GST_STATE_CODES } from '../gst/gst-states';

/** Recipient for a one-off invoice that isn't tied to a saved customer. */
export class InvoiceBillToDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(160)
  companyName?: string | null;

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
  @IsString()
  @Length(15, 15)
  gstin?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(500)
  address?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(GST_STATE_CODES)
  stateCode?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(PINCODE_PATTERN, { message: 'pincode must be a 6-digit PIN code' })
  pincode?: string | null;
}
