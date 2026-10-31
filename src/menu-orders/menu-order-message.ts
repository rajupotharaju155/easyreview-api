import { MenuOrderType } from './enums/menu-order-type.enum';

const MENU_ORDER_TYPE_LABELS: Record<MenuOrderType, string> = {
  [MenuOrderType.DINE_IN]: 'Dine-in',
  [MenuOrderType.TAKEAWAY]: 'Takeaway',
  [MenuOrderType.ROOM_SERVICE]: 'Room service',
};

const SPOT_LABELS: Partial<Record<MenuOrderType, string>> = {
  [MenuOrderType.DINE_IN]: 'Table',
  [MenuOrderType.ROOM_SERVICE]: 'Room',
};

type MenuOrderMessageInput = {
  orderNumber: number;
  orderType: MenuOrderType;
  spotNumber: string | null;
  customerName: string;
  customerCountryCode: string;
  customerPhone: string;
  note: string | null;
  totalAmount: number;
  currency: string;
  items: Array<{
    itemName: string;
    variantLabel: string | null;
    comboItemNames: string[] | null;
    quantity: number;
    lineTotal: number;
  }>;
};

function formatMoney(amount: number, currency: string): string {
  try {
    return new Intl.NumberFormat('en', {
      style: 'currency',
      currency,
      currencyDisplay: 'narrowSymbol',
    }).format(amount);
  } catch {
    return `${currency} ${amount.toFixed(2)}`;
  }
}

/** Plain-text order summary the guest sends to the business on WhatsApp. */
export function buildMenuOrderMessage(order: MenuOrderMessageInput): string {
  const spotLabel = SPOT_LABELS[order.orderType];
  const header = [
    `New order #${order.orderNumber}`,
    MENU_ORDER_TYPE_LABELS[order.orderType],
    spotLabel && order.spotNumber ? `${spotLabel} ${order.spotNumber}` : null,
  ]
    .filter(Boolean)
    .join(' · ');

  const lines = order.items.map((item) => {
    const name = item.variantLabel
      ? `${item.itemName} (${item.variantLabel})`
      : item.itemName;
    const row = `${item.quantity} x ${name} - ${formatMoney(item.lineTotal, order.currency)}`;
    return item.comboItemNames?.length
      ? `${row}\n   ${item.comboItemNames.join(', ')}`
      : row;
  });

  return [
    header,
    '',
    `Name: ${order.customerName}`,
    `Phone: ${order.customerCountryCode} ${order.customerPhone}`,
    '',
    ...lines,
    '',
    `Total: ${formatMoney(order.totalAmount, order.currency)}`,
    order.note ? `Note: ${order.note}` : null,
  ]
    .filter((line) => line !== null)
    .join('\n');
}

/**
 * wa.me link that opens a chat with the business, or null when the number
 * has no country code (wa.me needs the full international number).
 */
export function buildWhatsappUrl(
  businessNumber: string | null,
  message: string,
): string | null {
  const trimmed = businessNumber?.trim();
  if (!trimmed?.startsWith('+')) return null;
  const digits = trimmed.replace(/\D/g, '');
  if (digits.length < 8) return null;
  return `https://wa.me/${digits}?text=${encodeURIComponent(message)}`;
}
