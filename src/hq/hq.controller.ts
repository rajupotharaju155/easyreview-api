import {
  Body,
  Controller,
  Get,
  HttpCode,
  HttpStatus,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { HqLocationsQueryDto } from './dto/hq-locations-query.dto';
import { HqOrdersQueryDto } from './dto/hq-orders-query.dto';
import { HqUsersQueryDto } from './dto/hq-users-query.dto';
import { TransferLocationDto } from './dto/transfer-location.dto';
import { HqGuard } from './guards/hq.guard';
import { HqService } from './hq.service';

@Controller('hq')
export class HqController {
  constructor(private readonly hqService: HqService) {}

  @Public()
  @Post('login')
  @HttpCode(HttpStatus.OK)
  async login(@Body() loginDto: LoginDto): Promise<LoginResponseDto> {
    return this.hqService.login(loginDto);
  }

  @UseGuards(HqGuard)
  @Get('users')
  async findUsers(
    @Query() query: HqUsersQueryDto,
  ): Promise<PaginatedResponseDto<User>> {
    return this.hqService.findUsers(query);
  }

  @UseGuards(HqGuard)
  @Get('users/:id')
  async findUserById(@Param('id') id: string): Promise<User> {
    return this.hqService.findUserById(id);
  }

  @UseGuards(HqGuard)
  @Get('locations')
  async findLocations(
    @Query() query: HqLocationsQueryDto,
  ): Promise<PaginatedResponseDto<Location>> {
    return this.hqService.findLocations(query);
  }

  @UseGuards(HqGuard)
  @Get('locations/:id')
  async findLocationById(@Param('id') id: string): Promise<Location> {
    return this.hqService.findLocationById(id);
  }

  @UseGuards(HqGuard)
  @Post('locations/:id/transfer')
  @HttpCode(HttpStatus.OK)
  async transferLocation(
    @Param('id') id: string,
    @Body() dto: TransferLocationDto,
  ): Promise<Location> {
    return this.hqService.transferLocation(id, dto);
  }

  @UseGuards(HqGuard)
  @Get('orders')
  async findOrders(
    @Query() query: HqOrdersQueryDto,
  ): Promise<PaginatedResponseDto<Order>> {
    return this.hqService.findOrders(query);
  }
}
