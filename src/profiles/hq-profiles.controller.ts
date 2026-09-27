import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { HqGuard } from '../hq/guards/hq.guard';
import { HqDeleteProfileQueryDto } from './dto/hq-delete-profile-query.dto';
import { HqProfileDetailDto } from './dto/hq-profile-detail.dto';
import { HqProfileSummaryDto } from './dto/hq-profile-summary.dto';
import { HqProfilesQueryDto } from './dto/hq-profiles-query.dto';
import { HqUpdateProfilePublishedDto } from './dto/hq-update-profile-published.dto';
import { TransferProfileDto } from './dto/transfer-profile.dto';
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

  @Get(':id')
  findOne(@Param('id') id: string): Promise<HqProfileDetailDto> {
    return this.profilesService.findOneForHq(id);
  }

  @Post(':id/transfer')
  @HttpCode(HttpStatus.OK)
  transfer(
    @Param('id') id: string,
    @Body() dto: TransferProfileDto,
  ): Promise<HqProfileDetailDto> {
    return this.profilesService.transferForHq(id, dto);
  }

  @Delete(':id')
  remove(
    @Param('id') id: string,
    @Query() query: HqDeleteProfileQueryDto,
  ): Promise<HqProfileDetailDto> {
    return this.profilesService.deleteForHq(
      id,
      query.deleteSubscriptions === true,
    );
  }

  @Patch(':id/published')
  setPublished(
    @Param('id') id: string,
    @Body() dto: HqUpdateProfilePublishedDto,
  ): Promise<HqProfileSummaryDto> {
    return this.profilesService.setPublishedForHq(id, dto.isPublished);
  }
}
