import { Type } from 'class-transformer';
import {
  IsNotEmpty,
  IsString,
  MaxLength,
  ValidateNested,
} from 'class-validator';
import {
  PUSH_ENDPOINT_MAX_LENGTH,
  PUSH_KEY_MAX_LENGTH,
} from '../entities/push-subscription.entity';

export class PushSubscriptionKeysDto {
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_KEY_MAX_LENGTH)
  p256dh: string;

  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_KEY_MAX_LENGTH)
  auth: string;
}

/** Matches the browser's `PushSubscription.toJSON()`. */
export class SavePushSubscriptionDto {
  /** Host is checked against the known push services in the service. */
  @IsString()
  @IsNotEmpty()
  @MaxLength(PUSH_ENDPOINT_MAX_LENGTH)
  endpoint: string;

  @ValidateNested()
  @Type(() => PushSubscriptionKeysDto)
  keys: PushSubscriptionKeysDto;
}
