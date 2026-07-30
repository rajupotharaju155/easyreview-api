import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AuthModule } from '../auth/auth.module';
import { Location } from '../locations/entities/location.entity';
import { LocationsModule } from '../locations/locations.module';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { HqController } from './hq.controller';
import { HqService } from './hq.service';

@Module({
  imports: [
    AuthModule,
    LocationsModule,
    TypeOrmModule.forFeature([User, Location, Order]),
  ],
  controllers: [HqController],
  providers: [HqService],
})
export class HqModule {}
