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

export const EASY_REVIEW_PLAN_FEATURES: PlanFeature[] = [
  planFeature('admin_panel', 'Admin Panel Access', true),
  planFeature('unlimited_qr_scans', 'Unlimited QR scans', true),
  planFeature('custom_review_link', 'Custom Review Link', true),
  planFeature('analytics', 'Real-time scan & review analytics', true),
  planFeature('keyword_targeting', 'Keyword targeting', true),
  planFeature('private_feedback', 'Private feedback gate', true),
];

export const EASY_MENU_PLAN_FEATURES: PlanFeature[] = [
  planFeature('admin_panel', 'Admin Panel Access', true),
  planFeature('digital_menu', 'Digital menu page', true),
  planFeature('menu_categories', 'Categories and items', true),
  planFeature('menu_images', 'Item photos', true),
  planFeature('menu_qr', 'Menu QR code', true),
  planFeature('restaurant_or_salon', 'Restaurant or salon layout', true),
  planFeature('custom_menu_link', 'Custom Menu Link', true),
  planFeature('qr_standee', '3 QR standees', true),
  planFeature('real_time_updates', 'Real-time menu updates', true),
  planFeature('priority_whatsapp', 'Priority WhatsApp support', true),
];
