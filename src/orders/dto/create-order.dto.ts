import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsString,
  Matches,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DeliveryTo } from '../enums/delivery-to.enum';
import { DesignVariant } from '../enums/design-variant.enum';

function emptyToUndefined({ value }: { value: unknown }): unknown {
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : undefined;
}

export class CreateOrderDto {
  @IsString()
  @MinLength(1)
  locationId: string;

  @IsEnum(DesignVariant)
  designVariant: DesignVariant;

  @IsEnum(DeliveryTo)
  deliveryTo: DeliveryTo;

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine1?: string;

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine2?: string;

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @MinLength(1)
  addressLine3?: string;

  @ValidateIf((dto: CreateOrderDto) => dto.deliveryTo === DeliveryTo.OTHER)
  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be a 6-digit number' })
  pincode?: string;

  @Transform(emptyToUndefined)
  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid 10-digit mobile number',
  })
  phoneNumber: string;
}
