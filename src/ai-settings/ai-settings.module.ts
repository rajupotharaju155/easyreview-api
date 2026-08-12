import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { AiSettingsController } from './ai-settings.controller';
import { AiSettingsService } from './ai-settings.service';
import { AiSettings } from './entities/ai-settings.entity';

@Module({
  imports: [TypeOrmModule.forFeature([AiSettings, Location])],
  controllers: [AiSettingsController],
  providers: [AiSettingsService],
  exports: [AiSettingsService],
})
export class AiSettingsModule {}
