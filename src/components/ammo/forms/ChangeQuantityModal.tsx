import { useEffect, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogDescription,
} from '@/components/ui/dialog';
import { useApproveRequest } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { InventoryRow, RequestRow } from '../types';

interface Props {
  request: RequestRow | null;
  inventory: InventoryRow[]; // group inventory of the request's location
  onClose: () => void;
  onSuccess?: (message: string) => void;
}

export function ChangeQuantityModal({ request, inventory, onClose, onSuccess }: Props) {
  const { email, name, signature } = useUserRole();
  const approve = useApproveRequest();

  const [qty, setQty] = useState<number | ''>('');
  const [error, setError] = useState<string | null>(null);

  const available = inventory.find((r) => r.item_name === request?.item_name);
  const maxQty = available?.quantity ?? 0;

  useEffect(() => {
    if (!request) return;
    setQty(request.requested_quantity);
    setError(null);
  }, [request]);

  const submit = async () => {
    setError(null);
    if (!request) return;
    if (!qty || qty <= 0) return setError('כמות חייבת להיות חיובית');
    if (qty > maxQty) return setError(`הכמות חורגת מהמלאי (${maxQty})`);

    try {
      await approve.mutateAsync({
        actor_email: email,
        actor_name: name,
        actor_signature: signature,
        request_id: request.id,
        approved_item_name: request.item_name,
        approved_quantity: qty,
        location: request.requester_location,
      });
      onClose();
      onSuccess?.(`הכמות עודכנה ואושרה: ${request.item_name} (${qty})`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={!!request} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-sm">
        <DialogHeader>
          <DialogTitle>שנה כמות</DialogTitle>
          {request && <DialogDescription>{request.item_name}</DialogDescription>}
        </DialogHeader>

        {request && (
          <div className="space-y-3">
            <div>
              <Label>כמות</Label>
              <Input
                type="number"
                min={1}
                max={maxQty || undefined}
                value={qty}
                onChange={(e) => setQty(e.target.value === '' ? '' : Number(e.target.value))}
                placeholder={`1 - ${maxQty}`}
              />
            </div>
            {error && <div className="text-sm text-red-600">{error}</div>}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={onClose} disabled={approve.isPending}>ביטול</Button>
          <Button onClick={submit} disabled={approve.isPending}>
            {approve.isPending ? 'מעבד…' : 'שליחה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChangeQuantityModal;
