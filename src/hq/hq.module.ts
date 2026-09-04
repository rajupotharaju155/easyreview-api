import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Location } from '../locations/entities/location.entity';
import { LocationsModule } from '../locations/locations.module';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { PaymentsModule } from '../payments/payments.module';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { QrCode } from './entities/qr-code.entity';
import { HqController } from './hq.controller';
import { HqService } from './hq.service';
import { QrCodesController } from './qr-codes.controller';
import { QrProductCategory } from './qr-products/entities/qr-product-category.entity';
import { QrProduct } from './qr-products/entities/qr-product.entity';
import { QrProductsCatalogController } from './qr-products/qr-products-catalog.controller';
import { QrProductsController } from './qr-products/qr-products.controller';
import { QrProductsService } from './qr-products/qr-products.service';
import { QrProductsStorageService } from './qr-products/qr-products-storage.service';

@Module({
  imports: [
    AuthModule,
    LocationsModule,
    PaymentsModule,
    TypeOrmModule.forFeature([
      User,
      Location,
      Order,
      QrCode,
      QrProductCategory,
      QrProduct,
      Payment,
      Subscription,
    ]),
  ],
  controllers: [
    HqController,
    QrCodesController,
    QrProductsController,
    QrProductsCatalogController,
  ],
  providers: [HqService, QrProductsService, QrProductsStorageService],
  exports: [HqService, QrProductsService],
})
export class HqModule {}
