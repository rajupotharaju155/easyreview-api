import { Body, Controller, Post } from '@nestjs/common';
import { CurrentUser } from '../common/decorators/user.decorator';
import { User } from '../users/entities/user.entity';
import { ContactMessagesService } from './contact-messages.service';
import { CreateContactMessageDto } from './dto/create-contact-message.dto';
import { ContactMessage } from './entities/contact-message.entity';

@Controller('contact-messages')
export class ContactMessagesController {
  constructor(
    private readonly contactMessagesService: ContactMessagesService,
  ) {}

  @Post()
  create(
    @Body() dto: CreateContactMessageDto,
    @CurrentUser() user: User,
  ): Promise<ContactMessage> {
    return this.contactMessagesService.create(dto, user.id);
  }
}
