import {
  BadRequestException,
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
import { generateId } from '../common/utils/id';
import { JwtPayload } from '../auth/strategies/jwt.strategy';
import { generateHqTokens } from '../common/utils/token.util';
import { Location } from '../locations/entities/location.entity';
import { LocationMetric } from '../locations/entities/location-metric.entity';
import { LocationsService } from '../locations/locations.service';
import { STANDEE_DESIGNS } from '../orders/constants/standee.constants';
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
import { LoginAsTicketResponseDto } from './dto/login-as-ticket-response.dto';
import { HqUsersQueryDto } from './dto/hq-users-query.dto';
import { TransferLocationDto } from './dto/transfer-location.dto';
import { QrCode } from './entities/qr-code.entity';
import { PublicQrCodeDto } from './dto/public-qr-code.dto';
import {
  HQ_ADMIN_EMAIL,
  HQ_ADMIN_PASSWORD,
  LOGIN_AS_TICKET_EXPIRATION,
  LOGIN_AS_TOKEN_TYPE,
  QR_BATCH_DEFAULT_SIZE,
} from './hq.constants';
import { generateQrCodeValue, ratingPageTargetUrl } from './qr-code.util';

export type HqQrBatchResult = {
  batchId: string;
  size: number;
  codes: QrCode[];
};

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
    @InjectRepository(QrCode)
    private readonly qrCodeRepository: Repository<QrCode>,
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
   * Updates agency user fields available to HQ (currently name only).
   */
  async updateUser(id: string, dto: HqUpdateUserDto): Promise<User> {
    const user = await this.findUserById(id);
    if (dto.name !== undefined) {
      user.name = dto.name;
    }
    return this.userRepository.save(user);
  }

  /**
   * Soft-deletes an agency user from HQ.
   */
  async deleteUser(id: string): Promise<User> {
    const user = await this.findUserById(id);
    await this.userRepository.softDelete(id);
    user.deletedAt = new Date();
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
   * Soft-deletes a location from HQ.
   */
  async deleteLocation(id: string): Promise<Location> {
    const location = await this.findLocationById(id);
    await this.locationRepository.softDelete(id);
    location.deletedAt = new Date();
    return location;
  }

  /**
   * Fetches latest Places API metrics for a location and stores a daily snapshot.
   */
  async refreshLocationMetrics(id: string): Promise<LocationMetric> {
    return this.locationsService.refreshMetrics(id);
  }

  /**
   * Updates a location slug for HQ, ensuring uniqueness.
   */
  async updateLocationSlug(
    id: string,
    dto: HqUpdateLocationSlugDto,
  ): Promise<Location> {
    const location = await this.findLocationById(id);
    const slug = dto.slug.trim().toLowerCase();
    if (location.slug === slug) {
      return location;
    }
    const existing = await this.locationRepository.findOne({
      where: { slug, id: Not(id) },
      withDeleted: true,
      select: ['id'],
    });
    if (existing) {
      throw new ConflictException(`Slug "${slug}" is already in use`);
    }
    location.slug = slug;
    return this.locationRepository.save(location);
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
    return this.locationRepository.save(location);
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
    return this.orderRepository.save(order);
  }

  /**
   * Creates a batch of unassigned claimable QR codes for pre-printed standees.
   */
  async createQrBatch(dto: HqCreateQrBatchDto): Promise<HqQrBatchResult> {
    const size = dto.size ?? QR_BATCH_DEFAULT_SIZE;
    const batchId = generateId();
    const rows: QrCode[] = [];
    const used = new Set<string>();

    while (rows.length < size) {
      const code = generateQrCodeValue();
      if (used.has(code)) {
        continue;
      }
      used.add(code);
      const existing = await this.qrCodeRepository.findOne({
        where: { code },
        select: ['id'],
      });
      if (existing) {
        continue;
      }
      rows.push(
        this.qrCodeRepository.create({
          code,
          batchId,
          locationId: null,
          targetUrl: null,
          assignedAt: null,
        }),
      );
    }

    const codes = await this.qrCodeRepository.save(rows);
    return { batchId, size: codes.length, codes };
  }

  /**
   * Deletes an unassigned QR code. Assigned codes must be unassigned first.
   */
  async deleteQrCode(id: string): Promise<QrCode> {
    const qr = await this.qrCodeRepository.findOne({ where: { id } });
    if (!qr) {
      throw new NotFoundException(`QR code with id "${id}" not found`);
    }
    if (qr.locationId || qr.targetUrl) {
      throw new BadRequestException(
        'Cannot delete an assigned QR code. Remove the assignment first.',
      );
    }
    await this.qrCodeRepository.remove(qr);
    return qr;
  }

  /**
   * Assigns (or reassigns) a claimable QR code to a location and sets targetUrl from slug.
   */
  async assignQrCode(dto: HqAssignQrCodeDto): Promise<QrCode> {
    const code = dto.code.trim().toUpperCase();
    const qr = await this.qrCodeRepository.findOne({ where: { code } });
    if (!qr) {
      throw new NotFoundException(`QR code "${code}" not found`);
    }

    const location = await this.findLocationById(dto.locationId.trim());
    if (!location.slug?.trim()) {
      throw new BadRequestException(
        `Location "${location.id}" has no slug; cannot build rating target URL`,
      );
    }

    qr.locationId = location.id;
    qr.targetUrl = ratingPageTargetUrl(location.slug);
    qr.assignedAt = new Date();
    await this.qrCodeRepository.save(qr);

    const assigned = await this.qrCodeRepository.findOne({
      where: { id: qr.id },
      relations: ['location'],
    });
    if (!assigned) {
      throw new NotFoundException(`QR code "${code}" not found after assign`);
    }
    return assigned;
  }

  /**
   * Clears location assignment so the physical QR can be reused or deleted.
   */
  async unassignQrCode(id: string): Promise<QrCode> {
    const qr = await this.qrCodeRepository.findOne({ where: { id } });
    if (!qr) {
      throw new NotFoundException(`QR code with id "${id}" not found`);
    }
    if (!qr.locationId && !qr.targetUrl) {
      throw new BadRequestException(`QR code "${qr.code}" is not assigned`);
    }

    qr.locationId = null;
    qr.targetUrl = null;
    qr.assignedAt = null;
    return this.qrCodeRepository.save(qr);
  }

  /**
   * Public lookup for claimable QR codes. Does not expose location internals.
   */
  async resolveQrCode(rawCode: string): Promise<PublicQrCodeDto> {
    const code = rawCode.trim().toUpperCase();
    if (!code) {
      throw new NotFoundException('QR code not found');
    }
    const qr = await this.qrCodeRepository.findOne({ where: { code } });
    if (!qr) {
      throw new NotFoundException(`QR code "${code}" not found`);
    }
    return new PublicQrCodeDto({
      code: qr.code,
      targetUrl: qr.targetUrl?.trim() || null,
    });
  }

  /**
   * Lists claimable QR codes with location assignment when present.
   */
  async findQrCodes(
    query: HqQrCodesQueryDto,
  ): Promise<PaginatedResponseDto<QrCode>> {
    const { page = 1, limit = 20, search, batchId, locationId } = query;
    const skip = (page - 1) * limit;
    const qb = this.qrCodeRepository
      .createQueryBuilder('qr')
      .leftJoinAndSelect('qr.location', 'location')
      .orderBy('qr.createdAt', 'DESC')
      .skip(skip)
      .take(limit);

    const term = search?.trim();
    if (term) {
      qb.andWhere('(qr.code ILIKE :term OR qr.id ILIKE :term)', {
        term: `%${term}%`,
      });
    }
    if (batchId?.trim()) {
      qb.andWhere('qr.batchId = :batchId', { batchId: batchId.trim() });
    }
    if (locationId?.trim()) {
      qb.andWhere('qr.locationId = :locationId', {
        locationId: locationId.trim(),
      });
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
