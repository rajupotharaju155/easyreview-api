import { Transform } from 'class-transformer';
import { IsEnum, IsOptional, Matches } from 'class-validator';
import { PaginationDto } from '../../common/dto/pagination.dto';
import { MenuOrderStatus } from '../enums/menu-order-status.enum';

export class MenuOrdersQueryDto extends PaginationDto {
  /** One or more statuses, comma-separated, e.g. "new,accepted,ready". */
  @IsOptional()
  @Transform(({ value }: { value: unknown }) =>
    typeof value === 'string'
      ? value
          .split(',')
          .map((part) => part.trim())
          .filter(Boolean)
      : value,
  )
  @IsEnum(MenuOrderStatus, { each: true })
  status?: MenuOrderStatus[];

  /** YYYY-MM-DD in the business's time zone. */
  @IsOptional()
  @Matches(/^\d{4}-\d{2}-\d{2}$/, { message: 'date must be YYYY-MM-DD' })
  date?: string;
}
