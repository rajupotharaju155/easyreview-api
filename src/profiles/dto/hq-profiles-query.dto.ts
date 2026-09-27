import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { HqDeletedFilter } from '../../hq/enums/hq-deleted-filter.enum';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

/**
 * Query parameters for `GET /hq/profiles`.
 * Search matches profile id, slug, or display name (case-insensitive).
 * `deleted` follows the standard HQ filter: active by default.
 */
export class HqProfilesQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  userId?: string;

  @IsOptional()
  @IsEnum(HqDeletedFilter)
  deleted?: HqDeletedFilter = HqDeletedFilter.ACTIVE;
}
