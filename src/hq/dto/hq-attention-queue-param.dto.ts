import { IsIn } from 'class-validator';
import {
  ATTENTION_QUEUE_KEYS,
  type AttentionQueueKey,
} from '../hq.constants';

export class HqAttentionQueueParamDto {
  @IsIn(ATTENTION_QUEUE_KEYS, {
    message: `queue must be one of: ${ATTENTION_QUEUE_KEYS.join(', ')}`,
  })
  queue: AttentionQueueKey;
}
