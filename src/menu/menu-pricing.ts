import { generateId } from '../common/utils/id';
import { MenuPriceType } from './enums/menu-price-type.enum';

export const MAX_PRICE_VARIANTS = 12;
export const MAX_VARIANT_NAME_LENGTH = 80;

export type MenuPriceVariant = {
  id: string;
  name: string;
  sortOrder: number;
};

export type MenuItemVariantPrice = {
  variantId: string;
  price: number;
};

export function coercePriceVariants(
  value: MenuPriceVariant[] | null | undefined,
): MenuPriceVariant[] {
  if (!Array.isArray(value)) return [];
  return [...value]
    .map((variant, index) => ({
      id: variant.id,
      name: variant.name,
      sortOrder:
        typeof variant.sortOrder === 'number' ? variant.sortOrder : index,
    }))
    .filter((variant) => Boolean(variant.id) && Boolean(variant.name))
    .sort((a, b) => a.sortOrder - b.sortOrder);
}

export function coerceVariantPrices(
  value: MenuItemVariantPrice[] | null | undefined,
): MenuItemVariantPrice[] {
  if (!Array.isArray(value)) return [];
  return value.filter(
    (row) =>
      Boolean(row?.variantId) &&
      row.price != null &&
      Number.isFinite(Number(row.price)),
  );
}

export function normalizePriceVariants(
  input: Array<{ id?: string; name: string }>,
): MenuPriceVariant[] {
  const seenIds = new Set<string>();
  const seenNames = new Set<string>();
  const variants: MenuPriceVariant[] = [];

  for (const row of input) {
    const name = row.name.trim();
    if (!name) continue;
    const key = name.toLowerCase();
    if (seenNames.has(key)) continue;
    seenNames.add(key);

    let id = row.id?.trim() || generateId();
    if (seenIds.has(id)) id = generateId();
    seenIds.add(id);

    variants.push({ id, name, sortOrder: variants.length });
    if (variants.length >= MAX_PRICE_VARIANTS) break;
  }

  return variants;
}

export function normalizeVariantPrices(
  input: Array<{ variantId: string; price: number }>,
  variants: MenuPriceVariant[],
): MenuItemVariantPrice[] {
  const allowed = new Set(variants.map((variant) => variant.id));
  const byVariant = new Map<string, number>();

  for (const row of input) {
    if (!allowed.has(row.variantId)) continue;
    const price = Number(row.price);
    if (!Number.isFinite(price) || price < 0) continue;
    byVariant.set(row.variantId, Math.round(price * 100) / 100);
  }

  return variants.flatMap((variant) => {
    const price = byVariant.get(variant.id);
    return price == null ? [] : [{ variantId: variant.id, price }];
  });
}

export function minVariantPrice(prices: MenuItemVariantPrice[]): number | null {
  if (prices.length === 0) return null;
  return prices.reduce(
    (min, row) => Math.min(min, Number(row.price)),
    Number(prices[0].price),
  );
}

export function remapVariantPrices(
  prices: MenuItemVariantPrice[],
  fromVariants: MenuPriceVariant[],
  toVariants: MenuPriceVariant[],
): MenuItemVariantPrice[] {
  if (toVariants.length === 0) return [];
  const fromById = new Map(
    fromVariants.map((variant) => [variant.id, variant]),
  );
  const toByName = new Map(
    toVariants.map((variant) => [variant.name.trim().toLowerCase(), variant]),
  );
  const next: MenuItemVariantPrice[] = [];
  const used = new Set<string>();

  for (const row of prices) {
    const from = fromById.get(row.variantId);
    const match =
      toVariants.find((variant) => variant.id === row.variantId) ??
      (from ? toByName.get(from.name.trim().toLowerCase()) : undefined);
    if (!match || used.has(match.id)) continue;
    used.add(match.id);
    next.push({ variantId: match.id, price: row.price });
  }

  return next;
}

export function dropRemovedVariantPrices(
  prices: MenuItemVariantPrice[],
  variants: MenuPriceVariant[],
): MenuItemVariantPrice[] {
  const allowed = new Set(variants.map((variant) => variant.id));
  return prices.filter((row) => allowed.has(row.variantId));
}

function roundMoney(value: number): number {
  return Math.round(value * 100) / 100;
}

/** Billed combo price: the override when set, else the sum of full prices. */
export function comboPricing(
  items: Array<{ fullPrice: number | null }>,
  priceOverride: number | null,
): {
  itemsSubtotal: number;
  priceOverride: number | null;
  price: number;
  savings: number;
} {
  const itemsSubtotal = roundMoney(
    items.reduce((sum, item) => sum + Number(item.fullPrice || 0), 0),
  );
  const override = priceOverride == null ? null : Number(priceOverride);
  const price = roundMoney(override ?? itemsSubtotal);
  const savings = roundMoney(Math.max(0, itemsSubtotal - price));
  return { itemsSubtotal, priceOverride: override, price, savings };
}

const HALF_PRICE_OPTION = 'half';
const FULL_PRICE_OPTION = 'full';

type OrderablePriceInput = {
  isNotAvailable: boolean;
  priceType: MenuPriceType;
  isMultiPriced: boolean;
  variantPrices: MenuItemVariantPrice[] | null;
  isHalfServed: boolean;
  halfPrice: number | null;
  fullPrice: number | null;
};

/**
 * Price a guest pays for one unit of an item, or null when it can't be
 * ordered. "Onwards" and free items have no exact price, so they're not
 * orderable. `priceOption` picks half/full or a price variant id.
 */
export function orderableItemPrice(
  item: OrderablePriceInput,
  variants: MenuPriceVariant[],
  priceOption: string | null | undefined,
): { unitPrice: number; variantLabel: string | null } | null {
  if (item.isNotAvailable) return null;

  if (item.isMultiPriced) {
    const row = coerceVariantPrices(item.variantPrices).find(
      (price) => price.variantId === priceOption,
    );
    const variant = variants.find((v) => v.id === priceOption);
    if (!row || !variant) return null;
    return { unitPrice: Number(row.price), variantLabel: variant.name };
  }

  if (item.priceType !== MenuPriceType.FIXED || item.fullPrice == null) {
    return null;
  }

  if (item.isHalfServed) {
    if (priceOption === HALF_PRICE_OPTION && item.halfPrice != null) {
      return { unitPrice: Number(item.halfPrice), variantLabel: 'Half' };
    }
    if (priceOption === FULL_PRICE_OPTION) {
      return { unitPrice: Number(item.fullPrice), variantLabel: 'Full' };
    }
    return null;
  }

  return { unitPrice: Number(item.fullPrice), variantLabel: null };
}
