export type HqPaymentSummaryBucketDto = {
  amount: number;
  subscriptionCount: number;
  from?: string;
  to?: string;
};

export class HqPaymentSummaryDto {
  currency: string;
  lifetime: HqPaymentSummaryBucketDto;
  thisMonth: HqPaymentSummaryBucketDto;
  lastMonth: HqPaymentSummaryBucketDto;

  constructor(data: HqPaymentSummaryDto) {
    Object.assign(this, data);
  }
}
