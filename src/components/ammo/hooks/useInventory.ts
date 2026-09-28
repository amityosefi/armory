import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { InventoryRow, Location } from '../types';

export function inventoryKey(location: Location) {
  return ['ammo-v2', 'inventory', location] as const;
}

// Used by forms (SignToGroup/StockRemove/etc.) on open, to fetch a single-location list.
// The main tabs get inventory via their bundle RPC.
export function useInventory(location: Location, enabled: boolean = true) {
  return useQuery({
    queryKey: inventoryKey(location),
    enabled,
    queryFn: async (): Promise<InventoryRow[]> => {
      const { data, error } = await supabase
        .from('inventory')
        .select('id, item_name, is_explosion, location, quantity, updated_at')
        .eq('location', location)
        .gt('quantity', 0)
        .order('item_name');
      if (error) throw error;
      return (data ?? []) as InventoryRow[];
    },
  });
}
