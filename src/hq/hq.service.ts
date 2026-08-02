import {
  ConflictException,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { InjectRepository } from '@nestjs/typeorm';
import { ILike, Not, Repository } from 'typeorm';
import { LoginResponseDto } from '../auth/dto/auth-response.dto';
import { LoginDto } from '../auth/dto/login.dto';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { generateHqTokens } from '../common/utils/token.util';
import { Location } from '../locations/entities/location.entity';
import { LocationMetric } from '../locations/entities/location-metric.entity';
import { LocationsService } from '../locations/locations.service';
import { STANDEE_DESIGNS } from '../orders/constants/standee.constants';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { HqLocationsQueryDto } from './dto/hq-locations-query.dto';
import { HqOrdersQueryDto } from './dto/hq-orders-query.dto';
import { HqUpdateOrderDto } from './dto/hq-update-order.dto';
import { LoginAsTicketResponseDto } from './dto/login-as-ticket-response.dto';
import { HqUsersQueryDto } from './dto/hq-users-query.dto';
import { TransferLocationDto } from './dto/transfer-location.dto';
import {
  HQ_ADMIN_EMAIL,
  HQ_ADMIN_PASSWORD,
  LOGIN_AS_TICKET_EXPIRATION,
  LOGIN_AS_TOKEN_TYPE,
} from './hq.constants';

@Injectable()
export class HqService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly locationsService: LocationsService,
    @InjectRepository(User)
    private readonly userRepository: Repository<User>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    @InjectRepository(Order)
    private readonly orderRepository: Repository<Order>,
  ) {}

  /**
   * Authenticates HQ admin against hardcoded credentials and issues JWT tokens.
   */
  async login(loginDto: LoginDto): Promise<LoginResponseDto> {
    const email = loginDto.email.trim().toLowerCase();
    if (
      email !== HQ_ADMIN_EMAIL.toLowerCase() ||
      loginDto.password !== HQ_ADMIN_PASSWORD
    ) {
      throw new UnauthorizedException('Invalid credentials');
    }
    console.log('[INFO] HQ admin login successful');
    return generateHqTokens(email, this.jwtService, this.configService);
  }

  /**
   * Lists all users globally; search matches id or email.
   */
  async findUsers(
    query: HqUsersQueryDto,
  ): Promise<PaginatedResponseDto<User>> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const term = search?.trim();
    const where = term
      ? [{ id: ILike(`%${term}%`) }, { email: ILike(`%${term}%`) }]
      : {};
    const [data, total] = await this.userRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Returns a single user by id for HQ detail view.
   */
  async findUserById(id: string): Promise<User> {
    const user = await this.userRepository.findOne({ where: { id } });
    if (!user) {
      throw new NotFoundException(`User with id "${id}" not found`);
    }
    return user;
  }

  /**
   * Mints a short-lived login-as ticket so HQ can open the user dashboard as this user.
   */
  async createLoginAsTicket(id: string): Promise<LoginAsTicketResponseDto> {
    const user = await this.findUserById(id);
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      type: LOGIN_AS_TOKEN_TYPE,
    };
    const ticket = await this.jwtService.signAsync(payload, {
      expiresIn: LOGIN_AS_TICKET_EXPIRATION,
    });
    console.log(`[INFO] HQ issued login-as ticket for user ${user.id}`);
    return { ticket };
  }

  /**
   * Lists all locations globally; search matches id, placeId, or name.
   * Optional userId filters to locations managed by that agency user.
   */
  async findLocations(
    query: HqLocationsQueryDto,
  ): Promise<PaginatedResponseDto<Location>> {
    const { page = 1, limit = 10, search, userId } = query;
    const skip = (page - 1) * limit;
    const term = search?.trim();
    const ownerId = userId?.trim();
    const ownerFilter = ownerId ? { userId: ownerId } : {};
    const where = term
      ? [
          { id: ILike(`%${term}%`), ...ownerFilter },
          { placeId: ILike(`%${term}%`), ...ownerFilter },
          { name: ILike(`%${term}%`), ...ownerFilter },
        ]
      : ownerFilter;
    const [data, total] = await this.locationRepository.findAndCount({
      where,
      order: { createdAt: 'DESC' },
      skip,
      take: limit,
    });
    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Returns a single location by id for HQ detail view.
   */
  async findLocationById(id: string): Promise<Location> {
    const location = await this.locationRepository.findOne({ where: { id } });
    if (!location) {
      throw new NotFoundException(`Location with id "${id}" not found`);
    }
    return location;
  }

  /**
   * Fetches latest Places API metrics for a location and stores a daily snapshot.
   */
  async refreshLocationMetrics(id: string): Promise<LocationMetric> {
    const metric = await this.locationsService.refreshMetrics(id);
    console.log(
      `[INFO] HQ refreshed metrics for location ${id} (period ${metric.periodKey})`,
    );
    return metric;
  }

  /**
   * Transfers a location to a different agency user.
   */
  async transferLocation(
    locationId: string,
    dto: TransferLocationDto,
  ): Promise<Location> {
    const location = await this.findLocationById(locationId);
    const targetUserId = dto.userId.trim();
    if (location.userId === targetUserId) {
      throw new ConflictException(
        'Location already belongs to the selected user',
      );
    }
    const targetUser = await this.userRepository.findOne({
      where: { id: targetUserId },
    });
    if (!targetUser) {
      throw new NotFoundException(`User with id "${targetUserId}" not found`);
    }
    const existing = await this.locationRepository.findOne({
      where: {
        userId: targetUserId,
        placeId: location.placeId,
        id: Not(location.id),
      },
    });
    if (existing) {
      throw new ConflictException(
        'Selected user already has a location with this Google Place ID',
      );
    }
    location.userId = targetUserId;
    const saved = await this.locationRepository.save(location);
    console.log(
      `[INFO] HQ transferred location ${locationId} to user ${targetUserId}`,
    );
    return saved;
  }

  /**
   * Lists all orders globally with id search, status/name filters, latest first.
   */
  async findOrders(
    query: HqOrdersQueryDto,
  ): Promise<PaginatedResponseDto<Order>> {
    const { page = 1, limit = 10, id, status, name } = query;
    const skip = (page - 1) * limit;
    const qb = this.orderRepository
      .createQueryBuilder('o')
      .orderBy('o.createdAt', 'DESC')
      .skip(skip)
      .take(limit);
    if (id?.trim()) {
      qb.andWhere('o.id ILIKE :id', { id: `%${id.trim()}%` });
    }
    if (status) {
      qb.andWhere('o.status = :status', { status });
    }
    if (name?.trim()) {
      qb.andWhere('o.businessNameSnapshot ILIKE :name', {
        name: `%${name.trim()}%`,
      });
    }
    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  /**
   * Returns a single order by id for HQ detail view.
   */
  async findOrderById(id: string): Promise<Order> {
    const order = await this.orderRepository.findOne({ where: { id } });
    if (!order) {
      throw new NotFoundException(`Order with id "${id}" not found`);
    }
    return order;
  }

  /**
   * Updates editable order fields for HQ (design, contact, address, status).
   */
  async updateOrder(id: string, dto: HqUpdateOrderDto): Promise<Order> {
    const order = await this.findOrderById(id);
    const design = STANDEE_DESIGNS[dto.designVariant];
    order.designVariant = dto.designVariant;
    order.designName = design.name;
    order.phoneNumber = dto.phoneNumber.trim();
    order.addressLine1 = dto.addressLine1?.trim() || null;
    order.addressLine2 = dto.addressLine2?.trim() || null;
    order.addressLine3 = dto.addressLine3?.trim() || null;
    order.pincode = dto.pincode?.trim() || null;
    order.status = dto.status;
    order.statusNote = dto.statusNote?.trim() || null;
    const saved = await this.orderRepository.save(order);
    console.log(`[INFO] HQ updated order ${id} (status ${saved.status})`);
    return saved;
  }
}
