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
import { generateHqTokens } from '../common/utils/token.util';
import { Location } from '../locations/entities/location.entity';
import { Order } from '../orders/entities/order.entity';
import { User } from '../users/entities/user.entity';
import { HqLocationsQueryDto } from './dto/hq-locations-query.dto';
import { HqOrdersQueryDto } from './dto/hq-orders-query.dto';
import { HqUsersQueryDto } from './dto/hq-users-query.dto';
import { TransferLocationDto } from './dto/transfer-location.dto';
import {
  HQ_ADMIN_EMAIL,
  HQ_ADMIN_PASSWORD,
} from './hq.constants';

@Injectable()
export class HqService {
  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
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
   * Lists all locations globally; search matches id, placeId, or name.
   */
  async findLocations(
    query: HqLocationsQueryDto,
  ): Promise<PaginatedResponseDto<Location>> {
    const { page = 1, limit = 10, search } = query;
    const skip = (page - 1) * limit;
    const term = search?.trim();
    const where = term
      ? [
          { id: ILike(`%${term}%`) },
          { placeId: ILike(`%${term}%`) },
          { name: ILike(`%${term}%`) },
        ]
      : {};
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
}
