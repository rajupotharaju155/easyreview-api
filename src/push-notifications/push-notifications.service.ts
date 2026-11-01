import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as webPush from 'web-push';
import { LoggerService } from '../common/services/logger.service';
import { SavePushSubscriptionDto } from './dto/push-subscription.dto';
import {
  PUSH_USER_AGENT_MAX_LENGTH,
  PushSubscription,
} from './entities/push-subscription.entity';
import {
  isPushServiceEndpoint,
  type PushDeliveryOptions,
  type PushPayload,
} from './push-payload';

const DEFAULT_DELIVERY: Required<PushDeliveryOptions> = {
  urgency: 'normal',
  ttlSeconds: 24 * 60 * 60,
};
/** Push services answer these when a subscription has expired or been revoked. */
const GONE_STATUS_CODES = new Set([404, 410]);

type VapidConfig = { publicKey: string; privateKey: string; subject: string };

/** Web Push: devices users allowed notifications on, and sending to them. */
@Injectable()
export class PushNotificationsService {
  private readonly logger = new LoggerService();
  private readonly vapid: VapidConfig | null;

  constructor(
    @InjectRepository(PushSubscription)
    private readonly subscriptionRepository: Repository<PushSubscription>,
    configService: ConfigService,
  ) {
    this.logger.setContext(PushNotificationsService.name);
    const publicKey = configService.get<string>('VAPID_PUBLIC_KEY')?.trim();
    const privateKey = configService.get<string>('VAPID_PRIVATE_KEY')?.trim();
    const subject = configService.get<string>('VAPID_SUBJECT')?.trim();
    this.vapid = this.validVapid(publicKey, privateKey, subject);
  }

  /** The configured keys, or null (push off) when missing or malformed. */
  private validVapid(
    publicKey: string | undefined,
    privateKey: string | undefined,
    subject: string | undefined,
  ): VapidConfig | null {
    if (!publicKey || !privateKey || !subject) {
      this.logger.warn('VAPID keys not set; push notifications are off');
      return null;
    }
    try {
      // Throws on a malformed key or subject; we pass the details per send.
      webPush.setVapidDetails(subject, publicKey, privateKey);
      return { publicKey, privateKey, subject };
    } catch (error) {
      this.logger.error(
        `Invalid VAPID config; push notifications are off: ${(error as Error).message}`,
      );
      return null;
    }
  }

  /** Public key browsers subscribe with; null while push is not configured. */
  getPublicKey(): { publicKey: string | null } {
    return { publicKey: this.vapid?.publicKey ?? null };
  }

  /** Saves this device for the user. A device another user had is moved over. */
  async save(
    userId: string,
    dto: SavePushSubscriptionDto,
    userAgent: string | undefined,
  ): Promise<void> {
    if (!isPushServiceEndpoint(dto.endpoint)) {
      throw new BadRequestException('Unsupported push service');
    }
    await this.subscriptionRepository.upsert(
      new PushSubscription({
        userId,
        endpoint: dto.endpoint,
        p256dh: dto.keys.p256dh,
        auth: dto.keys.auth,
        userAgent: userAgent?.slice(0, PUSH_USER_AGENT_MAX_LENGTH) ?? null,
      }),
      { conflictPaths: ['endpoint'], skipUpdateIfNoValuesChanged: true },
    );
  }

  /**
   * Sends to every device the user subscribed. Never throws: a failed push
   * is logged, and devices the push service reports as gone are removed.
   */
  async sendToUser(
    userId: string,
    payload: PushPayload,
    options: PushDeliveryOptions = {},
  ): Promise<void> {
    if (!this.vapid) return;
    const delivery = { ...DEFAULT_DELIVERY, ...options };
    try {
      const subscriptions = await this.subscriptionRepository.find({
        where: { userId },
      });
      await Promise.all(
        subscriptions.map((subscription) =>
          this.send(subscription, payload, delivery, this.vapid!),
        ),
      );
    } catch (error) {
      this.logger.error(
        'Push to user failed',
        (error as Error).stack,
        undefined,
        {
          userId,
        },
      );
    }
  }

  private async send(
    subscription: PushSubscription,
    payload: PushPayload,
    delivery: Required<PushDeliveryOptions>,
    vapid: VapidConfig,
  ): Promise<void> {
    try {
      await webPush.sendNotification(
        {
          endpoint: subscription.endpoint,
          keys: { p256dh: subscription.p256dh, auth: subscription.auth },
        },
        JSON.stringify(payload),
        {
          vapidDetails: vapid,
          TTL: delivery.ttlSeconds,
          urgency: delivery.urgency,
        },
      );
      await this.subscriptionRepository.update(subscription.id, {
        lastUsedAt: new Date(),
      });
    } catch (error) {
      const statusCode = (error as { statusCode?: number }).statusCode;
      if (statusCode && GONE_STATUS_CODES.has(statusCode)) {
        await this.subscriptionRepository.delete(subscription.id);
        return;
      }
      this.logger.warn('Push to device failed', undefined, {
        subscriptionId: subscription.id,
        statusCode,
        message: (error as Error).message,
      });
    }
  }
}
