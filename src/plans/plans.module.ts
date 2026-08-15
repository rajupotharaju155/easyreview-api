import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Plan } from './entities/plan.entity';
import { HqPlansController } from './hq-plans.controller';
import { PlansController } from './plans.controller';
import { PlansService } from './plans.service';

@Module({
  imports: [TypeOrmModule.forFeature([Plan])],
  controllers: [PlansController, HqPlansController],
  providers: [PlansService],
  exports: [PlansService],
})
export class PlansModule {}
