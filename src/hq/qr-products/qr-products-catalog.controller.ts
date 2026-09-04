import { Controller, Get } from '@nestjs/common';
import { QrProductsService } from './qr-products.service';

@Controller('qr-products')
export class QrProductsCatalogController {
  constructor(private readonly qrProductsService: QrProductsService) {}

  @Get('catalog')
  listCatalog() {
    return this.qrProductsService.listCatalog();
  }
}
