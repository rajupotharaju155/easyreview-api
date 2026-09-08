import { Injectable, NotFoundException } from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { HqContactMessagesQueryDto } from './dto/hq-contact-messages-query.dto';
import { ContactMessage } from './entities/contact-message.entity';

@Injectable()
export class ContactMessagesService {
  constructor(
    @InjectRepository(ContactMessage)
    private readonly contactMessageRepository: Repository<ContactMessage>,
  ) {}

  async create(
    dto: CreateContactMessageDto,
    userId?: string | null,
  ): Promise<ContactMessage> {
    const contactMessage = this.contactMessageRepository.create({
      name: dto.name,
      email: dto.email,
      countryCode: dto.countryCode,
      phone: dto.phone,
      message: dto.message,
      submittedFrom: dto.submittedFrom,
      userId: userId ?? null,
    });
    return this.contactMessageRepository.save(contactMessage);
  }

  async findAllForHq(
    query: HqContactMessagesQueryDto,
  ): Promise<PaginatedResponseDto<ContactMessage>> {
    const { page = 1, limit = 10, search, submittedFrom } = query;
    const qb = this.contactMessageRepository
      .createQueryBuilder('message')
      .leftJoinAndSelect('message.user', 'user')
      .orderBy('message.createdAt', 'DESC')
      .skip((page - 1) * limit)
      .take(limit);

    if (submittedFrom) {
      qb.andWhere('message.submittedFrom = :submittedFrom', { submittedFrom });
    }

    const term = search?.trim();
    if (term) {
      qb.andWhere(
        '(message.name ILIKE :term OR message.email ILIKE :term OR message.phone ILIKE :term OR message.message ILIKE :term)',
        { term: `%${term}%` },
      );
    }

    const [data, total] = await qb.getManyAndCount();
    return new PaginatedResponseDto(data, total, page, limit);
  }

  async findOneForHq(id: string): Promise<ContactMessage> {
    const contactMessage = await this.contactMessageRepository.findOne({
      where: { id },
      relations: { user: true },
    });
    if (!contactMessage) {
      throw new NotFoundException(`Contact message "${id}" not found`);
    }
    return contactMessage;
  }

  async removeForHq(id: string): Promise<ContactMessage> {
    const contactMessage = await this.findOneForHq(id);
    await this.contactMessageRepository.remove(contactMessage);
    return contactMessage;
  }
}
