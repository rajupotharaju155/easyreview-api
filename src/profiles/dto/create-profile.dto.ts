import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PROFILE_BIO_MAX_LENGTH,
  PROFILE_COMPANY_NAME_MAX_LENGTH,
  PROFILE_DESIGNATION_MAX_LENGTH,
  PROFILE_DISPLAY_NAME_MAX_LENGTH,
  PROFILE_EMAIL_MAX_LENGTH,
  PROFILE_PHONE_MAX_LENGTH,
} from '../entities/profile.entity';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateProfileDto {
  @IsString()
  @MinLength(1)
  @MaxLength(PROFILE_DISPLAY_NAME_MAX_LENGTH)
  displayName: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_DESIGNATION_MAX_LENGTH)
  designation?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_COMPANY_NAME_MAX_LENGTH)
  companyName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_BIO_MAX_LENGTH)
  bio?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_PHONE_MAX_LENGTH)
  phone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_PHONE_MAX_LENGTH)
  whatsappPhone?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(PROFILE_EMAIL_MAX_LENGTH)
  email?: string;
}
