export type HqExpenseSummaryBucketDto = {
  amount: number;
  count: number;
  from?: string;
  to?: string;
};

export class HqExpenseSummaryDto {
  currency: string;
  lifetime: HqExpenseSummaryBucketDto;
  thisMonth: HqExpenseSummaryBucketDto;
  lastMonth: HqExpenseSummaryBucketDto;

  constructor(data: HqExpenseSummaryDto) {
    Object.assign(this, data);
  }
}
