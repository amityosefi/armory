import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useApproveRequest, useRejectRequest } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { ChangeQuantityModal } from '../forms/ChangeQuantityModal';
import { GroupLocation, InventoryRow, RequestRow } from '../types';

export type RequestBatch = {
  key: string;
  requests: RequestRow[];
  requester_name: string;
  requester_location: GroupLocation;
  created_at: string;
};

function formatDateTime(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  const yyyy = d.getFullYear();
  return `${hh}:${mm} ${dd}-${mo}-${yyyy}`;
}

interface ItemRowProps {
  request: RequestRow;
  inventory: InventoryRow[];
  pending: boolean;
  error?: string;
  onSatzal: (r: RequestRow) => void;
  onChangeQty: (r: RequestRow) => void;
  onReject: (r: RequestRow) => void;
}

function ItemRow({ request: r, inventory, pending, error, onSatzal, onChangeQty, onReject }: ItemRowProps) {
  const decided = r.status !== 'ממתין';
  const bgClass = decided ? 'bg-red-100 border-red-200' : 'bg-white border-gray-200';

  return (
    <div className={`rounded-md border p-2 ${bgClass}`} onClick={(e) => e.stopPropagation()}>
      <div className="flex justify-between items-center gap-2 flex-wrap">
        <div className="text-sm flex gap-2 items-center">
          <span className="text-gray-600">{r.item_name}</span>
          <span className="font-medium">× {r.requested_quantity}</span>
          {decided && (
            <>
              <span className={`text-xs px-1 rounded ${r.status === 'אושר' ? 'bg-green-100 text-green-700' : 'bg-red-200 text-red-700'}`}>
                {r.status}
              </span>
              {r.approver_name && (
                <span className="text-xs text-gray-500">
                  ע"י {r.approver_name}
                  {r.handled_at && ` · ${formatDateTime(r.handled_at)}`}
                </span>
              )}
            </>
          )}
        </div>

        {!decided && (
          <div className="flex gap-1.5 flex-wrap">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              disabled={pending}
              onClick={() => onSatzal(r)}
            >
              סמן שצל
            </Button>
            <Button size="sm" variant="outline" disabled={pending} onClick={() => onChangeQty(r)}>
              שנה כמות
            </Button>
            <Button size="sm" variant="destructive" disabled={pending} onClick={() => onReject(r)}>
              סרב
            </Button>
          </div>
        )}
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

interface CardProps {
  batch: RequestBatch;
  inventory: InventoryRow[];
  pendingId: number | null;
  errorById: Record<number, string>;
  onSatzal: (r: RequestRow) => void;
  onChangeQty: (r: RequestRow) => void;
  onReject: (r: RequestRow) => void;
}

function BatchCard({ batch, inventory, pendingId, errorById, onSatzal, onChangeQty, onReject }: CardProps) {
  return (
    <div className="border rounded-lg p-3 bg-gray-50 border-gray-200">
      {/* Header */}
      <div className="flex justify-between items-start gap-2 mb-2">
        <div>
          <span className="font-semibold text-sm">{batch.requester_name}</span>
          <span className="text-gray-400 mx-2">·</span>
          <span className="text-xs text-gray-500 tabular-nums">{formatDateTime(batch.created_at)}</span>
        </div>
      </div>

      {/* Items list — each item is its own decision unit */}
      <div className="space-y-1.5">
        {batch.requests.map((r) => (
          <ItemRow
            key={r.id}
            request={r}
            inventory={inventory}
            pending={pendingId === r.id}
            error={errorById[r.id]}
            onSatzal={onSatzal}
            onChangeQty={onChangeQty}
            onReject={onReject}
          />
        ))}
      </div>
    </div>
  );
}

interface Props {
  requests: RequestRow[];
  inventory: InventoryRow[];
  onSuccess?: (message: string) => void;
}

export function RequestBatchCards({ requests, inventory, onSuccess }: Props) {
  const { email, name, signature } = useUserRole();
  const approve = useApproveRequest();
  const reject = useRejectRequest();

  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});
  const [qtyChangeRequest, setQtyChangeRequest] = useState<RequestRow | null>(null);

  const batches = useMemo((): RequestBatch[] => {
    const batchMap = new Map<string, RequestRow[]>();
    for (const r of requests) {
      const key = r.batch_id ?? `solo-${r.id}`;
      if (!batchMap.has(key)) batchMap.set(key, []);
      batchMap.get(key)!.push(r);
    }
    return Array.from(batchMap.values())
      .map((reqs) => ({
        key: reqs[0].batch_id ?? `solo-${reqs[0].id}`,
        requests: reqs,
        requester_name: reqs[0].requester_name,
        requester_location: reqs[0].requester_location,
        created_at: reqs.reduce((min, r) => (r.created_at < min ? r.created_at : min), reqs[0].created_at),
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests]);

  const handleSatzal = async (r: RequestRow) => {
    setErrorById((prev) => ({ ...prev, [r.id]: '' }));
    const available = inventory.find((i) => i.item_name === r.item_name)?.quantity ?? 0;
    if (r.requested_quantity > available) {
      setErrorById((prev) => ({ ...prev, [r.id]: `הכמות חורגת מהמלאי (${available})` }));
      return;
    }
    setPendingId(r.id);
    try {
      await approve.mutateAsync({
        actor_email: email,
        actor_name: name,
        actor_signature: signature,
        request_id: r.id,
        approved_item_name: r.item_name,
        approved_quantity: r.requested_quantity,
        location: r.requester_location,
      });
      onSuccess?.(`בקשת ${r.item_name} (${r.requested_quantity}) מ${r.requester_name} סומנה כשצל ואושרה`);
    } catch (e) {
      setErrorById((prev) => ({ ...prev, [r.id]: (e as Error).message }));
    } finally {
      setPendingId(null);
    }
  };

  const handleReject = async (r: RequestRow) => {
    setErrorById((prev) => ({ ...prev, [r.id]: '' }));
    setPendingId(r.id);
    try {
      await reject.mutateAsync({
        actor_email: email,
        actor_name: name,
        actor_signature: signature,
        request_id: r.id,
      });
      onSuccess?.(`בקשת ${r.item_name} מ${r.requester_name} נדחתה`);
    } catch (e) {
      setErrorById((prev) => ({ ...prev, [r.id]: (e as Error).message }));
    } finally {
      setPendingId(null);
    }
  };

  if (batches.length === 0) {
    return <p className="text-sm text-gray-400 py-2">אין בקשות</p>;
  }

  return (
    <div className="space-y-2">
      {batches.map((batch) => (
        <BatchCard
          key={batch.key}
          batch={batch}
          inventory={inventory}
          pendingId={pendingId}
          errorById={errorById}
          onSatzal={handleSatzal}
          onChangeQty={setQtyChangeRequest}
          onReject={handleReject}
        />
      ))}

      <ChangeQuantityModal
        request={qtyChangeRequest}
        inventory={inventory}
        onClose={() => setQtyChangeRequest(null)}
        onSuccess={onSuccess}
      />
    </div>
  );
}

export default RequestBatchCards;
