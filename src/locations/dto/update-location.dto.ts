import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import {
  emptyToNull,
  emptyToUndefined,
} from '../../common/utils/dto-transforms';

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(255)
  addressLine1?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  localArea?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  city?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  state?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(32)
  pincode?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(120)
  country?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  formattedAddress?: string | null;

  /** Blank clears the column. */
  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  phoneNumber?: string | null;

  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ require_protocol: true })
  websiteURI?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @ValidateIf((_, value) => value !== undefined)
  @IsUrl({ require_protocol: true })
  googleMapsURI?: string;

  @IsOptional()
  @Type(() => Number)
  @IsNumber()
  @Min(0)
  @Max(5)
  rating?: number;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  userRatingCount?: number;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  businessStatus?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  primaryType?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  primaryTypeDisplayName?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  types?: string[];

  /** ISO 4217 code, e.g. "INR", "USD". */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string' ? value.trim().toUpperCase() : value,
  )
  @Matches(/^[A-Z]{3}$/, { message: 'currency must be a 3-letter ISO code' })
  currency?: string;

  /** IANA time zone, e.g. "Asia/Kolkata". */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(64)
  timezone?: string;
}
