import { Transform, Type } from 'class-transformer';
import {
  IsArray,
  IsInt,
  IsNumber,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class UpdateLocationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  placeId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  city?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  state?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  pincode?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  country?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  formattedAddress?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  phoneNumber?: string;

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

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  keywords?: string[];

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  languages?: string[];
}
