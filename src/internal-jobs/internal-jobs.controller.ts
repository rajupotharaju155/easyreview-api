import { Controller, HttpCode, HttpStatus, Post, UseGuards } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { LocationsService } from '../locations/locations.service';
import { CronSecretGuard } from './guards/cron-secret.guard';

@Controller('internal/jobs')
@Public()
@UseGuards(CronSecretGuard)
export class InternalJobsController {
  constructor(private readonly locationsService: LocationsService) {}

  /**
   * Bulk-refresh Google Places metrics for all locations.
   * Invoked by Cloud Scheduler (9am / 3pm / 9pm IST).
   */
  @Public()
  @Post('refresh-location-metrics')
  @HttpCode(HttpStatus.OK)
  async refreshLocationMetrics(): Promise<{
    total: number;
    succeeded: number;
    failed: number;
    failures: Array<{ locationId: string; error: string }>;
  }> {
    return this.locationsService.refreshAllMetrics();
  }
}
