import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  IsUrl,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';
import {
  PROFILE_LINK_LABEL_MAX_LENGTH,
  PROFILE_LINK_URL_MAX_LENGTH,
  ProfileLinkType,
} from '../entities/profile-link.entity';

function trim({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class UpdateProfileLinkDto {
  @IsOptional()
  @IsEnum(ProfileLinkType)
  type?: ProfileLinkType;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MinLength(1)
  @MaxLength(PROFILE_LINK_LABEL_MAX_LENGTH)
  label?: string;

  @IsOptional()
  @Transform(trim)
  @IsString()
  @MaxLength(PROFILE_LINK_URL_MAX_LENGTH)
  @IsUrl({ require_protocol: true, protocols: ['http', 'https'] })
  url?: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  sortOrder?: number;
}
