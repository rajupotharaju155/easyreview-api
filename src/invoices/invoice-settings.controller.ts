import { Body, Controller, Get, Param, Put } from '@nestjs/common';
import { UpdateInvoiceSettingsDto } from './dto/invoice-settings.dto';
import { InvoiceSettingsService } from './invoice-settings.service';

@Controller('locations/:locationId/invoice-settings')
export class InvoiceSettingsController {
  constructor(private readonly settingsService: InvoiceSettingsService) {}

  @Get()
  get(@Param('locationId') locationId: string) {
    return this.settingsService.get(locationId);
  }

  @Put()
  update(
    @Param('locationId') locationId: string,
    @Body() dto: UpdateInvoiceSettingsDto,
  ) {
    return this.settingsService.update(locationId, dto);
  }
}
