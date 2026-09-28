import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import {
  GroupLocation,
  GroupTabData,
  StockTabData,
  UserTabData,
} from '../types';

const EMPTY_GROUP: GroupTabData = {
  inventory: [],
  all_requests: [],
  change_log: [],
};
const EMPTY_STOCK: StockTabData = { gadud_inventory: [], mahsan_inventory: [], catalog: [], change_log: [] };
const EMPTY_USER: UserTabData = { inventory: [], my_requests: [], change_log: [] };

export function groupTabKey(location: GroupLocation) {
  return ['ammo-v2', 'group-tab', location] as const;
}
export function stockTabKey() {
  return ['ammo-v2', 'stock-tab'] as const;
}
export function userTabKey(email: string, location: GroupLocation) {
  return ['ammo-v2', 'user-tab', email, location] as const;
}

export function useGroupTabData(location: GroupLocation) {
  return useQuery({
    queryKey: groupTabKey(location),
    queryFn: async (): Promise<GroupTabData> => {
      const { data, error } = await supabase.rpc('get_group_tab_data', {
        p_location: location,
      });
      if (error) throw error;
      return (data as GroupTabData) ?? EMPTY_GROUP;
    },
  });
}

export function useStockTabData() {
  return useQuery({
    queryKey: stockTabKey(),
    queryFn: async (): Promise<StockTabData> => {
      const { data, error } = await supabase.rpc('get_stock_tab_data');
      if (error) throw error;
      return (data as StockTabData) ?? EMPTY_STOCK;
    },
  });
}

export function useUserTabData(email: string, location: GroupLocation) {
  return useQuery({
    queryKey: userTabKey(email, location),
    enabled: !!email,
    queryFn: async (): Promise<UserTabData> => {
      const { data, error } = await supabase.rpc('get_user_tab_data', {
        p_email: email,
        p_location: location,
      });
      if (error) throw error;
      return (data as UserTabData) ?? EMPTY_USER;
    },
  });
}
