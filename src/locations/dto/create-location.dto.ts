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
  ValidateNested,
} from 'class-validator';
import { emptyToUndefined } from '../../common/utils/dto-transforms';
import { CreateReviewDto } from './create-review.dto';

export class CreateLocationDto {
  @IsString()
  @MinLength(1)
  name: string;

  /** Omitted for a business that is not on Google. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  placeId?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  addressLine1?: string;

  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  localArea?: string;

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
  @ValidateNested({ each: true })
  @Type(() => CreateReviewDto)
  reviews?: CreateReviewDto[];
}
