import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { AiSettingsService } from './ai-settings.service';
import { AiSettingsResponseDto } from './dto/ai-settings-response.dto';
import { UpsertAiSettingsDto } from './dto/upsert-ai-settings.dto';

@Controller('locations/:locationId/ai-settings')
export class AiSettingsController {
  constructor(private readonly aiSettingsService: AiSettingsService) {}

  @Get()
  find(
    @Param('locationId') locationId: string,
  ): Promise<AiSettingsResponseDto> {
    return this.aiSettingsService.findForOwnedLocation(locationId);
  }

  @Put()
  upsert(
    @Param('locationId') locationId: string,
    @Body() upsertAiSettingsDto: UpsertAiSettingsDto,
  ): Promise<AiSettingsResponseDto> {
    return this.aiSettingsService.upsertForOwnedLocation(
      locationId,
      upsertAiSettingsDto,
    );
  }
}
