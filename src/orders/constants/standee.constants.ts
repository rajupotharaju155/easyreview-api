import { DesignVariant } from '../enums/design-variant.enum';

export const STANDEE_PRICE_INR = 499;

export const STANDEE_DESIGNS: Record<
  DesignVariant,
  { name: string; description: string }
> = {
  [DesignVariant.CLASSIC]: {
    name: 'Classic',
    description: 'Clean white card with purple accents',
  },
  [DesignVariant.BANNER]: {
    name: 'Banner',
    description: 'Bold purple header with light body',
  },
  [DesignVariant.MIDNIGHT]: {
    name: 'Midnight',
    description: 'Deep purple standee for high contrast',
  },
  [DesignVariant.FRAME]: {
    name: 'Frame',
    description: 'Soft lavender field with purple border',
  },
};
