import {
  ConflictException,
  Injectable,
  NotFoundException,
  OnModuleInit,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { FindOptionsWhere, QueryFailedError, Repository } from 'typeorm';
import { LoggerService } from '../common/services/logger.service';
import { DEFAULT_PLANS } from './constants/default-plans';
import { mergePlanEntitlements } from './constants/plan-entitlements';
import { CreatePlanDto } from './dto/create-plan.dto';
import { HqPlansQueryDto } from './dto/hq-plans-query.dto';
import { UpdatePlanDto } from './dto/update-plan.dto';
import { Plan } from './entities/plan.entity';

@Injectable()
export class PlansService implements OnModuleInit {
  constructor(
    @InjectRepository(Plan)
    private readonly planRepository: Repository<Plan>,
    private readonly logger: LoggerService,
  ) {
    this.logger.setContext(PlansService.name);
  }

  //TODO: Remove this after plans are created in both DBs
  async onModuleInit(): Promise<void> {
    await this.seedDefaultPlans();
  }

  async findActiveCatalog(): Promise<Plan[]> {
    return this.planRepository.find({
      where: { isActive: true },
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findActiveById(id: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({
      where: { id, isActive: true },
    });

    if (!plan) {
      throw new NotFoundException(`Plan with id "${id}" not found`);
    }

    return plan;
  }

  async findAll(query: HqPlansQueryDto = {}): Promise<Plan[]> {
    const where: FindOptionsWhere<Plan> = {};

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    return this.planRepository.find({
      where,
      order: { sortOrder: 'ASC', createdAt: 'ASC' },
    });
  }

  async findOne(id: string): Promise<Plan> {
    const plan = await this.planRepository.findOne({ where: { id } });

    if (!plan) {
      throw new NotFoundException(`Plan with id "${id}" not found`);
    }

    return plan;
  }

  async create(dto: CreatePlanDto): Promise<Plan> {
    try {
      const plan = this.planRepository.create({
        code: dto.code,
        name: dto.name,
        amount: dto.amount,
        currency: dto.currency ?? 'INR',
        durationDays: dto.durationDays,
        isActive: dto.isActive ?? true,
        sortOrder: dto.sortOrder ?? 0,
        entitlements: mergePlanEntitlements(dto.entitlements),
        gatewayPlanId: dto.gatewayPlanId ?? null,
      });
      return await this.planRepository.save(plan);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Plan code "${dto.code}" already in use`);
      }
      throw error;
    }
  }

  async update(id: string, dto: UpdatePlanDto): Promise<Plan> {
    const plan = await this.findOne(id);

    if (dto.code !== undefined) plan.code = dto.code;
    if (dto.name !== undefined) plan.name = dto.name;
    if (dto.amount !== undefined) plan.amount = dto.amount;
    if (dto.currency !== undefined) plan.currency = dto.currency;
    if (dto.durationDays !== undefined) plan.durationDays = dto.durationDays;
    if (dto.isActive !== undefined) plan.isActive = dto.isActive;
    if (dto.sortOrder !== undefined) plan.sortOrder = dto.sortOrder;
    if (dto.entitlements !== undefined) {
      plan.entitlements = mergePlanEntitlements({
        ...plan.entitlements,
        ...dto.entitlements,
      });
    }
    if (dto.gatewayPlanId !== undefined) {
      plan.gatewayPlanId = dto.gatewayPlanId;
    }

    try {
      return await this.planRepository.save(plan);
    } catch (error) {
      if (this.isUniqueViolation(error)) {
        throw new ConflictException(`Plan code "${plan.code}" already in use`);
      }
      throw error;
    }
  }

  async remove(id: string): Promise<Plan> {
    const plan = await this.findOne(id);
    await this.planRepository.softDelete(id);
    plan.deletedAt = new Date();
    return plan;
  }

  private async seedDefaultPlans(): Promise<void> {
    for (const seed of DEFAULT_PLANS) {
      const existing = await this.planRepository.findOne({
        where: { code: seed.code },
        withDeleted: true,
      });
      if (existing) {
        continue;
      }

      await this.planRepository.save(this.planRepository.create(seed));
      this.logger.log(`Seeded plan "${seed.code}"`);
    }
  }

  private isUniqueViolation(error: unknown): boolean {
    return (
      error instanceof QueryFailedError &&
      (error as QueryFailedError & { driverError?: { code?: string } })
        .driverError?.code === '23505'
    );
  }
}
