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
import { HqCreateSubscriptionDto } from './dto/hq-create-subscription.dto';
import { HqSubscriptionsQueryDto } from './dto/hq-subscriptions-query.dto';
import { UpdateSubscriptionDto } from './dto/update-subscription.dto';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

@Controller('hq/subscriptions')
@UseGuards(HqGuard)
export class HqSubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(
    @Query() query: HqSubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    return this.subscriptionsService.findAllForHq(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.findOneForHq(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: HqCreateSubscriptionDto): Promise<Subscription> {
    return this.subscriptionsService.createForHq(dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdateSubscriptionDto,
  ): Promise<Subscription> {
    return this.subscriptionsService.updateForHq(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.removeForHq(id);
  }
}
