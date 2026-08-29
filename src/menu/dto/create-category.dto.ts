import { Transform, Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { MAX_PRICE_VARIANTS } from '../menu-pricing';
import { PriceVariantDto } from './price-variant.dto';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateCategoryDto {
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  @MaxLength(120)
  name: string;

  @IsOptional()
  @IsArray()
  @ArrayMaxSize(MAX_PRICE_VARIANTS)
  @ValidateNested({ each: true })
  @Type(() => PriceVariantDto)
  priceVariants?: PriceVariantDto[];
}
