import { Controller, Get, Param } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { ProfileCompletenessResponseDto } from './dto/profile-completeness-response.dto';

@Controller('locations/:locationId/profile-completeness')
export class ProfileCompletenessController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  get(
    @Param('locationId') locationId: string,
  ): Promise<ProfileCompletenessResponseDto> {
    return this.aiSettingsService.getProfileCompleteness(locationId);
  }
}
