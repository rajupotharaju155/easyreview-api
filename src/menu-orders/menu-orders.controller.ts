import { Body, Controller, Get, Param, Patch, Query } from '@nestjs/common';
import { MenuOrdersQueryDto } from './dto/menu-orders-query.dto';
import { UpdateMenuOrderSettingsDto } from './dto/update-menu-order-settings.dto';
import { UpdateMenuOrderStatusDto } from './dto/update-menu-order-status.dto';
import { MenuOrdersService } from './menu-orders.service';

@Controller('locations/:locationId/menu-orders')
export class MenuOrdersController {
  constructor(private readonly menuOrdersService: MenuOrdersService) {}

  @Get()
  list(
    @Param('locationId') locationId: string,
    @Query() query: MenuOrdersQueryDto,
  ) {
    return this.menuOrdersService.list(locationId, query);
  }

  @Get('pulse')
  pulse(@Param('locationId') locationId: string) {
    return this.menuOrdersService.pulse(locationId);
  }

  @Get('settings')
  getSettings(@Param('locationId') locationId: string) {
    return this.menuOrdersService.getSettings(locationId);
  }

  @Patch('settings')
  updateSettings(
    @Param('locationId') locationId: string,
    @Body() dto: UpdateMenuOrderSettingsDto,
  ) {
    return this.menuOrdersService.updateSettings(locationId, dto);
  }

  @Get(':orderId')
  get(
    @Param('locationId') locationId: string,
    @Param('orderId') orderId: string,
  ) {
    return this.menuOrdersService.get(locationId, orderId);
  }

  @Patch(':orderId/status')
  updateStatus(
    @Param('locationId') locationId: string,
    @Param('orderId') orderId: string,
    @Body() dto: UpdateMenuOrderStatusDto,
  ) {
    return this.menuOrdersService.updateStatus(locationId, orderId, dto);
  }
}
