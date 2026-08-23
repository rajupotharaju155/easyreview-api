import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { MenuCategory } from './entities/menu-category.entity';
import { MenuComboItem } from './entities/menu-combo-item.entity';
import { MenuCombo } from './entities/menu-combo.entity';
import { MenuItem } from './entities/menu-item.entity';
import { MenuSpecial } from './entities/menu-special.entity';
import { MenuController } from './menu.controller';
import { MenuService } from './menu.service';
import { MenuStorageService } from './menu-storage.service';
import { PublicMenuController } from './public-menu.controller';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuCategory,
      MenuItem,
      MenuCombo,
      MenuComboItem,
      MenuSpecial,
      Location,
    ]),
  ],
  controllers: [MenuController, PublicMenuController],
  providers: [MenuService, MenuStorageService],
  exports: [MenuService],
})
export class MenuModule {}
