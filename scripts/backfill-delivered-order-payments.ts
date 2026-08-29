/**
 * Backfill success payments for delivered standee orders.
 *
 * - Delivered orders with no order payment → insert success
 * - Delivered orders with a pending order payment → mark success
 * - createdAt / succeededAt / updatedAt are copied from order.createdAt
 *
 * 1. Leave DRY_RUN = true and inspect the plan.
 * 2. Set DRY_RUN = false and run against the target env:
 *      NODE_ENV=staging yarn script:backfill-delivered-order-payments
 *      NODE_ENV=development yarn script:backfill-delivered-order-payments
 *      NODE_ENV=production yarn script:backfill-delivered-order-payments
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource } from 'typeorm';
import { generateId } from '../src/common/utils/id';
import { getPostgresConnectionOptions } from '../src/database/postgres.config';
import { Order } from '../src/orders/entities/order.entity';
import { OrderStatus } from '../src/orders/enums/order-status.enum';
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentKind } from '../src/payments/enums/payment-kind.enum';
import { PaymentProvider } from '../src/payments/enums/payment-provider.enum';
import { PaymentStatus } from '../src/payments/enums/payment-status.enum';

const DRY_RUN = true;
const NOTES = 'Backfilled from delivered order';

function formatTimestamp(value: Date | string): string {
  return value instanceof Date ? value.toISOString() : String(value);
}

function loadEnvironmentConfig(): void {
  const nodeEnv = process.env.NODE_ENV;
  console.error(`[INFO] Environment: ${nodeEnv || 'undefined'}`);

  switch (nodeEnv) {
    case 'development':
      config({ path: '.env.development' });
      break;
    case 'staging':
      config({ path: '.env.staging' });
      break;
    case 'production':
      config({ path: '.env.production' });
      break;
    default:
      throw new Error(
        `Set NODE_ENV to development, staging, or production. Example:\n  NODE_ENV=staging yarn script:backfill-delivered-order-payments`,
      );
  }
}

async function main(): Promise<void> {
  loadEnvironmentConfig();

  const url = new ConfigService().getOrThrow<string>('DATABASE_URL');
  const dataSource = new DataSource({
    ...getPostgresConnectionOptions(url),
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  const orders = await dataSource.getRepository(Order).find({
    where: { status: OrderStatus.DELIVERED },
    order: { createdAt: 'ASC' },
  });

  console.error(
    `[INFO] ${DRY_RUN ? 'DRY RUN — ' : ''}delivered orders=${orders.length}`,
  );
  console.log(
    `orderId\tbusiness\tamount\torderCreated\tpaymentId\tresult`,
  );

  let created = 0;
  let updated = 0;
  let skipped = 0;
  let failed = 0;

  for (const order of orders) {
    try {
      const result = await dataSource.transaction(async (manager) => {
        const payments = manager.getRepository(Payment);
        const existing = await payments.findOne({
          where: {
            orderId: order.id,
            kind: PaymentKind.ORDER,
          },
          order: { createdAt: 'DESC' },
        });

        if (existing?.status === PaymentStatus.SUCCESS) {
          return {
            kind: 'skipped' as const,
            paymentId: existing.id,
            reason: 'success payment already exists',
          };
        }

        if (existing && existing.status !== PaymentStatus.PENDING) {
          return {
            kind: 'skipped' as const,
            paymentId: existing.id,
            reason: `${existing.status} payment already exists`,
          };
        }

        if (DRY_RUN) {
          return {
            kind: existing ? ('updated' as const) : ('created' as const),
            paymentId: existing?.id ?? '(new)',
          };
        }

        const PAID_AT = order.createdAt;
        const PROVIDER = PaymentProvider.UPI;

        if (existing) {
          await payments
            .createQueryBuilder()
            .update(Payment)
            .set({
              status: PaymentStatus.SUCCESS,
              provider: existing.provider ?? PROVIDER,
              succeededAt: PAID_AT,
              createdAt: PAID_AT,
              updatedAt: PAID_AT,
              notes: existing.notes?.trim() || NOTES,
            })
            .where('id = :id', { id: existing.id })
            .execute();
          return { kind: 'updated' as const, paymentId: existing.id };
        }

        const paymentId = generateId();
        await payments
          .createQueryBuilder()
          .insert()
          .into(Payment)
          .values({
            id: paymentId,
            kind: PaymentKind.ORDER,
            subscriptionId: null,
            orderId: order.id,
            planId: null,
            locationId: order.locationId,
            userId: order.userId,
            amount: order.amountInr,
            discountAmount: 0,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: PROVIDER,
            utr: null,
            gatewayOrderId: null,
            gatewayPaymentId: null,
            succeededAt: PAID_AT,
            notes: NOTES,
            metadata: null,
            createdAt: PAID_AT,
            updatedAt: PAID_AT,
          })
          .execute();
        return { kind: 'created' as const, paymentId };
      });

      if (result.kind === 'skipped') {
        skipped += 1;
        console.log(
          `${order.id}\t${order.businessNameSnapshot}\t${order.amountInr}\t${formatTimestamp(order.createdAt)}\t${result.paymentId}\tskipped (${result.reason})`,
        );
        continue;
      }

      if (result.kind === 'updated') {
        updated += 1;
      } else {
        created += 1;
      }
      console.log(
        `${order.id}\t${order.businessNameSnapshot}\t${order.amountInr}\t${formatTimestamp(order.createdAt)}\t${result.paymentId}\t${result.kind}${DRY_RUN ? ' (dry-run)' : ''}`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(
        `${order.id}\t${order.businessNameSnapshot}\t${order.amountInr}\t${formatTimestamp(order.createdAt)}\t\tfailed (${message})`,
      );
    }
  }

  await dataSource.destroy();
  console.log(
    `created=${created} updated=${updated} skipped=${skipped} failed=${failed}${DRY_RUN ? ' dry-run' : ''}`,
  );
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
