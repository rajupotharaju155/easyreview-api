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
import { CancelInvoiceDto } from './dto/cancel-invoice.dto';
import { CreateInvoicePaymentDto } from './dto/create-invoice-payment.dto';
import { CreateInvoiceDto } from './dto/create-invoice.dto';
import { InvoicesQueryDto } from './dto/invoices-query.dto';
import { UpdateInvoiceDto } from './dto/update-invoice.dto';
import { InvoicesService } from './invoices.service';

@Controller('locations/:locationId/invoices')
export class InvoicesController {
  constructor(private readonly invoicesService: InvoicesService) {}

  @Get()
  list(
    @Param('locationId') locationId: string,
    @Query() query: InvoicesQueryDto,
  ) {
    return this.invoicesService.list(locationId, query);
  }

  @Get('dashboard')
  dashboard(@Param('locationId') locationId: string) {
    return this.invoicesService.dashboard(locationId);
  }

  @Post('preview')
  @HttpCode(200)
  preview(
    @Param('locationId') locationId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.preview(locationId, dto);
  }

  @Post()
  create(
    @Param('locationId') locationId: string,
    @Body() dto: CreateInvoiceDto,
  ) {
    return this.invoicesService.create(locationId, dto);
  }

  @Get(':invoiceId')
  get(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.get(locationId, invoiceId);
  }

  @Patch(':invoiceId')
  update(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: UpdateInvoiceDto,
  ) {
    return this.invoicesService.update(locationId, invoiceId, dto);
  }

  @Delete(':invoiceId')
  @HttpCode(204)
  remove(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.remove(locationId, invoiceId);
  }

  @Post(':invoiceId/issue')
  @HttpCode(200)
  issue(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
  ) {
    return this.invoicesService.issue(locationId, invoiceId);
  }

  @Post(':invoiceId/cancel')
  @HttpCode(200)
  cancel(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CancelInvoiceDto,
  ) {
    return this.invoicesService.cancel(locationId, invoiceId, dto);
  }

  @Post(':invoiceId/payments')
  addPayment(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
    @Body() dto: CreateInvoicePaymentDto,
  ) {
    return this.invoicesService.addPayment(locationId, invoiceId, dto);
  }

  @Delete(':invoiceId/payments/:paymentId')
  removePayment(
    @Param('locationId') locationId: string,
    @Param('invoiceId') invoiceId: string,
    @Param('paymentId') paymentId: string,
  ) {
    return this.invoicesService.removePayment(locationId, invoiceId, paymentId);
  }
}
