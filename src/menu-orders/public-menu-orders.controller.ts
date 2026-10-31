import { Body, Controller, Param, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CreateMenuOrderDto } from './dto/create-menu-order.dto';
import { MenuOrderPlacementService } from './menu-order-placement.service';

@Controller('menu/:slug/orders')
export class PublicMenuOrdersController {
  constructor(private readonly placementService: MenuOrderPlacementService) {}

  @Public()
  @Post()
  place(@Param('slug') slug: string, @Body() dto: CreateMenuOrderDto) {
    return this.placementService.place(slug, dto);
  }
}
