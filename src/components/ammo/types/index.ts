export const GROUP_LOCATIONS = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם'] as const;
export type GroupLocation = typeof GROUP_LOCATIONS[number];

export const GADUD_LOCATION = 'גדוד' as const;
export const STOCK_LOCATION = 'מחסן' as const;
export type Location = GroupLocation | typeof STOCK_LOCATION | typeof GADUD_LOCATION;

export const REQUEST_STATUSES = ['ממתין', 'אושר', 'נדחה'] as const;
export type RequestStatus = typeof REQUEST_STATUSES[number];

export const READ_VALUES = ['לא', 'כן'] as const;
export type ReadValue = typeof READ_VALUES[number];

export const צורך_VALUES = ['ניפוק', 'בלאי', 'זיכוי', 'שצל'] as const;
export type צורך = typeof צורך_VALUES[number];

export const ACTION_TYPES = [
  'stock_add',
  'stock_remove',
  'sign_to_group',
  'decrease_from_group',
  'request_approved',
  'request_rejected',
  'transfer',
] as const;
export type ActionType = typeof ACTION_TYPES[number];

export const ACTION_LABEL: Record<ActionType, string> = {
  stock_add: 'הוספה',
  stock_remove: 'הוצאה',
  sign_to_group: 'החתמה/ זיכוי לפלוגה',
  decrease_from_group: 'שצל',
  request_approved: 'אישור בקשה',
  request_rejected: 'דחיית בקשה',
  transfer: 'זיכוי',
};

export interface InventoryRow {
  id: number;
  item_name: string;
  is_explosion: boolean;
  location: Location;
  quantity: number;
  updated_at?: string;
}

export interface CatalogItem {
  item_name: string;
  is_explosion: boolean;
}

export interface RequestRow {
  id: number;
  requester_email: string;
  requester_name: string;
  requester_location: GroupLocation;
  requester_signature: string;
  item_name: string;
  is_explosion: boolean;
  requested_quantity: number;
  approved_item_name: string | null;
  approved_quantity: number | null;
  צורך: צורך | null;
  status: RequestStatus;
  נקרא: ReadValue;
  handled_by: string | null;
  handled_at: string | null;
  approver_name: string | null;
  approver_signature: string | null;
  notes: string | null;
  batch_id: string | null;
  requester_id: string | null;
  created_at: string;
}

export interface ChangeLogRow {
  id: number;
  action_type: ActionType;
  item_name: string;
  is_explosion: boolean;
  from_location: Location | null;
  to_location: Location | null;
  delta: number;
  quantity_after_from: number | null;
  quantity_after_to: number | null;
  actor_email: string;
  actor_name: string;
  actor_signature: string | null;
  related_request_id: number | null;
  note: string | null;
  created_at: string;
}

export interface GroupTabData {
  inventory: InventoryRow[];
  all_requests: RequestRow[];
  change_log: ChangeLogRow[];
}

export interface StockTabData {
  gadud_inventory: InventoryRow[];
  mahsan_inventory: InventoryRow[];
  catalog: CatalogItem[];
  change_log: ChangeLogRow[];
}

export interface UserTabData {
  inventory: InventoryRow[];
  my_requests: RequestRow[];
  change_log: ChangeLogRow[];
}

export type UserRole =
  | { kind: 'ammo' }
  | { kind: 'group'; location: GroupLocation }
  | { kind: 'none' };
