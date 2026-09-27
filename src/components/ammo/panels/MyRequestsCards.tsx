import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { useCancelRequest } from '../hooks/useInventoryActions';
import { RequestRow } from '../types';

interface Props {
  requests: RequestRow[];
  email: string;
  onSuccess?: (message: string) => void;
}

type Batch = {
  key: string;
  requests: RequestRow[];
  created_at: string;
  requester_name: string;
};

function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString('he-IL');
}

const STATUS_BADGE: Record<RequestRow['status'], string> = {
  ממתין: 'bg-yellow-100 text-yellow-700',
  אושר: 'bg-green-100 text-green-700',
  נדחה: 'bg-red-100 text-red-700',
};

interface ItemProps {
  request: RequestRow;
  email: string;
  pending: boolean;
  error?: string;
  onCancel: (r: RequestRow) => void;
}

function RequestItem({ request: r, email, pending, error, onCancel }: ItemProps) {
  const decided = r.status !== 'ממתין';
  const bgClass = decided ? 'bg-red-100 border-red-200' : 'bg-white border-gray-200';

  return (
    <div className={`rounded-md border p-4 ${bgClass}`}>
      <div className="flex justify-between items-start gap-2 flex-wrap">
        <div className="grid grid-cols-3 gap-3 text-sm items-center flex-1">
          <div>
            <span className="font-semibold text-gray-600">סוג:</span>
            <span className="mr-2 text-gray-900">{r.is_explosion ? 'נפיצה' : 'קליעית'}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-600">פריט:</span>
            <span className="mr-1 text-gray-900">{r.approved_item_name ?? r.item_name}</span>
          </div>
          <div>
            <span className="font-semibold text-gray-600">כמות:</span>
            <span className="mr-2 text-gray-900">{r.approved_quantity ?? r.requested_quantity}</span>
          </div>
        </div>

        {!decided && (
          <Button
            size="sm"
            variant="destructive"
            disabled={pending}
            onClick={() => onCancel(r)}
          >
            בטל בקשה
          </Button>
        )}
      </div>
      <div className="mt-2">
        <span className={`text-xs px-2 py-0.5 rounded-full ${STATUS_BADGE[r.status]}`}>{r.status}</span>
      </div>
      {error && <div className="text-xs text-red-600 mt-1">{error}</div>}
    </div>
  );
}

export function MyRequestsCards({ requests, email, onSuccess }: Props) {
  const cancel = useCancelRequest();
  const [pendingId, setPendingId] = useState<number | null>(null);
  const [errorById, setErrorById] = useState<Record<number, string>>({});

  const batches = useMemo((): Batch[] => {
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
        created_at: reqs.reduce((min, r) => (r.created_at < min ? r.created_at : min), reqs[0].created_at),
        requester_name: reqs[0].requester_name,
      }))
      .sort((a, b) => new Date(b.created_at).getTime() - new Date(a.created_at).getTime());
  }, [requests]);

  const handleCancel = async (r: RequestRow) => {
    setErrorById((prev) => ({ ...prev, [r.id]: '' }));
    setPendingId(r.id);
    try {
      await cancel.mutateAsync({ request_id: r.id, requester_email: email });
      onSuccess?.(`הבקשה עבור ${r.item_name} בוטלה`);
    } catch (e) {
      setErrorById((prev) => ({ ...prev, [r.id]: (e as Error).message }));
    } finally {
      setPendingId(null);
    }
  };

  if (batches.length === 0) {
    return <p className="text-sm text-gray-400 py-2">אין דיווחים להצגה</p>;
  }

  return (
    <div className="space-y-4">
      {batches.map((batch) => (
        <div key={batch.key} className="border rounded-lg shadow-sm bg-white overflow-hidden">
          <div className="bg-blue-50 border-b px-4 py-3 flex justify-between items-center">
            <h3 className="font-bold text-lg text-blue-900">{formatDateTime(batch.created_at)}</h3>
            <span className="text-sm text-blue-700">מדווח: {batch.requester_name}</span>
          </div>
          <div className="divide-y">
            {batch.requests.map((r) => (
              <RequestItem
                key={r.id}
                request={r}
                email={email}
                pending={pendingId === r.id}
                error={errorById[r.id]}
                onCancel={handleCancel}
              />
            ))}
          </div>
        </div>
      ))}
    </div>
  );
}

export default MyRequestsCards;
