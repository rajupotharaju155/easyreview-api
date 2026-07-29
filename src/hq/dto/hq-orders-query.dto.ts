import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { OrderStatus } from '../../orders/enums/order-status.enum';

export class HqOrdersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  id?: string;

  @IsOptional()
  @IsEnum(OrderStatus)
  status?: OrderStatus;

  @IsOptional()
  @IsString()
  @MinLength(1)
  name?: string;
}
