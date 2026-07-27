import { Body, Controller, Get, Post, Query } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { CreatePrivateFeedbackDto } from './dto/create-private-feedback.dto';
import { PrivateFeedbackQueryDto } from './dto/private-feedback-query.dto';
import { PrivateFeedback } from './entities/private-feedback.entity';
import { PrivateFeedbackService } from './private-feedback.service';

@Controller('private-feedback')
export class PrivateFeedbackController {
  constructor(
    private readonly privateFeedbackService: PrivateFeedbackService,
  ) {}

  @Public()
  @Post()
  create(
    @Body() createPrivateFeedbackDto: CreatePrivateFeedbackDto,
  ): Promise<PrivateFeedback> {
    return this.privateFeedbackService.create(createPrivateFeedbackDto);
  }

  @Get()
  findAll(
    @Query() queryDto: PrivateFeedbackQueryDto,
  ): Promise<PaginatedResponseDto<PrivateFeedback>> {
    return this.privateFeedbackService.findAllPaginated(queryDto);
  }
}
