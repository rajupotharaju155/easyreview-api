import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { PaymentsModule } from '../payments/payments.module';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from './entities/subscription.entity';
import { HqSubscriptionsController } from './hq-subscriptions.controller';
import { SubscriptionsController } from './subscriptions.controller';
import { SubscriptionsService } from './subscriptions.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Subscription, Location, Plan]),
    forwardRef(() => PaymentsModule),
  ],
  controllers: [SubscriptionsController, HqSubscriptionsController],
  providers: [SubscriptionsService],
  exports: [SubscriptionsService],
})
export class SubscriptionsModule {}
