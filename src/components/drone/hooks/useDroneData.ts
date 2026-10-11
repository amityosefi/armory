import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { GadudTabData, SheetTabData, SumTabData, DroneDocumentRow } from '../types';

const MIGRATION_FILE = 'supabase/migrations/2026-10-06-drone.sql';

/**
 * PostgREST answers a call to a function it cannot see with PGRST202. That
 * always means the drone migration has not been applied to this project, or
 * it has but PostgREST is still serving a stale schema cache - neither of
 * which the raw message explains.
 */
function rpcError(error: { code?: string; message: string }): Error {
  if (error.code === 'PGRST202') {
    return new Error(
      `פונקציות הרחפנים לא קיימות בבסיס הנתונים. יש להריץ את הקובץ ${MIGRATION_FILE} ` +
      "ב-SQL Editor של Supabase (ואם הוא כבר הורץ - להריץ NOTIFY pgrst, 'reload schema';)."
    );
  }
  return new Error(error.message);
}

const EMPTY_SHEET: SheetTabData = { drones: [], stock: [], people: [] };
const EMPTY_GADUD: GadudTabData = { stock: [] };
const EMPTY_SUM: SumTabData = { totals: [], drones: [] };

export const DRONE_KEY_ROOT = 'drone' as const;

export function sheetTabKey(sheetRange: string) {
  return [DRONE_KEY_ROOT, 'sheet-tab', sheetRange] as const;
}
export function gadudTabKey() {
  return [DRONE_KEY_ROOT, 'gadud-tab'] as const;
}
export function sumTabKey() {
  return [DRONE_KEY_ROOT, 'sum-tab'] as const;
}
export function documentKey() {
  return [DRONE_KEY_ROOT, 'document'] as const;
}

export function useSheetTabData(sheetRange: string, enabled = true) {
  return useQuery({
    queryKey: sheetTabKey(sheetRange),
    enabled: enabled && !!sheetRange,
    queryFn: async (): Promise<SheetTabData> => {
      const { data, error } = await supabase.rpc('get_drone_sheet_data', {
        p_sheet_range: sheetRange,
      });
      if (error) throw rpcError(error);
      return (data as SheetTabData) ?? EMPTY_SHEET;
    },
  });
}

export function useGadudTabData(enabled = true) {
  return useQuery({
    queryKey: gadudTabKey(),
    enabled,
    queryFn: async (): Promise<GadudTabData> => {
      const { data, error } = await supabase.rpc('get_drone_gadud_data');
      if (error) throw rpcError(error);
      return (data as GadudTabData) ?? EMPTY_GADUD;
    },
  });
}

export function useSumTabData(enabled = true) {
  return useQuery({
    queryKey: sumTabKey(),
    enabled,
    queryFn: async (): Promise<SumTabData> => {
      const { data, error } = await supabase.rpc('get_drone_sum_data');
      if (error) throw rpcError(error);
      return (data as SumTabData) ?? EMPTY_SUM;
    },
  });
}

export function useDroneDocument(limit = 300, enabled = true) {
  return useQuery({
    queryKey: documentKey(),
    enabled,
    queryFn: async (): Promise<DroneDocumentRow[]> => {
      const { data, error } = await supabase.rpc('get_drone_document', { p_limit: limit });
      if (error) throw rpcError(error);
      return (data as DroneDocumentRow[]) ?? [];
    },
  });
}
