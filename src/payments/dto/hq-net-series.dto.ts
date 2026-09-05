import { NetSeriesRange } from '../enums/net-series-range.enum';

export type HqNetSeriesPointDto = {
  key: string;
  label: string;
  from: string;
  to: string;
  payments: number;
  expenses: number;
};

export class HqNetSeriesDto {
  currency: string;
  range: NetSeriesRange;
  points: HqNetSeriesPointDto[];

  constructor(data: HqNetSeriesDto) {
    Object.assign(this, data);
  }
}
