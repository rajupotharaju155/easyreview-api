import { Module } from '@nestjs/common';
import { AuthModule } from '../auth/auth.module';
import { HqController } from './hq.controller';
import { HqService } from './hq.service';

@Module({
  imports: [AuthModule],
  controllers: [HqController],
  providers: [HqService],
})
export class HqModule {}
