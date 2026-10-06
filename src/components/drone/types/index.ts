import evoDefaults from '@/assets/evo.json';
import avataDefaults from '@/assets/avata.json';
import evoImage from '@/assets/evo.png';
import avataImage from '@/assets/avata.png';

export const DRONE_TYPES = ['EVO', 'AVATA'] as const;
export type DroneType = typeof DRONE_TYPES[number];

export const GADUD_LOCATION = 'גדוד' as const;

export const DRONE_PERMISSION = 'רחפנים' as const;

/** Item name -> default quantity, read off the equipment images. */
export type ItemMap = Record<string, number>;

export const DRONE_DEFAULTS: Record<DroneType, ItemMap> = {
  EVO: evoDefaults as ItemMap,
  AVATA: avataDefaults as ItemMap,
};

export const DRONE_IMAGE: Record<DroneType, string> = {
  EVO: evoImage,
  AVATA: avataImage,
};

export const DRONE_LABEL: Record<DroneType, string> = {
  EVO: 'EVO',
  AVATA: 'AVATA',
};

/**
 * A row in the `drone` table. Two shapes share it:
 *  - stock:  location === 'גדוד', `items` is the per-item total on hand,
 *            serial / sheet_range / holder_name are null.
 *  - signed: location is a people.id as text, `items` is that drone's
 *            quantities, and the three fields above are filled in.
 */
export interface DroneRow {
  id: number;
  drone_type: DroneType;
  location: string;
  items: ItemMap;
  serial: string | null;
  sheet_range: string | null;
  holder_name: string | null;
  signed_by_id: string | null;
  signed_by_name: string | null;
  created_at: string;
  updated_at: string;
}

export const DRONE_ACTIONS = [
  'stock_add',
  'stock_remove',
  'drone_signed',
  'drone_deleted',
  'item_qty_changed',
  'holder_changed',
] as const;
export type DroneAction = typeof DRONE_ACTIONS[number];

export const DRONE_ACTION_LABEL: Record<DroneAction, string> = {
  stock_add: 'הוספת מלאי',
  stock_remove: 'הוצאת מלאי',
  drone_signed: 'החתמת רחפן',
  drone_deleted: 'מחיקת רחפן',
  item_qty_changed: 'שינוי כמות',
  holder_changed: 'העברת חתימה',
};

export interface DroneDocumentRow {
  id: number;
  action_type: DroneAction;
  drone_id: number | null;
  drone_type: DroneType;
  serial: string | null;
  sheet_range: string | null;
  item_name: string | null;
  delta: number | null;
  quantity_before: number | null;
  quantity_after: number | null;
  items: ItemMap | null;
  holder_id: string | null;
  holder_name: string | null;
  prev_holder_id: string | null;
  prev_holder_name: string | null;
  actor_id: string | null;
  actor_name: string | null;
  note: string | null;
  created_at: string;
}

export interface PersonOption {
  id: number;
  name: string;
}

export interface SheetTabData {
  drones: DroneRow[];
  stock: DroneRow[];
  people: PersonOption[];
}

export interface GadudTabData {
  stock: DroneRow[];
}

export interface SumTotalRow {
  drone_type: DroneType;
  item_name: string;
  signed: number;
  gadud: number;
  total: number;
}

export interface SumTabData {
  totals: SumTotalRow[];
  drones: DroneRow[];
}

/** The stock row for a model, or undefined when it is missing. */
export function stockFor(stock: DroneRow[], type: DroneType): DroneRow | undefined {
  return stock.find((r) => r.drone_type === type);
}

/**
 * Item names to render for a model: the defaults unioned with whatever the row
 * actually holds, so an item at 0 still shows an input and can be raised again.
 */
export function itemNamesFor(type: DroneType, ...maps: (ItemMap | null | undefined)[]): string[] {
  const names = new Set<string>(Object.keys(DRONE_DEFAULTS[type]));
  maps.forEach((m) => {
    if (m) Object.keys(m).forEach((k) => names.add(k));
  });
  return Array.from(names);
}
