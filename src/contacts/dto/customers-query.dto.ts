import { Transform } from 'class-transformer';
import { IsOptional, IsString, MaxLength } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { emptyToUndefined } from '../../common/utils/dto-transforms';

export class CustomersQueryDto extends PaginationDto {
  /** Matches name, company, phone, email or GSTIN. */
  @IsOptional()
  @Transform(emptyToUndefined)
  @IsString()
  @MaxLength(100)
  search?: string;
}
