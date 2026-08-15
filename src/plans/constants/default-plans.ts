import {
  CORE_PLAN_FEATURES,
  planFeature,
  type PlanFeature,
} from './plan-feature';

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
  features: PlanFeature[];
};

const STARTER_FEATURES: PlanFeature[] = [
  ...CORE_PLAN_FEATURES,
  planFeature('multi_language_ai', 'Multi-language AI drafts', true),
  planFeature('qr_standee', '1 QR Standee', true),
  planFeature('nfc_card', 'NFC card', false),
];

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: PLAN_CODES.QUICK_TRIAL,
    name: 'Quick Trial',
    amount: 7,
    currency: 'INR',
    durationDays: 7,
    isActive: true,
    sortOrder: 1,
    features: [
      ...CORE_PLAN_FEATURES,
      planFeature('multi_language_ai', 'Multi-language AI drafts', false),
      planFeature('qr_standee', 'QR Standee', false),
      planFeature('nfc_card', 'NFC card', false),
    ],
  },
  {
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    amount: 299,
    currency: 'INR',
    durationDays: 30,
    isActive: true,
    sortOrder: 2,
    features: STARTER_FEATURES,
  },
  {
    code: PLAN_CODES.GROWTH,
    name: 'Growth',
    amount: 999,
    currency: 'INR',
    durationDays: 180,
    isActive: true,
    sortOrder: 3,
    features: STARTER_FEATURES,
  },
  {
    code: PLAN_CODES.BUSINESS_PRO,
    name: 'Business Pro',
    amount: 1499,
    currency: 'INR',
    durationDays: 365,
    isActive: true,
    sortOrder: 4,
    features: [
      ...CORE_PLAN_FEATURES,
      planFeature('multi_language_ai', 'Multi-language AI drafts', true),
      planFeature('qr_standee', '1 QR Standee', true),
      planFeature('nfc_card', '1 NFC card', true),
      planFeature('priority_whatsapp', 'Priority WhatsApp support', true),
    ],
  },
  {
    code: PLAN_CODES.FREE_TRIAL,
    name: '14-day free trial',
    amount: 0,
    currency: 'INR',
    durationDays: 14,
    isActive: true,
    sortOrder: 99,
    features: STARTER_FEATURES,
  },
];
