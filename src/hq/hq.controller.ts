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
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { Public } from '../common/decorators/public.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { Location } from '../locations/entities/location.entity';
import { LocationMetric } from '../locations/entities/location-metric.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { HqAssignQrCodeDto } from './dto/hq-assign-qr-code.dto';
import { HqCreateQrBatchDto } from './dto/hq-create-qr-batch.dto';
import { HqLocationsQueryDto } from './dto/hq-locations-query.dto';
import { HqOrdersQueryDto } from './dto/hq-orders-query.dto';
import { HqQrCodesQueryDto } from './dto/hq-qr-codes-query.dto';
import { HqUpdateLocationSlugDto } from './dto/hq-update-location-slug.dto';
import { HqUpdateOrderDto } from './dto/hq-update-order.dto';
import { HqUpdateUserDto } from './dto/hq-update-user.dto';
import { HqUsersQueryDto } from './dto/hq-users-query.dto';
import { LoginAsTicketResponseDto } from './dto/login-as-ticket-response.dto';
import { TransferLocationDto } from './dto/transfer-location.dto';
import { QrCode } from './entities/qr-code.entity';
import { HqGuard } from './guards/hq.guard';
import {
  HqService,
  type HqAttentionResponse,
  type HqQrBatchResult,
} from './hq.service';

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
  @Get('attention')
  async getAttention(): Promise<HqAttentionResponse> {
    return this.hqService.getAttention();
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
  @Patch('users/:id')
  async updateUser(
    @Param('id') id: string,
    @Body() dto: HqUpdateUserDto,
  ): Promise<User> {
    return this.hqService.updateUser(id, dto);
  }

  @UseGuards(HqGuard)
  @Delete('users/:id')
  async deleteUser(@Param('id') id: string): Promise<User> {
    return this.hqService.deleteUser(id);
  }

  @UseGuards(HqGuard)
  @Post('users/:id/login-as')
  @HttpCode(HttpStatus.OK)
  async loginAsUser(
    @Param('id') id: string,
  ): Promise<LoginAsTicketResponseDto> {
    return this.hqService.createLoginAsTicket(id);
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
  @Delete('locations/:id')
  async deleteLocation(@Param('id') id: string): Promise<Location> {
    return this.hqService.deleteLocation(id);
  }

  @UseGuards(HqGuard)
  @Post('locations/:id/refresh-metrics')
  @HttpCode(HttpStatus.OK)
  async refreshLocationMetrics(
    @Param('id') id: string,
  ): Promise<LocationMetric> {
    return this.hqService.refreshLocationMetrics(id);
  }

  @UseGuards(HqGuard)
  @Patch('locations/:id/slug')
  async updateLocationSlug(
    @Param('id') id: string,
    @Body() dto: HqUpdateLocationSlugDto,
  ): Promise<Location> {
    return this.hqService.updateLocationSlug(id, dto);
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

  @UseGuards(HqGuard)
  @Get('orders/:id')
  async findOrderById(@Param('id') id: string): Promise<Order> {
    return this.hqService.findOrderById(id);
  }

  @UseGuards(HqGuard)
  @Patch('orders/:id')
  async updateOrder(
    @Param('id') id: string,
    @Body() dto: HqUpdateOrderDto,
  ): Promise<Order> {
    return this.hqService.updateOrder(id, dto);
  }

  @UseGuards(HqGuard)
  @Get('qr-codes')
  async findQrCodes(
    @Query() query: HqQrCodesQueryDto,
  ): Promise<PaginatedResponseDto<QrCode>> {
    return this.hqService.findQrCodes(query);
  }

  @UseGuards(HqGuard)
  @Post('qr-codes/batch')
  @HttpCode(HttpStatus.CREATED)
  async createQrBatch(
    @Body() dto: HqCreateQrBatchDto,
  ): Promise<HqQrBatchResult> {
    return this.hqService.createQrBatch(dto);
  }

  @UseGuards(HqGuard)
  @Post('qr-codes/assign')
  @HttpCode(HttpStatus.OK)
  async assignQrCode(@Body() dto: HqAssignQrCodeDto): Promise<QrCode> {
    return this.hqService.assignQrCode(dto);
  }

  @UseGuards(HqGuard)
  @Post('qr-codes/:id/unassign')
  @HttpCode(HttpStatus.OK)
  async unassignQrCode(@Param('id') id: string): Promise<QrCode> {
    return this.hqService.unassignQrCode(id);
  }

  @UseGuards(HqGuard)
  @Delete('qr-codes/:id')
  async deleteQrCode(@Param('id') id: string): Promise<QrCode> {
    return this.hqService.deleteQrCode(id);
  }
}
