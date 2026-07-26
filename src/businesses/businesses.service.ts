import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { QueryFailedError, Repository, UpdateResult } from 'typeorm';
import { UsersService } from '../users/users.service';
import { CreateBusinessDto } from './dto/create-business.dto';
import { UpdateBusinessDto } from './dto/update-business.dto';
import { Business } from './entities/business.entity';

@Injectable()
export class BusinessesService {
  constructor(
    @InjectRepository(Business)
    private readonly businessRepository: Repository<Business>,
    private readonly usersService: UsersService,
  ) {}

  async create(createBusinessDto: CreateBusinessDto): Promise<Business> {
    await this.usersService.findOne(createBusinessDto.userId);

    try {
      const business = this.businessRepository.create({
        name: createBusinessDto.name,
        userId: createBusinessDto.userId,
      });
      return await this.businessRepository.save(business);
    } catch (error) {
      if (this.isForeignKeyViolation(error)) {
        throw new NotFoundException(
          `User with id "${createBusinessDto.userId}" not found`,
        );
      }
      throw error;
    }
  }

  async findAll(userId?: string): Promise<Business[]> {
    return this.businessRepository.find({
      where: userId ? { userId } : undefined,
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
