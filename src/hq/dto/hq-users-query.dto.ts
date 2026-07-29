import { IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class HqUsersQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;
}
