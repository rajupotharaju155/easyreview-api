import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class HqPaymentsQueryDto extends PaginationDto {
  @IsOptional()
  @IsEnum(PaymentKind)
  kind?: PaymentKind;

  @IsOptional()
  @IsEnum(PaymentStatus)
  status?: PaymentStatus;

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
