import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { ContactsModule } from '../contacts/contacts.module';
import { Location } from '../locations/entities/location.entity';
import { LocationAccessModule } from '../locations/location-access.module';
import { MenuCategory } from '../menu/entities/menu-category.entity';
import { MenuComboItem } from '../menu/entities/menu-combo-item.entity';
import { MenuCombo } from '../menu/entities/menu-combo.entity';
import { MenuItem } from '../menu/entities/menu-item.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { MenuOrderItem } from './entities/menu-order-item.entity';
import { MenuOrderSequence } from './entities/menu-order-sequence.entity';
import { MenuOrder } from './entities/menu-order.entity';
import { MenuOrderPlacementService } from './menu-order-placement.service';
import { MenuOrdersController } from './menu-orders.controller';
import { MenuOrdersService } from './menu-orders.service';
import { PublicMenuOrdersController } from './public-menu-orders.controller';

/** EasyMenu ordering: guests order from the public menu, owners work the inbox. */
@Module({
  imports: [
    TypeOrmModule.forFeature([
      MenuOrder,
      MenuOrderItem,
      MenuOrderSequence,
      Location,
      MenuItem,
      MenuCategory,
      MenuCombo,
      MenuComboItem,
    ]),
    LocationAccessModule,
    ContactsModule,
    SubscriptionsModule,
  ],
  controllers: [MenuOrdersController, PublicMenuOrdersController],
  providers: [MenuOrdersService, MenuOrderPlacementService],
})
export class MenuOrdersModule {}
