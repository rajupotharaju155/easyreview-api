export enum MenuOrderStatus {
  NEW = 'new',
  ACCEPTED = 'accepted',
  READY = 'ready',
  COMPLETED = 'completed',
  CANCELLED = 'cancelled',
}

const STATUS_FLOW: MenuOrderStatus[] = [
  MenuOrderStatus.NEW,
  MenuOrderStatus.ACCEPTED,
  MenuOrderStatus.READY,
  MenuOrderStatus.COMPLETED,
];

/**
 * Orders only move forward (steps may be skipped, e.g. new → completed) and
 * can be cancelled until completed. Completed and cancelled are final.
 */
export function canMoveMenuOrderStatus(
  from: MenuOrderStatus,
  to: MenuOrderStatus,
): boolean {
  if (from === MenuOrderStatus.CANCELLED) return false;
  if (from === MenuOrderStatus.COMPLETED) return false;
  if (to === MenuOrderStatus.CANCELLED) return true;
  return STATUS_FLOW.indexOf(to) > STATUS_FLOW.indexOf(from);
}
