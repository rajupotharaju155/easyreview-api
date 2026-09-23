import { Module } from '@nestjs/common';
import { TypeOrmModule } from '@nestjs/typeorm';
import { AiSettingsModule } from '../ai-settings/ai-settings.module';
import { Location } from '../locations/entities/location.entity';
import { SubscriptionsModule } from '../subscriptions/subscriptions.module';
import { StoryGeneration } from './entities/story-generation.entity';
import { Story } from './entities/story.entity';
import { StoriesController } from './stories.controller';
import { StoriesService } from './stories.service';
import { StoryStorageService } from './story-storage.service';

@Module({
  imports: [
    TypeOrmModule.forFeature([Story, StoryGeneration, Location]),
    AiSettingsModule,
    SubscriptionsModule,
  ],
  controllers: [StoriesController],
  providers: [StoriesService, StoryStorageService],
})
export class StoriesModule {}
