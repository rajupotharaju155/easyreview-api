import { Body, Controller, Get, Param, Patch, Query, UseGuards } from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { HqGuard } from '../hq/guards/hq.guard';
import { HqProfileSummaryDto } from './dto/hq-profile-summary.dto';
import { HqProfilesQueryDto } from './dto/hq-profiles-query.dto';
import { HqUpdateProfilePublishedDto } from './dto/hq-update-profile-published.dto';
import { ProfilesService } from './profiles.service';

/**
 * HQ endpoints for browsing EasyProfile cards and publishing them.
 * Sits behind `HqGuard` like the rest of `/hq/*`.
 */
@Controller('hq/profiles')
@UseGuards(HqGuard)
export class HqProfilesController {
  constructor(private readonly profilesService: ProfilesService) {}

  @Get()
  findAll(
    @Query() query: HqProfilesQueryDto,
  ): Promise<PaginatedResponseDto<HqProfileSummaryDto>> {
    return this.profilesService.findAllForHq(query);
  }

  @Patch(':id/published')
  setPublished(
    @Param('id') id: string,
    @Body() dto: HqUpdateProfilePublishedDto,
  ): Promise<HqProfileSummaryDto> {
    return this.profilesService.setPublishedForHq(id, dto.isPublished);
  }
}
