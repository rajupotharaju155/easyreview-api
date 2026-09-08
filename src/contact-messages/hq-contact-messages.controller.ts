import { Controller, Delete, Get, Param, Query, UseGuards } from '@nestjs/common';
import { PaginatedResponseDto } from '../common/dto/paginated-response.dto';
import { HqGuard } from '../hq/guards/hq.guard';
import { ContactMessagesService } from './contact-messages.service';
import { HqContactMessagesQueryDto } from './dto/hq-contact-messages-query.dto';
import { ContactMessage } from './entities/contact-message.entity';

@Controller('hq/contact-messages')
@UseGuards(HqGuard)
export class HqContactMessagesController {
  constructor(
    private readonly contactMessagesService: ContactMessagesService,
  ) {}

  @Get()
  findAll(
    @Query() query: HqContactMessagesQueryDto,
  ): Promise<PaginatedResponseDto<ContactMessage>> {
    return this.contactMessagesService.findAllForHq(query);
  }

  @Get(':id')
  findOne(@Param('id') id: string): Promise<ContactMessage> {
    return this.contactMessagesService.findOneForHq(id);
  }

  @Delete(':id')
  remove(@Param('id') id: string): Promise<ContactMessage> {
    return this.contactMessagesService.removeForHq(id);
  }
}
