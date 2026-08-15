import { IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class SubscriptionsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  locationId?: string;
}
