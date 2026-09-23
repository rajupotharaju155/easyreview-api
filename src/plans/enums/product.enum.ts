export enum Product {
  EASY_REVIEW = 'easy_review',
  EASY_MENU = 'easy_menu',
  EASY_STORY = 'easy_story',
  EASY_PROFILE = 'easy_profile',
}

export const PRODUCT_DISPLAY_NAME: Record<Product, string> = {
  [Product.EASY_REVIEW]: 'EasyReview',
  [Product.EASY_MENU]: 'EasyMenu',
  [Product.EASY_STORY]: 'EasyStory',
  [Product.EASY_PROFILE]: 'EasyProfile',
};

/** What a subscription for this product is attached to. */
export function productSubject(
  product: Product | string | null | undefined,
): 'location' | 'profile' {
  return product === Product.EASY_PROFILE ? 'profile' : 'location';
}

export function productDisplayName(
  product: Product | string | null | undefined,
): string {
  if (product && product in PRODUCT_DISPLAY_NAME) {
    return PRODUCT_DISPLAY_NAME[product as Product];
  }
  return PRODUCT_DISPLAY_NAME[Product.EASY_REVIEW];
}
