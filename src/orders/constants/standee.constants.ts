import { DesignVariant } from '../enums/design-variant.enum';

export const STANDEE_DESIGNS: Record<
  DesignVariant,
  { name: string; description: string; priceInr: number }
> = {
  [DesignVariant.CLASSIC_STANDY]: {
    name: 'Classic Review Standy',
    description: 'Acrylic L shape review standee',
    priceInr: 199,
  },
};
