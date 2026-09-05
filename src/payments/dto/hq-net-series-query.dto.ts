import { IsEnum } from 'class-validator';
import { NetSeriesRange } from '../enums/net-series-range.enum';

export class HqNetSeriesQueryDto {
  @IsEnum(NetSeriesRange)
  range: NetSeriesRange;
}
