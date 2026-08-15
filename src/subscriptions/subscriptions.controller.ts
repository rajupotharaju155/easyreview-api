import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreateSubscriptionDto } from './dto/create-subscription.dto';
import { SubscriptionsQueryDto } from './dto/subscriptions-query.dto';
import { Subscription } from './entities/subscription.entity';
import { SubscriptionsService } from './subscriptions.service';

@Controller('subscriptions')
export class SubscriptionsController {
  constructor(private readonly subscriptionsService: SubscriptionsService) {}

  @Get()
  findAll(
    @Query() query: SubscriptionsQueryDto,
  ): Promise<PaginatedResponseDto<Subscription>> {
    return this.subscriptionsService.findAllForUser(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Subscription> {
    return this.subscriptionsService.findOneForUser(id);
  }

  @Post()
  create(@Body() dto: CreateSubscriptionDto): Promise<Subscription> {
    return this.subscriptionsService.createForUser(dto);
  }
}
