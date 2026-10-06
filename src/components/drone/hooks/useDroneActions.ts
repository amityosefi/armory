import { useMutation, useQueryClient } from '@tanstack/react-query';
import type { QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import type { DroneType, ItemMap } from '../types';
import { DRONE_KEY_ROOT } from './useDroneData';

interface Actor {
  actor_id: string;
  actor_name: string;
}

/**
 * Every drone write moves גדוד stock, which the sheet, גדוד and סיכום tabs all
 * read, so each mutation invalidates the whole drone subtree rather than
 * trying to track which slices moved.
 */
function invalidateDrone(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: [DRONE_KEY_ROOT] });
}

/** Add (sign = +1) or remove (sign = -1) a kit's worth of items in גדוד. */
export function useStockChange() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { drone_type: DroneType; items: ItemMap; sign: 1 | -1; note?: string }
    ) => {
      const { error } = await supabase.rpc('drone_stock_change', {
        p_drone_type: params.drone_type,
        p_items: params.items,
        p_sign: params.sign,
        p_actor_id: params.actor_id,
        p_actor_name: params.actor_name,
        p_note: params.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateDrone(qc),
  });
}

export function useSignDrone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & {
        drone_type: DroneType;
        serial: string;
        sheet_range: string;
        holder_id: string;
        holder_name: string;
        items: ItemMap;
      }
    ) => {
      const { data, error } = await supabase.rpc('sign_drone', {
        p_drone_type: params.drone_type,
        p_serial: params.serial,
        p_sheet_range: params.sheet_range,
        p_holder_id: params.holder_id,
        p_holder_name: params.holder_name,
        p_items: params.items,
        p_actor_id: params.actor_id,
        p_actor_name: params.actor_name,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => invalidateDrone(qc),
  });
}

export function useDeleteDrone() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Actor & { drone_id: number; note?: string }) => {
      const { error } = await supabase.rpc('delete_drone', {
        p_drone_id: params.drone_id,
        p_actor_id: params.actor_id,
        p_actor_name: params.actor_name,
        p_note: params.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateDrone(qc),
  });
}

export function useSetItemQty() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { drone_id: number; item_name: string; new_qty: number }
    ) => {
      const { error } = await supabase.rpc('set_drone_item_qty', {
        p_drone_id: params.drone_id,
        p_item_name: params.item_name,
        p_new_qty: params.new_qty,
        p_actor_id: params.actor_id,
        p_actor_name: params.actor_name,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateDrone(qc),
  });
}

export function useChangeHolder() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { drone_id: number; holder_id: string; holder_name: string }
    ) => {
      const { error } = await supabase.rpc('change_drone_holder', {
        p_drone_id: params.drone_id,
        p_holder_id: params.holder_id,
        p_holder_name: params.holder_name,
        p_actor_id: params.actor_id,
        p_actor_name: params.actor_name,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateDrone(qc),
  });
}
