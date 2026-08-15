import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Location } from '../locations/entities/location.entity';
import { LocationsModule } from '../locations/locations.module';
import { Order } from '../orders/entities/order.entity';
import { Payment } from '../payments/entities/payment.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { User } from '../users/entities/user.entity';
import { QrCode } from './entities/qr-code.entity';
import { HqController } from './hq.controller';
import { HqService } from './hq.service';
import { QrCodesController } from './qr-codes.controller';

@Module({
  imports: [
    AuthModule,
    LocationsModule,
    TypeOrmModule.forFeature([
      User,
      Location,
      Order,
      QrCode,
      Payment,
      Subscription,
    ]),
  ],
  controllers: [HqController, QrCodesController],
  providers: [HqService],
  exports: [HqService],
})
export class HqModule {}
