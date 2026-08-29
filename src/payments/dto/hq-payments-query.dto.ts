import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentProvider } from '../enums/payment-provider.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class HqPaymentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

  @IsOptional()
  @IsEnum(PaymentProvider)
  provider?: PaymentProvider;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  locationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  subscriptionId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  orderId?: string;
}
