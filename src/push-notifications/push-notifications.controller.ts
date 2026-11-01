import { Body, Controller, Get, Headers, Post } from '@nestjs/common';
import { Public } from '../common/decorators/public.decorator';
import { CurrentUser } from '../common/decorators/user.decorator';
import { User } from '../users/entities/user.entity';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import { PushNotificationsService } from './push-notifications.service';

@Controller('push')
export class PushNotificationsController {
  constructor(private readonly pushService: PushNotificationsService) {}

  @Public()
  @Get('vapid-public-key')
  getPublicKey() {
    return this.pushService.getPublicKey();
  }

  @Post('subscriptions')
  save(
    @CurrentUser() user: User,
    @Body() dto: SavePushSubscriptionDto,
    @Headers('user-agent') userAgent: string | undefined,
  ) {
    return this.pushService.save(user.id, dto, userAgent);
  }
}
