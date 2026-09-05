import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { HqDeletedFilter } from '../enums/hq-deleted-filter.enum';

export class HqLocationsQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  userId?: string;

  @IsOptional()
  @IsEnum(HqDeletedFilter)
  deleted?: HqDeletedFilter = HqDeletedFilter.ACTIVE;
}
