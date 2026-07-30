import { Module } from '@nestjs/common';
import { LocationsModule } from '../locations/locations.module';
import { CronSecretGuard } from './guards/cron-secret.guard';
import { InternalJobsController } from './internal-jobs.controller';

@Module({
  imports: [LocationsModule],
  controllers: [InternalJobsController],
  providers: [CronSecretGuard],
})
export class InternalJobsModule {}
