import {
  Injectable,
  InternalServerErrorException,
  Logger,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Razorpay from 'razorpay';
import { generateId } from '../common/utils/id';
import {
  razorpayPaymentSignature,
  razorpaySignaturesMatch,
} from './utils/razorpay-signature.util';

export type RazorpayCreatedOrder = {
  id: string;
  amount: number;
  currency: string;
};

@Injectable()
export class RazorpayClient {
  private readonly logger = new Logger(RazorpayClient.name);

  constructor(private readonly configService: ConfigService) {}

  /**
   * Creates a Razorpay order. Amount is in paise.
   * Auth failures become 401. Any other Razorpay error becomes 500.
   */
  async createOrder(input: {
    amount: number;
    currency: string;
    notes?: Record<string, string | number>;
  }): Promise<RazorpayCreatedOrder> {
    const client = this.client();
    try {
      const order = await client.orders.create({
        amount: input.amount,
        currency: input.currency,
        receipt: generateId(),
        notes: input.notes,
      });
      return {
        id: order.id,
        amount: Number(order.amount),
        currency: order.currency,
      };
    } catch (error) {
      this.throwMapped(error);
    }
  }

  /** True when razorpay_signature matches HMAC-SHA256 of "order_id|payment_id". */
  signaturesMatch(
    orderId: string,
    paymentId: string,
    signature: string,
  ): boolean {
    const expected = razorpayPaymentSignature(
      orderId,
      paymentId,
      this.keySecret(),
    );
    return razorpaySignaturesMatch(expected, signature);
  }

  /** Razorpay SDK client built from RAZORPAY_KEY_ID and RAZORPAY_KEY_SECRET. */
  private client(): Razorpay {
    return new Razorpay({
      key_id: this.keyId(),
      key_secret: this.keySecret(),
    });
  }

  /** Razorpay key id from the environment. Missing config is a 500. */
  private keyId(): string {
    const keyId = this.configService.get<string>('RAZORPAY_KEY_ID')?.trim();
    if (!keyId) {
      throw new InternalServerErrorException('Razorpay is not configured');
    }
    return keyId;
  }

  /** Razorpay key secret from the environment. Never returned to the client. */
  private keySecret(): string {
    const keySecret = this.configService
      .get<string>('RAZORPAY_KEY_SECRET')
      ?.trim();
    if (!keySecret) {
      throw new InternalServerErrorException('Razorpay is not configured');
    }
    return keySecret;
  }

  /** Maps a Razorpay SDK error to 401 for auth failure and 500 otherwise. */
  private throwMapped(error: unknown): never {
    const statusCode = razorpayStatusCode(error);
    const description = razorpayErrorDescription(error);
    this.logger.error(
      `Razorpay order request failed${statusCode ? ` (${statusCode})` : ''}${
        description ? `: ${description}` : ''
      }`,
    );
    if (statusCode === 401 || /authentication failed/i.test(description)) {
      throw new UnauthorizedException('Razorpay authentication failed');
    }
    throw new InternalServerErrorException('Unable to create payment order');
  }
}

/** HTTP status from a thrown Razorpay error object, when the SDK included one. */
function razorpayStatusCode(error: unknown): number | undefined {
  if (!error || typeof error !== 'object') return undefined;
  const statusCode = (error as { statusCode?: unknown }).statusCode;
  return typeof statusCode === 'number' ? statusCode : undefined;
}

/** Razorpay error description used to detect an authentication failure. */
function razorpayErrorDescription(error: unknown): string {
  if (!error || typeof error !== 'object') return '';
  const inner = (error as { error?: { description?: unknown } }).error;
  return typeof inner?.description === 'string' ? inner.description : '';
}
