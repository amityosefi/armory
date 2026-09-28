import { useMutation, useQueryClient, QueryClient } from '@tanstack/react-query';
import { supabase } from '@/lib/supabaseClient';
import { GROUP_LOCATIONS, GroupLocation, Location, GADUD_LOCATION, STOCK_LOCATION } from '../types';
import { inventoryKey } from './useInventory';

function isGroupLocation(location: Location): location is GroupLocation {
  return (GROUP_LOCATIONS as readonly string[]).includes(location);
}

type StockLocation = typeof GADUD_LOCATION | typeof STOCK_LOCATION;

interface Actor {
  actor_email: string;
  actor_name: string;
  actor_signature?: string | null;
}

function invalidateEverything(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['ammo-v2'] });
}

function invalidateGroup(qc: QueryClient, location: GroupLocation) {
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'group-tab', location] });
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'user-tab'] });
  qc.invalidateQueries({ queryKey: inventoryKey(location) });
}

function invalidateStock(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'stock-tab'] });
  qc.invalidateQueries({ queryKey: inventoryKey('מחסן') });
  qc.invalidateQueries({ queryKey: inventoryKey('גדוד') });
}

function invalidateRequests(qc: QueryClient) {
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'today-requests'] });
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'group-tab'] });
  qc.invalidateQueries({ queryKey: ['ammo-v2', 'user-tab'] });
}

export function useStockAdd() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { item_name: string; is_explosion: boolean; qty: number; location?: StockLocation }
    ) => {
      const { error } = await supabase.rpc('stock_add', {
        p_item_name: params.item_name,
        p_is_explosion: params.is_explosion,
        p_qty: params.qty,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
        p_location: params.location ?? 'מחסן',
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStock(qc),
  });
}

export function useStockRemove() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { item_name: string; qty: number; note?: string; location?: StockLocation }
    ) => {
      const { error } = await supabase.rpc('stock_remove', {
        p_item_name: params.item_name,
        p_qty: params.qty,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
        p_note: params.note ?? null,
        p_location: params.location ?? 'מחסן',
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateStock(qc),
  });
}

export function useTransferInventory() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & {
        item_name: string;
        qty: number;
        from_location: Location;
        to_location: Location;
      }
    ) => {
      const { error } = await supabase.rpc('transfer_inventory', {
        p_item_name: params.item_name,
        p_qty: params.qty,
        p_from_location: params.from_location,
        p_to_location: params.to_location,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidateStock(qc);
      if (isGroupLocation(variables.from_location)) invalidateGroup(qc, variables.from_location);
      if (isGroupLocation(variables.to_location)) invalidateGroup(qc, variables.to_location);
    },
  });
}

export function useSignToGroup() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { item_name: string; location: GroupLocation; qty: number }
    ) => {
      const { error } = await supabase.rpc('sign_to_group', {
        p_item_name: params.item_name,
        p_location: params.location,
        p_qty: params.qty,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidateStock(qc);
      invalidateGroup(qc, variables.location);
    },
  });
}

export function useDirectDecrease() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & { item_name: string; location: GroupLocation; qty: number; note?: string }
    ) => {
      const { error } = await supabase.rpc('decrease_from_group', {
        p_item_name: params.item_name,
        p_location: params.location,
        p_qty: params.qty,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
        p_note: params.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => invalidateGroup(qc, variables.location),
  });
}

export function useApproveRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (
      params: Actor & {
        request_id: number;
        approved_item_name: string;
        approved_quantity: number;
        location: GroupLocation;
      }
    ) => {
      const { error } = await supabase.rpc('approve_request', {
        p_request_id: params.request_id,
        p_approved_item_name: params.approved_item_name,
        p_approved_quantity: params.approved_quantity,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
      });
      if (error) throw error;
    },
    onSuccess: (_data, variables) => {
      invalidateRequests(qc);
      invalidateGroup(qc, variables.location);
    },
  });
}

export function useRejectRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: Actor & { request_id: number; note?: string }) => {
      const { error } = await supabase.rpc('reject_request', {
        p_request_id: params.request_id,
        p_actor_email: params.actor_email,
        p_actor_name: params.actor_name,
        p_actor_signature: params.actor_signature ?? null,
        p_note: params.note ?? null,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useCancelRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: { request_id: number; requester_email: string }) => {
      const { error } = await supabase.rpc('cancel_request', {
        p_request_id: params.request_id,
        p_requester_email: params.requester_email,
      });
      if (error) throw error;
    },
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useMarkRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request_id: number) => {
      const { error } = await supabase.rpc('mark_read', { p_request_id: request_id });
      if (error) throw error;
    },
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useMarkBatchRead() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (request_ids: number[]) => {
      const { error } = await supabase.rpc('mark_batch_read', { p_request_ids: request_ids });
      if (error) throw error;
    },
    onSuccess: () => invalidateRequests(qc),
  });
}

export function useCreateRequest() {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (params: {
      requester_email: string;
      requester_name: string;
      requester_location: GroupLocation;
      requester_signature: string;
      item_name: string;
      requested_quantity: number;
      notes?: string;
      batch_id?: string;
      requester_id?: string;
    }) => {
      const { data, error } = await supabase.rpc('create_request', {
        p_requester_email: params.requester_email,
        p_requester_name: params.requester_name,
        p_requester_location: params.requester_location,
        p_requester_signature: params.requester_signature,
        p_item_name: params.item_name,
        p_requested_quantity: params.requested_quantity,
        p_notes: params.notes ?? null,
        p_batch_id: params.batch_id ?? null,
        p_requester_id: params.requester_id ?? null,
      });
      if (error) throw error;
      return data as number;
    },
    onSuccess: () => invalidateRequests(qc),
  });
}

export { invalidateEverything };
