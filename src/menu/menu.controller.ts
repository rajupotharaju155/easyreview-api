import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { CreateCategoryDto } from './dto/create-category.dto';
import { CreateComboDto } from './dto/create-combo.dto';
import { CreateItemDto } from './dto/create-item.dto';
import { CreateSpecialDto } from './dto/create-special.dto';
import { MoveItemDto } from './dto/move-item.dto';
import { ReorderItemsDto } from './dto/reorder-items.dto';
import { ReorderDto } from './dto/reorder.dto';
import { UpdateCategoryDto } from './dto/update-category.dto';
import { UpdateComboDto } from './dto/update-combo.dto';
import { UpdateItemDto } from './dto/update-item.dto';
import { MenuService } from './menu.service';
import type { MenuImageFile } from './menu-storage.service';

@Controller('locations/:locationId/menu')
export class MenuController {
  constructor(private readonly menuService: MenuService) {}

  @Get()
  getMenu(@Param('locationId') locationId: string) {
    return this.menuService.getOwnedMenu(locationId);
  }

  @Post('categories')
  createCategory(
    @Param('locationId') locationId: string,
    @Body() dto: CreateCategoryDto,
  ) {
    return this.menuService.createCategory(locationId, dto);
  }

  @Put('categories/reorder')
  @HttpCode(204)
  reorderCategories(
    @Param('locationId') locationId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.menuService.reorderCategories(locationId, dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('locationId') locationId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCategoryDto,
  ) {
    return this.menuService.updateCategory(locationId, categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(204)
  deleteCategory(
    @Param('locationId') locationId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.menuService.deleteCategory(locationId, categoryId);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadImage(
    @Param('locationId') locationId: string,
    @UploadedFile() file: MenuImageFile,
  ) {
    return this.menuService.uploadItemImage(locationId, file);
  }

  @Post('items')
  createItem(
    @Param('locationId') locationId: string,
    @Body() dto: CreateItemDto,
  ) {
    return this.menuService.createItem(locationId, dto);
  }

  @Put('items/reorder')
  @HttpCode(204)
  reorderItems(
    @Param('locationId') locationId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.menuService.reorderItems(locationId, dto);
  }

  @Patch('items/:itemId/move')
  moveItem(
    @Param('locationId') locationId: string,
    @Param('itemId') itemId: string,
    @Body() dto: MoveItemDto,
  ) {
    return this.menuService.moveItem(locationId, itemId, dto);
  }

  @Patch('items/:itemId')
  updateItem(
    @Param('locationId') locationId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateItemDto,
  ) {
    return this.menuService.updateItem(locationId, itemId, dto);
  }

  @Delete('items/:itemId')
  @HttpCode(204)
  deleteItem(
    @Param('locationId') locationId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.menuService.deleteItem(locationId, itemId);
  }

  @Post('combos')
  createCombo(
    @Param('locationId') locationId: string,
    @Body() dto: CreateComboDto,
  ) {
    return this.menuService.createCombo(locationId, dto);
  }

  @Put('combos/reorder')
  @HttpCode(204)
  reorderCombos(
    @Param('locationId') locationId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.menuService.reorderCombos(locationId, dto);
  }

  @Patch('combos/:comboId')
  updateCombo(
    @Param('locationId') locationId: string,
    @Param('comboId') comboId: string,
    @Body() dto: UpdateComboDto,
  ) {
    return this.menuService.updateCombo(locationId, comboId, dto);
  }

  @Delete('combos/:comboId')
  @HttpCode(204)
  deleteCombo(
    @Param('locationId') locationId: string,
    @Param('comboId') comboId: string,
  ) {
    return this.menuService.deleteCombo(locationId, comboId);
  }

  @Post('specials')
  createSpecial(
    @Param('locationId') locationId: string,
    @Body() dto: CreateSpecialDto,
  ) {
    return this.menuService.createSpecial(locationId, dto);
  }

  @Put('specials/reorder')
  @HttpCode(204)
  reorderSpecials(
    @Param('locationId') locationId: string,
    @Body() dto: ReorderDto,
  ) {
    return this.menuService.reorderSpecials(locationId, dto);
  }

  @Delete('specials/:specialId')
  @HttpCode(204)
  deleteSpecial(
    @Param('locationId') locationId: string,
    @Param('specialId') specialId: string,
  ) {
    return this.menuService.deleteSpecial(locationId, specialId);
  }
}
