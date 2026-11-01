import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { PushSubscription } from './entities/push-subscription.entity';
import { PushNotificationsController } from './push-notifications.controller';
import { PushNotificationsService } from './push-notifications.service';

/** Web Push to the owner's devices, e.g. new EasyMenu orders. */
@Module({
  imports: [TypeOrmModule.forFeature([PushSubscription])],
  controllers: [PushNotificationsController],
  providers: [PushNotificationsService],
  exports: [PushNotificationsService],
})
export class PushNotificationsModule {}
