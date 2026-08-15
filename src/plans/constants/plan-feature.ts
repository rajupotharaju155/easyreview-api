export type PlanFeature = {
  id: string;
  name: string;
  isIncluded: boolean;
};

export function planFeature(
  id: string,
  name: string,
  isIncluded: boolean,
): PlanFeature {
  return { id, name, isIncluded };
}

export const CORE_PLAN_FEATURES: PlanFeature[] = [
  planFeature('admin_panel', 'Admin Panel Access', true),
  planFeature('unlimited_qr_scans', 'Unlimited QR scans', true),
  planFeature('custom_review_link', 'Custom Review Link', true),
  planFeature('analytics', 'Real-time scan & review analytics', true),
  planFeature('keyword_targeting', 'Keyword targeting', true),
  planFeature('private_feedback', 'Private feedback gate', true),
];
