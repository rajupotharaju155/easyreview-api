import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { Location } from '../locations/entities/location.entity';
import { PrivateFeedback } from './entities/private-feedback.entity';
import { PrivateFeedbackController } from './private-feedback.controller';
import { PrivateFeedbackService } from './private-feedback.service';

@Module({
  imports: [TypeOrmModule.forFeature([PrivateFeedback, Location])],
  controllers: [PrivateFeedbackController],
  providers: [PrivateFeedbackService],
  exports: [PrivateFeedbackService],
})
export class PrivateFeedbackModule {}
