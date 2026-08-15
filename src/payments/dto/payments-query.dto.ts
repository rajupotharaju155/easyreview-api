import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { PaymentKind } from '../enums/payment-kind.enum';
import { PaymentStatus } from '../enums/payment-status.enum';

export class PaymentsQueryDto extends PaginationDto {
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
}
