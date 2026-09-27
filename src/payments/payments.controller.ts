import {
  Body,
  Controller,
  Get,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreateRazorpayOrderDto } from './dto/create-razorpay-order.dto';
import { PaymentsQueryDto } from './dto/payments-query.dto';
import { SubmitPaymentDto } from './dto/submit-payment.dto';
import { VerifyRazorpayPaymentDto } from './dto/verify-razorpay-payment.dto';
import { Payment } from './entities/payment.entity';
import { PaymentsService } from './payments.service';

@Controller('payments')
export class PaymentsController {
  constructor(private readonly paymentsService: PaymentsService) {}

  @Post('create-order')
  createOrder(@Body() dto: CreateRazorpayOrderDto) {
    return this.paymentsService.createCheckoutOrder(dto);
  }

  @Post('verify-payment')
  verifyPayment(@Body() dto: VerifyRazorpayPaymentDto) {
    return this.paymentsService.verifyCheckoutPayment(dto);
  }

  @Get()
  findAll(
    @Query() query: PaymentsQueryDto,
  ): Promise<PaginatedResponseDto<Payment>> {
    return this.paymentsService.findAllForUser(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<Payment> {
    return this.paymentsService.findOneForUser(id);
  }

  @Patch(':id')
  submit(
    @Param('id') id: string,
    @Body() dto: SubmitPaymentDto,
  ): Promise<Payment> {
    return this.paymentsService.submitForUser(id, dto);
  }
}
