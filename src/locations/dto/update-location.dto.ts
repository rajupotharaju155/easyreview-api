import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
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
}
