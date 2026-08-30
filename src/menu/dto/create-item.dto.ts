import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsEnum,
  IsNumber,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
  ValidateNested,
} from 'class-validator';
import { MenuPriceType } from '../enums/menu-price-type.enum';
import { MAX_PRICE_VARIANTS } from '../menu-pricing';
import { ItemVariantPriceDto } from './price-variant.dto';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

function emptyToNull({ value }: { value: unknown }): unknown {
  if (value === null) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class CreateItemDto {
  @IsString()
  @MinLength(1)
  categoryId: string;

  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(160)
  name: string;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(600)
  description?: string | null;

  @IsOptional()
  @IsBoolean()
  isNonVeg?: boolean;

  @IsOptional()
  @IsBoolean()
  isNotAvailable?: boolean;

  @IsOptional()
  @Transform(emptyToNull)
  @IsString()
  @MaxLength(2048)
  imageUrl?: string | null;

  @IsOptional()
  @IsBoolean()
  isHalfServed?: boolean;

  @ValidateIf((dto: CreateItemDto) => dto.isHalfServed === true)
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  halfPrice?: number | null;

  @IsOptional()
  @IsEnum(MenuPriceType)
  priceType?: MenuPriceType;

  @IsOptional()
  @IsBoolean()
  isMultiPriced?: boolean;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRICE_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => ItemVariantPriceDto)
  variantPrices?: ItemVariantPriceDto[];

  @ValidateIf(
    (dto: CreateItemDto) =>
      dto.isMultiPriced !== true && dto.priceType !== MenuPriceType.FREE,
  )
  @Type(() => Number)
  @IsNumber({ maxDecimalPlaces: 2 })
  @Min(0)
  fullPrice?: number | null;
}
