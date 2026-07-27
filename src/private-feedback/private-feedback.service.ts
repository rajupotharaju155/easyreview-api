import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CurrentUserUtil } from '../common/utils/current-user.util';
import { Location } from '../locations/entities/location.entity';
import { CreatePrivateFeedbackDto } from './dto/create-private-feedback.dto';
import { PrivateFeedbackQueryDto } from './dto/private-feedback-query.dto';
import { PrivateFeedback } from './entities/private-feedback.entity';

@Injectable()
export class PrivateFeedbackService {
  constructor(
    @InjectRepository(PrivateFeedback)
    private readonly privateFeedbackRepository: Repository<PrivateFeedback>,
    @InjectRepository(Location)
    private readonly locationRepository: Repository<Location>,
    private readonly currentUserUtil: CurrentUserUtil,
  ) {}

  async create(
    createPrivateFeedbackDto: CreatePrivateFeedbackDto,
  ): Promise<PrivateFeedback> {
    const location = await this.locationRepository.findOne({
      where: { id: createPrivateFeedbackDto.locationId },
    });
    if (!location) {
      throw new NotFoundException(
        `Location with id "${createPrivateFeedbackDto.locationId}" not found`,
      );
    }
    const privateFeedback = this.privateFeedbackRepository.create({
      locationId: location.id,
      rating: createPrivateFeedbackDto.rating,
      feedback: createPrivateFeedbackDto.feedback.trim(),
    });
    return this.privateFeedbackRepository.save(privateFeedback);
  }

  async findAllPaginated(
    queryDto: PrivateFeedbackQueryDto,
  ): Promise<PaginatedResponseDto<PrivateFeedback>> {
    const userId = this.currentUserUtil.getCurrentUserId();
    const { page = 1, limit = 10, rating, locationId } = queryDto;
    const skip = (page - 1) * limit;
    const query = this.privateFeedbackRepository
      .createQueryBuilder('feedback')
      .innerJoinAndSelect('feedback.location', 'location')
      .select([
        'feedback.id',
        'feedback.locationId',
        'feedback.rating',
        'feedback.feedback',
        'feedback.createdAt',
        'feedback.updatedAt',
        'location.id',
        'location.name',
      ])
      .where('location.userId = :userId', { userId });
    if (rating !== undefined) {
      query.andWhere('feedback.rating = :rating', { rating });
    }
    if (locationId) {
      query.andWhere('feedback.locationId = :locationId', { locationId });
    }
    const [data, total] = await query
      .orderBy('feedback.createdAt', 'DESC')
      .skip(skip)
      .take(limit)
      .getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }
}
