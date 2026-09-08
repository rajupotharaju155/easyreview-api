import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { SubmittedFrom } from '../enums/submitted-from.enum';

function trimString({ value }: { value: unknown }): unknown {
  return typeof value === 'string' ? value.trim() : value;
}

export class HqContactMessagesQueryDto extends PaginationDto {
  @IsOptional()
  @Transform(trimString)
  @IsString()
  @MinLength(1)
  search?: string;

  @IsOptional()
  @IsEnum(SubmittedFrom)
  submittedFrom?: SubmittedFrom;
}
