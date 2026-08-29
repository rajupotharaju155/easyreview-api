export enum Product {
  EASY_REVIEW = 'easy_review',
  EASY_MENU = 'easy_menu',
}

export const PRODUCT_DISPLAY_NAME: Record<Product, string> = {
  [Product.EASY_REVIEW]: 'EasyReview',
  [Product.EASY_MENU]: 'EasyMenu',
};

export function productDisplayName(product: Product | string | null | undefined): string {
  if (product === Product.EASY_MENU) return PRODUCT_DISPLAY_NAME[Product.EASY_MENU];
  return PRODUCT_DISPLAY_NAME[Product.EASY_REVIEW];
}
