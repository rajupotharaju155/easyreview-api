export enum MenuOrderType {
  DINE_IN = 'dine_in',
  TAKEAWAY = 'takeaway',
  ROOM_SERVICE = 'room_service',
}

export const DEFAULT_MENU_ORDER_TYPES: MenuOrderType[] = [
  MenuOrderType.DINE_IN,
  MenuOrderType.TAKEAWAY,
];

/** Order types where the guest gives a table or room number. */
export const SPOT_ORDER_TYPES: MenuOrderType[] = [
  MenuOrderType.DINE_IN,
  MenuOrderType.ROOM_SERVICE,
];
