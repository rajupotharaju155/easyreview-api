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
import { CreatePaymentDto } from './dto/create-payment.dto';
import { HqNetSeriesDto } from './dto/hq-net-series.dto';
import { HqNetSeriesQueryDto } from './dto/hq-net-series-query.dto';
import { HqPaymentSummaryDto } from './dto/hq-payment-summary.dto';
import { HqPaymentsQueryDto } from './dto/hq-payments-query.dto';
import { MarkPaymentSuccessDto } from './dto/mark-payment-success.dto';
import { UpdatePaymentDto } from './dto/update-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

@Controller('hq/payments')
@UseGuards(HqGuard)
export class HqPaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Get()
  findAll(
    @Query() query: HqPaymentsQueryDto,
  ): Promise<PaginatedResponseDto<Payment>> {
    return this.paymentsService.findAllForHq(query);
  }

  @Get('summary')
  summary(): Promise<HqPaymentSummaryDto> {
    return this.paymentsService.findSummaryForHq();
  }

  @Get('net-series')
  netSeries(@Query() query: HqNetSeriesQueryDto): Promise<HqNetSeriesDto> {
    return this.paymentsService.findNetSeriesForHq(query.range);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Payment> {
    return this.paymentsService.findOneForHq(id);
  }

  @Post()
  @HttpCode(HttpStatus.CREATED)
  create(@Body() dto: CreatePaymentDto): Promise<Payment> {
    return this.paymentsService.createForHq(dto);
  }

  @Post(':id/mark-success')
  @HttpCode(HttpStatus.OK)
  markSuccess(
    @Param('id') id: string,
    @Body() dto: MarkPaymentSuccessDto = {},
  ): Promise<Payment> {
    return this.paymentsService.markSuccessForHq(id, dto);
  }

  @Patch(':id')
  update(
    @Param('id') id: string,
    @Body() dto: UpdatePaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.updateForHq(id, dto);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<Payment> {
    return this.paymentsService.removeForHq(id);
  }
}
