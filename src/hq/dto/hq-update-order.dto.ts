import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { DesignVariant } from '../../orders/enums/design-variant.enum';
import { OrderStatus } from '../../orders/enums/order-status.enum';

function emptyToNull({ value }: { value: unknown }): unknown {
  if (value === null || value === undefined) return null;
  if (typeof value !== 'string') return value;
  const trimmed = value.trim();
  return trimmed.length > 0 ? trimmed : null;
}

export class HqUpdateOrderDto {
  // Omit to keep the order on its current design. Orders placed on a retired
  // design keep a variant that is no longer in the enum, and must stay editable.
  @IsOptional()
  @IsEnum(DesignVariant)
  designVariant?: DesignVariant;

  @IsString()
  @Matches(/^[6-9]\d{9}$/, {
    message: 'Phone number must be a valid 10-digit mobile number',
  })
  phoneNumber: string;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(1)
  addressLine1?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(1)
  addressLine2?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MinLength(1)
  addressLine3?: string | null;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @Matches(/^\d{6}$/, { message: 'Pincode must be a 6-digit number' })
  pincode?: string | null;

  @IsEnum(OrderStatus)
  status: OrderStatus;

  @Transform(emptyToNull)
  @IsOptional()
  @ValidateIf((_, value) => value != null)
  @IsString()
  @MaxLength(500)
  statusNote?: string | null;
}
