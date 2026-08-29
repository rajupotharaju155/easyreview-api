import { Product } from '../enums/product.enum';
import {
  EASY_REVIEW_PLAN_FEATURES,
  EASY_MENU_PLAN_FEATURES,
  planFeature,
  type PlanFeature,
} from './plan-feature';

export const PLAN_CODES = {
  QUICK_TRIAL: 'quick_trial',
  STARTER: 'starter',
  GROWTH: 'growth',
  BUSINESS_PRO: 'business_pro',
  FREE_TRIAL: 'free_trial',
  EASY_MENU_STARTER: 'easy_menu_starter',
  EASY_MENU_GROWTH: 'easy_menu_growth',
  EASY_MENU_PRO: 'easy_menu_pro',
} as const;

export type PlanSeed = {
  code: string;
  name: string;
  product: Product;
  amount: number;
  currency: string;
  durationDays: number;
  isActive: boolean;
  sortOrder: number;
  features: PlanFeature[];
};

const STARTER_FEATURES: PlanFeature[] = [
  ...EASY_REVIEW_PLAN_FEATURES,
  planFeature('multi_language_ai', 'Multi-language AI drafts', true),
  planFeature('qr_standee', '1 QR Standee', true),
  planFeature('nfc_card', 'NFC card', false),
];

export const DEFAULT_PLANS: PlanSeed[] = [
  {
    code: PLAN_CODES.QUICK_TRIAL,
    name: 'Quick Trial',
    product: Product.EASY_REVIEW,
    amount: 7,
    currency: 'INR',
    durationDays: 7,
    isActive: true,
    sortOrder: 1,
    features: [
      ...EASY_REVIEW_PLAN_FEATURES,
      planFeature('multi_language_ai', 'Multi-language AI drafts', false),
      planFeature('qr_standee', 'QR Standee', false),
      planFeature('nfc_card', 'NFC card', false),
    ],
  },
  {
    code: PLAN_CODES.STARTER,
    name: 'Starter',
    product: Product.EASY_REVIEW,
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
    product: Product.EASY_REVIEW,
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
    product: Product.EASY_REVIEW,
    amount: 1499,
    currency: 'INR',
    durationDays: 365,
    isActive: true,
    sortOrder: 4,
    features: [
      ...EASY_REVIEW_PLAN_FEATURES,
      planFeature('multi_language_ai', 'Multi-language AI drafts', true),
      planFeature('qr_standee', '1 QR Standee', true),
      planFeature('nfc_card', '1 NFC card', true),
      planFeature('priority_whatsapp', 'Priority WhatsApp support', true),
    ],
  },
  {
    code: PLAN_CODES.FREE_TRIAL,
    name: '14-day free trial',
    product: Product.EASY_REVIEW,
    amount: 0,
    currency: 'INR',
    durationDays: 14,
    isActive: true,
    sortOrder: 99,
    features: STARTER_FEATURES,
  },
  {
    code: PLAN_CODES.EASY_MENU_STARTER,
    name: 'EasyMenu Starter',
    product: Product.EASY_MENU,
    amount: 399,
    currency: 'INR',
    durationDays: 30,
    isActive: true,
    sortOrder: 11,
    features: EASY_MENU_PLAN_FEATURES,
  },
  {
    code: PLAN_CODES.EASY_MENU_GROWTH,
    name: 'EasyMenu Growth',
    product: Product.EASY_MENU,
    amount: 1999,
    currency: 'INR',
    durationDays: 180,
    isActive: true,
    sortOrder: 12,
    features: EASY_MENU_PLAN_FEATURES,
  },
  {
    code: PLAN_CODES.EASY_MENU_PRO,
    name: 'EasyMenu Pro',
    product: Product.EASY_MENU,
    amount: 3499,
    currency: 'INR',
    durationDays: 365,
    isActive: true,
    sortOrder: 13,
    features: EASY_MENU_PLAN_FEATURES,
  },
];
