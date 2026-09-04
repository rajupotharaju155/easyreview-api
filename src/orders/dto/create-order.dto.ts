import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Matches,
  Max,
  MaxLength,
  Min,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DeliveryTo } from '../enums/delivery-to.enum';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @IsString()
  @MinLength(1)
  @MaxLength(16)
  productId: string;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1, { message: 'Quantity must be at least 1' })
  @Max(50, { message: 'Quantity cannot exceed 50' })
  quantity?: number;

  @IsEnum(DeliveryTo)
  deliveryTo: DeliveryTo;

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine1?: string; //street address

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine2?: string; // city

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine3?: string; // state

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be a 6-digit number' })
  pincode?: string; // postal code

  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid 10-digit mobile number',
  })
  phoneNumber: string;
}
