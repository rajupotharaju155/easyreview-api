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
import { CustomersService } from './customers.service';
import { CreateCustomerDto } from './dto/create-customer.dto';
import { CustomersQueryDto } from './dto/customers-query.dto';
import { UpdateCustomerDto } from './dto/update-customer.dto';

@Controller('locations/:locationId/customers')
export class CustomersController {
  constructor(private readonly customersService: CustomersService) {}

  @Get()
  list(
    @Param('locationId') locationId: string,
    @Query() query: CustomersQueryDto,
  ) {
    return this.customersService.list(locationId, query);
  }

  @Post()
  create(
    @Param('locationId') locationId: string,
    @Body() dto: CreateCustomerDto,
  ) {
    return this.customersService.create(locationId, dto);
  }

  @Get(':customerId')
  get(
    @Param('locationId') locationId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.get(locationId, customerId);
  }

  @Patch(':customerId')
  update(
    @Param('locationId') locationId: string,
    @Param('customerId') customerId: string,
    @Body() dto: UpdateCustomerDto,
  ) {
    return this.customersService.update(locationId, customerId, dto);
  }

  @Delete(':customerId')
  @HttpCode(204)
  remove(
    @Param('locationId') locationId: string,
    @Param('customerId') customerId: string,
  ) {
    return this.customersService.remove(locationId, customerId);
  }
}
