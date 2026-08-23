import { Transform, Type } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
} from 'class-validator';
import { PaymentProvider } from '../../payments/enums/payment-provider.enum';
import { PaymentStatus } from '../../payments/enums/payment-status.enum';
import { CreateSubscriptionDto } from './create-subscription.dto';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class HqCreateSubscriptionDto extends CreateSubscriptionDto {
  @IsOptional()
  @IsEnum(PaymentProvider)
  paymentProvider?: PaymentProvider;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(64)
  utr?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MaxLength(500)
  paymentNotes?: string;

  @IsOptional()
  @IsIn([PaymentStatus.PENDING, PaymentStatus.SUCCESS])
  paymentStatus?: PaymentStatus.PENDING | PaymentStatus.SUCCESS;

  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(0)
  discountAmount?: number;
}
