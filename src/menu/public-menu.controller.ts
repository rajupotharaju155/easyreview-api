import { Controller, Get, Param } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { MenuService } from './menu.service';

@Controller('menu')
export class PublicMenuController {
  constructor(private readonly menuService: MenuService) {}

  @Public()
  @Get(':slug')
  getPublicMenu(@Param('slug') slug: string) {
    return this.menuService.getPublicMenuBySlug(slug);
  }
}
