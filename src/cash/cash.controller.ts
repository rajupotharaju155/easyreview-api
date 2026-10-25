import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { CashCategoriesService } from './cash-categories.service';
import { CashEntriesService } from './cash-entries.service';
import {
  CashCategoriesQueryDto,
  CreateCashCategoryDto,
  UpdateCashCategoryDto,
} from './dto/cash-category.dto';
import { CashEntriesQueryDto } from './dto/cash-entries-query.dto';
import {
  CashCategorySummaryQueryDto,
  CashMonthlySummaryQueryDto,
} from './dto/cash-summary-query.dto';
import { CreateCashEntriesDto } from './dto/create-cash-entry.dto';
import { UpdateCashEntryDto } from './dto/update-cash-entry.dto';

@Controller('locations/:locationId/cash')
export class CashController {
  constructor(
    private readonly entriesService: CashEntriesService,
    private readonly categoriesService: CashCategoriesService,
  ) {}

  @Get('summary/monthly')
  monthlySummary(
    @Param('locationId') locationId: string,
    @Query() query: CashMonthlySummaryQueryDto,
  ) {
    return this.entriesService.monthlySummary(locationId, query);
  }

  @Get('summary/lifetime')
  lifetimeSummary(@Param('locationId') locationId: string) {
    return this.entriesService.lifetimeSummary(locationId);
  }

  @Get('summary/categories')
  categorySummary(
    @Param('locationId') locationId: string,
    @Query() query: CashCategorySummaryQueryDto,
  ) {
    return this.entriesService.categorySummary(locationId, query);
  }

  @Get('entries')
  listEntries(
    @Param('locationId') locationId: string,
    @Query() query: CashEntriesQueryDto,
  ) {
    return this.entriesService.list(locationId, query);
  }

  @Post('entries')
  createEntries(
    @Param('locationId') locationId: string,
    @Body() dto: CreateCashEntriesDto,
  ) {
    return this.entriesService.createMany(locationId, dto);
  }

  @Patch('entries/:entryId')
  updateEntry(
    @Param('locationId') locationId: string,
    @Param('entryId') entryId: string,
    @Body() dto: UpdateCashEntryDto,
  ) {
    return this.entriesService.update(locationId, entryId, dto);
  }

  @Delete('entries/:entryId')
  @HttpCode(204)
  removeEntry(
    @Param('locationId') locationId: string,
    @Param('entryId') entryId: string,
  ) {
    return this.entriesService.remove(locationId, entryId);
  }

  @Get('categories')
  listCategories(
    @Param('locationId') locationId: string,
    @Query() query: CashCategoriesQueryDto,
  ) {
    return this.categoriesService.list(locationId, query);
  }

  @Post('categories')
  createCategory(
    @Param('locationId') locationId: string,
    @Body() dto: CreateCashCategoryDto,
  ) {
    return this.categoriesService.create(locationId, dto);
  }

  @Patch('categories/:categoryId')
  updateCategory(
    @Param('locationId') locationId: string,
    @Param('categoryId') categoryId: string,
    @Body() dto: UpdateCashCategoryDto,
  ) {
    return this.categoriesService.update(locationId, categoryId, dto);
  }

  /** Deletes an unused category, or archives one that entries refer to. */
  @Delete('categories/:categoryId')
  removeCategory(
    @Param('locationId') locationId: string,
    @Param('categoryId') categoryId: string,
  ) {
    return this.categoriesService.remove(locationId, categoryId);
  }
}
