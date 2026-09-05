import { Module, forwardRef } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Expense } from '../expenses/entities/expense.entity';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { Plan } from '../plans/entities/plan.entity';
import { Subscription } from '../subscriptions/entities/subscription.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { Payment } from './entities/payment.entity';
import { HqPaymentsController } from './hq-payments.controller';
import { PaymentsController } from './payments.controller';
import { PaymentsService } from './payments.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([
      Payment,
      Subscription,
      Order,
      Plan,
      Location,
      Expense,
    ]),
    forwardRef(() => SubscriptionsModule),
  ],
  controllers: [PaymentsController, HqPaymentsController],
  providers: [PaymentsService],
  exports: [PaymentsService],
})
export class PaymentsModule {}
