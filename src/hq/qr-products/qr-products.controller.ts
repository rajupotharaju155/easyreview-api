import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Put,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { type QrProductImageFile } from './qr-products-storage.service';
import { HqGuard } from '../guards/hq.guard';
import { CreateQrProductCategoryDto } from './dto/create-qr-product-category.dto';
import { CreateQrProductDto } from './dto/create-qr-product.dto';
import { UpdateQrProductCategoryDto } from './dto/update-qr-product-category.dto';
import { UpdateQrProductDto } from './dto/update-qr-product.dto';
import { QrProductsService } from './qr-products.service';
import { ReorderQrProductsDto } from './dto/reorder-qr-products.dto';

@Controller('hq/qr-products')
@UseGuards(HqGuard)
export class QrProductsController {
  constructor(private readonly qrProductsService: QrProductsService) {}

  @Get('categories')
  listCategories() {
    return this.qrProductsService.listCategories();
  }

  @Post('categories')
  createCategory(@Body() dto: CreateQrProductCategoryDto) {
    return this.qrProductsService.createCategory(dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateQrProductCategoryDto,
  ) {
    return this.qrProductsService.updateCategory(categoryId, dto);
  }

  @Delete('categories/:categoryId')
  @HttpCode(HttpStatus.NO_CONTENT)
  deleteCategory(@Param('categoryId') categoryId: string) {
    return this.qrProductsService.deleteCategory(categoryId);
  }

  @Get('categories/:categoryId/products')
  listProducts(@Param('categoryId') categoryId: string) {
    return this.qrProductsService.listProducts(categoryId);
  }

  @Post('categories/:categoryId/products')
  createProduct(
    @Param('categoryId') categoryId: string,
    @Body() dto: CreateQrProductDto,
  ) {
    return this.qrProductsService.createProduct(categoryId, dto);
  }

  @Put('categories/:categoryId/products/reorder')
  @HttpCode(HttpStatus.NO_CONTENT)
  reorderProducts(
    @Param('categoryId') categoryId: string,
    @Body() dto: ReorderQrProductsDto,
  ) {
    return this.qrProductsService.reorderProducts(categoryId, dto);
  }

  @Patch('products/:productId')
  updateProduct(
    @Param('productId') productId: string,
    @Body() dto: UpdateQrProductDto,
  ) {
    return this.qrProductsService.updateProduct(productId, dto);
  }

  @Delete('products/:productId')
  discontinueProduct(@Param('productId') productId: string) {
    return this.qrProductsService.discontinueProduct(productId);
  }

  @Post('images')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 2 * 1024 * 1024 },
    }),
  )
  uploadImage(@UploadedFile() file: QrProductImageFile) {
    return this.qrProductsService.uploadImage(file);
  }
}

