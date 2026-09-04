import { IsIn } from 'class-validator';
import {
  SUBSCRIPTION_QUEUE_KEYS,
  type SubscriptionQueueKey,
} from '../hq.constants';

export class HqSubscriptionQueueParamDto {
  @IsIn(SUBSCRIPTION_QUEUE_KEYS, {
    message: `queue must be one of: ${SUBSCRIPTION_QUEUE_KEYS.join(', ')}`,
  })
  queue: SubscriptionQueueKey;
}
