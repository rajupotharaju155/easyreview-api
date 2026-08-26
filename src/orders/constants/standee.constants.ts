import { DesignVariant } from '../enums/design-variant.enum';

export const STANDEE_DESIGNS: Record<
  DesignVariant,
  { name: string; description: string; priceInr: number }
> = {
  [DesignVariant.CLASSIC_STANDY]: {
    name: 'Classic Review Standy',
    description: 'Clean purple review standee',
    priceInr: 199,
  },
  [DesignVariant.PLAYFUL_STANDY]: {
    name: 'Playful Review Standy',
    description: 'Colorful handwritten review standee',
    priceInr: 199,
  },
  [DesignVariant.DINING_STANDY]: {
    name: 'Dining Review Standy',
    description: 'Dark dining review standee',
    priceInr: 199,
  },
  [DesignVariant.PASTEL_STANDY]: {
    name: 'Pastel Review Standy',
    description: 'Soft pastel review standee',
    priceInr: 199,
  },
};
