/**
 * Grant a 30-day free_trial subscription + ₹0 payment to LOCATION_IDS.
 *
 * 1. Put location ids in LOCATION_IDS below.
 * 2. From easyreview-api:
 *      NODE_ENV=staging yarn script:grant-old-trial
 *      NODE_ENV=development yarn script:grant-old-trial
 *      NODE_ENV=production yarn script:grant-old-trial
 */
import { ConfigService } from '@nestjs/config';
import { config } from 'dotenv';
import { DataSource, In } from 'typeorm';
import { getPostgresConnectionOptions } from '../src/database/postgres.config';
import { Location } from '../src/locations/entities/location.entity';
import { Payment } from '../src/payments/entities/payment.entity';
import { PaymentKind } from '../src/payments/enums/payment-kind.enum';
import { PaymentStatus } from '../src/payments/enums/payment-status.enum';
import { Plan } from '../src/plans/entities/plan.entity';
import { Subscription } from '../src/subscriptions/entities/subscription.entity';
import { SubscriptionSource } from '../src/subscriptions/enums/subscription-source.enum';
import { SubscriptionStatus } from '../src/subscriptions/enums/subscription-status.enum';

const PLAN_ID = 'vJKnLXFSojKUH4K1';
const PLAN_CODE = 'free_trial';
const TRIAL_DAYS = 30;
const NOTES = '30 Days FREE Subscription for old customers';

const LOCATION_IDS: string[] = [
  // 'NQSeLKm0sz3NxJ4V',
];

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
        `Set NODE_ENV to development, staging, or production. Example:\n  NODE_ENV=staging yarn script:grant-old-trial`,
      );
  }
}

function addDays(isoDate: string, days: number): string {
  const [year, month, day] = isoDate.split('-').map(Number);
  return new Date(Date.UTC(year, month - 1, day + days))
    .toISOString()
    .slice(0, 10);
}

function dateIst(value: Date | string): string {
  const date = value instanceof Date ? value : new Date(value);
  return new Intl.DateTimeFormat('en-CA', {
    timeZone: 'Asia/Kolkata',
  }).format(date);
}

async function main(): Promise<void> {
  const locationIds = [
    ...new Set(LOCATION_IDS.map((id) => id.trim()).filter(Boolean)),
  ];
  if (locationIds.length === 0) {
    throw new Error(
      'Add locationIds to LOCATION_IDS in this script before running.',
    );
  }

  loadEnvironmentConfig();

  const url = new ConfigService().getOrThrow<string>('DATABASE_URL');
  const dataSource = new DataSource({
    ...getPostgresConnectionOptions(url),
    entities: ['src/**/*.entity.ts'],
    synchronize: false,
    logging: false,
  });

  await dataSource.initialize();

  const planRepository = dataSource.getRepository(Plan);

  const plan = await planRepository.findOne({ where: { id: PLAN_ID } });
  if (!plan) {
    await dataSource.destroy();
    throw new Error(`Plan ${PLAN_ID} not found`);
  }
  if (plan.code !== PLAN_CODE) {
    await dataSource.destroy();
    throw new Error(
      `Plan ${PLAN_ID} has code "${plan.code}", expected "${PLAN_CODE}"`,
    );
  }

  console.log(
    `Granting ${TRIAL_DAYS}-day ${PLAN_CODE} to ${locationIds.length} location(s)`,
  );
  console.log(
    `locationId\tname\tstartDate\tendDate\tsubscriptionId\tpaymentId\tresult`,
  );

  let created = 0;
  let skipped = 0;
  let failed = 0;

  for (const locationId of locationIds) {
    try {
      const result = await dataSource.transaction(async (manager) => {
        const locations = manager.getRepository(Location);
        const subscriptions = manager.getRepository(Subscription);
        const payments = manager.getRepository(Payment);

        const location = await locations.findOne({
          where: { id: locationId },
        });
        if (!location) {
          throw new Error('location not found');
        }

        const open = await subscriptions.findOne({
          where: {
            locationId: location.id,
            status: In([
              SubscriptionStatus.PENDING_PAYMENT,
              SubscriptionStatus.ACTIVE,
            ]),
          },
        });
        if (open) {
          return { kind: 'skipped' as const, location, open };
        }

        const startDate = dateIst(location.createdAt);
        const endDate = addDays(startDate, TRIAL_DAYS);

        const subscription = await subscriptions.save(
          subscriptions.create({
            locationId: location.id,
            userId: location.userId,
            planId: plan.id,
            status: SubscriptionStatus.ACTIVE,
            startDate,
            endDate,
            source: SubscriptionSource.HQ,
            notes: NOTES,
            cancelledAt: null,
            gatewaySubscriptionId: null,
          }),
        );

        const payment = await payments.save(
          payments.create({
            kind: PaymentKind.SUBSCRIPTION,
            subscriptionId: subscription.id,
            orderId: null,
            planId: plan.id,
            locationId: location.id,
            userId: location.userId,
            amount: 0,
            currency: 'INR',
            status: PaymentStatus.SUCCESS,
            provider: null,
            succeededAt: new Date(),
          }),
        );

        return {
          kind: 'created' as const,
          location,
          subscription,
          payment,
          startDate,
          endDate,
        };
      });

      if (result.kind === 'skipped') {
        skipped += 1;
        console.log(
          `${result.location.id}\t${result.location.name}\t\t\t${result.open.id}\t\tskipped (${result.open.status} already exists)`,
        );
        continue;
      }

      created += 1;
      console.log(
        `${result.location.id}\t${result.location.name}\t${result.startDate}\t${result.endDate}\t${result.subscription.id}\t${result.payment.id}\tcreated`,
      );
    } catch (error) {
      failed += 1;
      const message = error instanceof Error ? error.message : String(error);
      console.log(`${locationId}\t\t\t\t\t\tfailed (${message})`);
    }
  }

  await dataSource.destroy();
  console.log(`created=${created} skipped=${skipped} failed=${failed}`);
  if (failed > 0) {
    process.exitCode = 1;
  }
}

void main().catch((error: unknown) => {
  console.error(error instanceof Error ? error.message : error);
  process.exit(1);
});
