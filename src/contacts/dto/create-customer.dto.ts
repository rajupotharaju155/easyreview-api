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
import { GST_STATE_CODES } from '../../invoices/gst/gst-states';
import {
  CONTACT_COMPANY_MAX_LENGTH,
  CONTACT_EMAIL_MAX_LENGTH,
  CONTACT_NAME_MAX_LENGTH,
} from '../entities/contact.entity';
import {
  CUSTOMER_ADDRESS_MAX_LENGTH,
  CUSTOMER_CITY_MAX_LENGTH,
  CUSTOMER_GSTIN_LENGTH,
  CUSTOMER_NOTES_MAX_LENGTH,
} from '../entities/customer.entity';

export const PHONE_PATTERN = /^\+?[0-9]{7,15}$/;
export const PINCODE_PATTERN = /^[1-9][0-9]{5}$/;

export class CreateCustomerDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(CONTACT_NAME_MAX_LENGTH)
  name: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CONTACT_COMPANY_MAX_LENGTH)
  companyName?: string | null;

  @IsOptional()
  @Transform(normalizePhoneOrNull)
  @Matches(PHONE_PATTERN, { message: 'phone must be a valid phone number' })
  phone?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsEmail()
  @MaxLength(CONTACT_EMAIL_MAX_LENGTH)
  email?: string | null;

  @IsOptional()
  @Transform(compactUpperOrNull)
  @IsString()
  @Length(CUSTOMER_GSTIN_LENGTH, CUSTOMER_GSTIN_LENGTH)
  gstin?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CUSTOMER_ADDRESS_MAX_LENGTH)
  billingAddress?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CUSTOMER_CITY_MAX_LENGTH)
  city?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsIn(GST_STATE_CODES)
  stateCode?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @Matches(PINCODE_PATTERN, { message: 'pincode must be a 6-digit PIN code' })
  pincode?: string | null;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(CUSTOMER_NOTES_MAX_LENGTH)
  notes?: string | null;
}
