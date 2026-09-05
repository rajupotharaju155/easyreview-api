import { Transform } from 'class-transformer';
import { IsOptional, IsString, Matches, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class HqExpensesQueryDto extends PaginationDto {
  @IsOptional()
  @IsString()
  @MinLength(1)
  categoryId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  locationId?: string;

  @IsOptional()
  @IsString()
  @MinLength(1)
  orderId?: string;

  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @Transform(trimString)
  @Matches(/^\d{4}-(0[1-9]|1[0-2])$/, {
    message: 'month must be YYYY-MM',
  })
  month?: string;
}
