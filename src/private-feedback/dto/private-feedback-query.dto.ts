import { Type } from 'class-transformer';
import { IsInt, IsOptional, IsString, Max, Min, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';

export class PrivateFeedbackQueryDto extends PaginationDto {
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(3)
  rating?: number;

  @IsOptional()
  @IsString()
  @MinLength(1)
  locationId?: string;
}
