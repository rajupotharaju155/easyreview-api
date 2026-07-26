import { Location } from '../entities/location.entity';

export type LocationWithScanSummaryDto = Location & {
  totalScanCount: number;
  todayScanCount: number;
};
