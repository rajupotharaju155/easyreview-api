import type { PlanEntitlements } from './plan-entitlements';

export const PLAN_CODES = {
  QUICK_TRIAL: 'quick_trial',
  STARTER: 'starter',
  GROWTH: 'growth',
  BUSINESS_PRO: 'business_pro',
  FREE_TRIAL: 'free_trial',
} as const;

export type PlanSeed = {
  code: string;
  name: string;
  amount: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
  entitlements: PlanEntitlements;
};

const STARTER_ENTITLEMENTS: PlanEntitlements = {
  multiLanguageAi: true,
  standeeIncluded: true,
  nfcIncluded: false,
};

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: PLAN_CODES.QUICK_TRIAL,
    name: 'Quick Trial',
    amount: 7,
    currency: 'INR',
    durationDays: 7,
    isActive: true,
    sortOrder: 1,
    entitlements: {
      multiLanguageAi: false,
      standeeIncluded: false,
      nfcIncluded: false,
    },
  },
  {
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    amount: 299,
    currency: 'INR',
    durationDays: 30,
    isActive: true,
    sortOrder: 2,
    entitlements: STARTER_ENTITLEMENTS,
  },
  {
    code: PLAN_CODES.GROWTH,
    name: 'Growth',
    amount: 999,
    currency: 'INR',
    durationDays: 180,
    isActive: true,
    sortOrder: 3,
    entitlements: STARTER_ENTITLEMENTS,
  },
  {
    code: PLAN_CODES.BUSINESS_PRO,
    name: 'Business Pro',
    amount: 1499,
    currency: 'INR',
    durationDays: 365,
    isActive: true,
    sortOrder: 4,
    entitlements: {
      multiLanguageAi: true,
      standeeIncluded: true,
      nfcIncluded: true,
    },
  },
  {
    code: PLAN_CODES.FREE_TRIAL,
    name: '14-day free trial',
    amount: 0,
    currency: 'INR',
    durationDays: 14,
    isActive: true,
    sortOrder: 99,
    entitlements: STARTER_ENTITLEMENTS,
  },
];
