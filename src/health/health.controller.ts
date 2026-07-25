import { Controller, Get } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';

@Controller('health')
@Public()
export class HealthController {
  /**
   * Returns API health status
   */
  @Get()
  getHealth() {
    return {
      status: 'success',
      message: 'EasyReview API is healthy and running',
      timestamp: new Date().toISOString(),
      uptime: `${Math.floor(process.uptime())} seconds`,
      environment: process.env.NODE_ENV || 'development',
      version: '1.0.0',
    };
  }
}
