import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { PaginationDto } from '../common/dto/pagination.dto';
import { CreateLocationDto } from './dto/create-location.dto';
import { LocationWithScanSummaryDto } from './dto/location-with-scan-summary.dto';
import { PublicLocationDto } from './dto/public-location.dto';
import { UpdateLocationDto } from './dto/update-location.dto';
import { LocationsService } from './locations.service';

@Controller('locations')
export class LocationsController {
  constructor(private readonly locationsService: LocationsService) {}

  @Post()
  create(@Body() createLocationDto: CreateLocationDto) {
    return this.locationsService.create(createLocationDto);
  }

  @Get()
  findAll(
    @Query() paginationDto: PaginationDto,
  ): Promise<PaginatedResponseDto<LocationWithScanSummaryDto>> {
    return this.locationsService.findAllPaginated(paginationDto);
  }

  @Public()
  @Get('by-slug/:slug')
  findPublicBySlug(@Param('slug') slug: string): Promise<PublicLocationDto> {
    return this.locationsService.findLocationBySlug(slug);
  }

  @Public()
  @Post(':id/redirect-to-google')
  incrementRedirectToGoogle(@Param('id') locationId: string) {
    return this.locationsService.incrementRedirectToGoogleCount(locationId);
  }

  @Get(':id')
  findOne(@Param('id') id: string) {
    return this.locationsService.findOne(id);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() updateLocationDto: UpdateLocationDto,
  ) {
    return this.locationsService.update(id, updateLocationDto);
  }

  @Delete(':id')
  remove(@Param('id') id: string) {
    return this.locationsService.remove(id);
  }
}
