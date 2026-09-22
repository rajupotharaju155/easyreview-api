import { Transform } from 'class-transformer';
import {
  IsEmail,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';
import {
  PROFILE_LEAD_COMPANY_MAX_LENGTH,
  PROFILE_LEAD_EMAIL_MAX_LENGTH,
  PROFILE_LEAD_NAME_MAX_LENGTH,
  PROFILE_LEAD_NOTE_MAX_LENGTH,
  PROFILE_LEAD_PHONE_MAX_LENGTH,
} from '../entities/profile-lead.entity';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateProfileLeadDto {
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(PROFILE_LEAD_NAME_MAX_LENGTH)
  name: string;

  @Transform(trim)
  @IsString()
  @MinLength(4)
  @MaxLength(PROFILE_LEAD_PHONE_MAX_LENGTH)
  phone: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsEmail()
  @MaxLength(PROFILE_LEAD_EMAIL_MAX_LENGTH)
  email?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_LEAD_COMPANY_MAX_LENGTH)
  companyName?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(PROFILE_LEAD_NOTE_MAX_LENGTH)
  note?: string;
}
