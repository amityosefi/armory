import { useState } from 'react';
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useCreateRequest } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { GroupLocation, InventoryRow } from '../types';

interface Props {
  location: GroupLocation;
  inventory: InventoryRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}

type Line = { itemName: string; qty: number | '' };

export function RequestDecreaseForm({ location, inventory, open, onOpenChange, onSuccess }: Props) {
  const { email, name, signature, userId } = useUserRole();
  const create = useCreateRequest();

  const available = inventory.filter((r) => r.quantity > 0);
  const [lines, setLines] = useState<Line[]>([{ itemName: '', qty: '' }]);
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setLines([{ itemName: '', qty: '' }]); setNotes(''); setError(null); };

  const addLine = () => setLines((p) => [...p, { itemName: '', qty: '' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const setLineItem = (i: number, val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, itemName: val, qty: '' } : l)));
  const setLineQty = (i: number, val: number | '') =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, qty: val } : l)));

  const submit = async () => {
    setError(null);
    if (!signature) return setError('חתימה חסרה - התחבר מחדש');
    for (let i = 0; i < lines.length; i++) {
      const { itemName, qty } = lines[i];
      const selected = available.find((r) => r.item_name === itemName);
      if (!selected) return setError(`שורה ${i + 1}: בחר פריט`);
      if (!qty || qty <= 0) return setError(`שורה ${i + 1}: כמות חייבת להיות חיובית`);
      if (qty > selected.quantity) return setError(`שורה ${i + 1}: חורג מהזמין (${selected.quantity})`);
    }
    try {
      const batchId = lines.length > 1 ? crypto.randomUUID() : undefined;
      for (const { itemName, qty } of lines) {
        const selected = available.find((r) => r.item_name === itemName)!;
        await create.mutateAsync({
          requester_email: email,
          requester_name: name,
          requester_location: location,
          requester_signature: signature,
          item_name: selected.item_name,
          requested_quantity: qty as number,
          notes: notes || undefined,
          batch_id: batchId,
          requester_id: userId || undefined,
        });
      }
      const itemsList = lines.map((l) => `${l.itemName} (${l.qty})`).join(', ');
      reset();
      onOpenChange(false);
      onSuccess?.(`הבקשה נשלחה בהצלחה: ${itemsList}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>דיווח שצל</DialogTitle>
          <DialogDescription>פלוגה: {location}</DialogDescription>
        </DialogHeader>

        <div className="space-y-3">
          {lines.map((line, i) => {
            const sel = available.find((r) => r.item_name === line.itemName);
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  {i === 0 && <Label className="text-xs">פריט</Label>}
                  <Select value={line.itemName} onValueChange={(v) => setLineItem(i, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="בחר פריט" /></SelectTrigger>
                    <SelectContent>
                      {available.map((r) => (
                        <SelectItem key={r.item_name} value={r.item_name}>
                          {r.item_name} (זמין: {r.quantity})
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-24">
                  {i === 0 && <Label className="text-xs">כמות</Label>}
                  <Input
                    type="number"
                    min={1}
                    max={sel?.quantity}
                    className="h-9"
                    value={line.qty}
                    onChange={(e) => setLineQty(i, e.target.value === '' ? '' : Number(e.target.value))}
                    placeholder={sel ? `1-${sel.quantity}` : ''}
                    disabled={!sel}
                  />
                </div>
                {lines.length > 1 && (
                  <button
                    type="button"
                    onClick={() => removeLine(i)}
                    className="text-gray-400 hover:text-red-500 pb-1 text-lg leading-none"
                  >
                    ✕
                  </button>
                )}
              </div>
            );
          })}

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + הוסף פריט
          </Button>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={create.isPending}>
            {create.isPending ? 'שולח…' : 'שליחה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default RequestDecreaseForm;
