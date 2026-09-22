import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsEmail,
  IsOptional,
  IsString,
  Matches,
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
  PROFILE_SLUG_MAX_LENGTH,
} from '../entities/profile.entity';

/** Trim whitespace but keep an intentional null (e.g. "clear this field"). */
function trimOrNull({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

/** Slug pattern matches the location slug format used across EasyReview. */
export const PROFILE_SLUG_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export class UpdateProfileDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  @MaxLength(PROFILE_DISPLAY_NAME_MAX_LENGTH)
  displayName?: string;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PROFILE_DESIGNATION_MAX_LENGTH)
  designation?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PROFILE_COMPANY_NAME_MAX_LENGTH)
  companyName?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PROFILE_BIO_MAX_LENGTH)
  bio?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PROFILE_PHONE_MAX_LENGTH)
  phone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsString()
  @MaxLength(PROFILE_PHONE_MAX_LENGTH)
  whatsappPhone?: string | null;

  @IsOptional()
  @Transform(trimOrNull)
  @IsEmail()
  @MaxLength(PROFILE_EMAIL_MAX_LENGTH)
  email?: string | null;

  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(PROFILE_SLUG_MAX_LENGTH)
  @Matches(PROFILE_SLUG_PATTERN, {
    message:
      'Slug can only contain lowercase letters, numbers, and hyphens (no leading, trailing, or repeated hyphens)',
  })
  slug?: string;

  @IsOptional()
  @IsBoolean()
  isPublished?: boolean;
}
