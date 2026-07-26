import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, UpdateResult } from 'typeorm';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Business } from './entities/business.entity';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    const userId = this.currentUserUtil.getCurrentUserId();

    try {
      const business = this.businessRepository.create({
        name: createBusinessDto.name,
        userId,
      });
      return await this.businessRepository.save(business);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundException(`User with id "${userId}" not found`);
      }
      throw error;
    }
  }

  async findAll(userId?: string): Promise<Business[]> {
    const ownerId = userId ?? this.currentUserUtil.getCurrentUserId();

    return this.businessRepository.find({
      where: { userId: ownerId },
      order: { createdAt: 'DESC' },
    });
  }

  async findOne(id: string): Promise<Business> {
    const business = await this.businessRepository.findOne({ where: { id } });

    if (!business) {
      throw new NotFoundException(`Business with id "${id}" not found`);
    }

    return business;
  }

  async update(
    id: string,
    updateBusinessDto: UpdateBusinessDto,
  ): Promise<Business> {
    await this.findOne(id);
    await this.businessRepository.update(id, {
      name: updateBusinessDto.name,
    });
    return this.findOne(id);
  }

  async remove(id: string): Promise<UpdateResult> {
    await this.findOne(id);
    return this.businessRepository.softDelete(id);
  }

  private isForeignKeyViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23503'
    );
  }
}
