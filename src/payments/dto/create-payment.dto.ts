import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateIf,
} from 'class-validator';
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class CreatePaymentDto {
  @IsEnum(PaymentKind)
  kind: PaymentKind;

  @ValidateIf((dto: CreatePaymentDto) => dto.kind === PaymentKind.SUBSCRIPTION)
  @IsString()
  @MinLength(1)
  subscriptionId?: string;

  @ValidateIf((dto: CreatePaymentDto) => dto.kind === PaymentKind.ORDER)
  @IsString()
  @MinLength(1)
  orderId?: string;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  utr?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  notes?: string;
}
