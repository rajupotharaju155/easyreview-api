import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Post,
} from '@nestjs/common';
import { GenerateStoryDto } from './dto/generate-story.dto';
import { StoriesService } from './stories.service';

@Controller('locations/:locationId/stories')
export class StoriesController {
  constructor(private readonly storiesService: StoriesService) {}

  @Get()
  list(@Param('locationId') locationId: string) {
    return this.storiesService.listForOwnedLocation(locationId);
  }

  @Post()
  generate(
    @Param('locationId') locationId: string,
    @Body() dto: GenerateStoryDto,
  ) {
    return this.storiesService.generate(locationId, dto);
  }

  @Delete(':storyId')
  @HttpCode(204)
  delete(
    @Param('locationId') locationId: string,
    @Param('storyId') storyId: string,
  ) {
    return this.storiesService.deleteForOwnedLocation(locationId, storyId);
  }
}
