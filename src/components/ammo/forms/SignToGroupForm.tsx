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
} from '@/components/ui/dialog';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { useInventory } from '../hooks/useInventory';
import { useSignToGroup, useTransferInventory } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { GroupLocation, InventoryRow } from '../types';

interface Props {
  location: GroupLocation;
  groupInventory: InventoryRow[]; // current group inventory (for זיכוי direction)
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}

type Mode = 'החתמה' | 'זיכוי';
type Line = { itemName: string; qty: number | '' };

export function SignToGroupForm({ location, groupInventory, open, onOpenChange, onSuccess }: Props) {
  const { email, name, signature } = useUserRole();
  const { data: gadudStock } = useInventory('גדוד', open);
  const sign = useSignToGroup();
  const transfer = useTransferInventory();

  const [mode, setMode] = useState<Mode>('החתמה');
  const [lines, setLines] = useState<Line[]>([{ itemName: '', qty: '' }]);
  const [error, setError] = useState<string | null>(null);

  // Source inventory depends on direction
  const sourceInventory =
    mode === 'החתמה'
      ? (gadudStock ?? []).filter((r) => r.quantity > 0)
      : groupInventory.filter((r) => r.quantity > 0);

  const reset = () => {
    setLines([{ itemName: '', qty: '' }]);
    setError(null);
  };

  const switchMode = (m: Mode) => {
    setMode(m);
    setLines([{ itemName: '', qty: '' }]);
    setError(null);
  };

  const addLine = () => setLines((p) => [...p, { itemName: '', qty: '' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const setLineItem = (i: number, val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, itemName: val, qty: '' } : l)));
  const setLineQty = (i: number, val: number | '') =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, qty: val } : l)));

  const isPending = sign.isPending || transfer.isPending;

  const submit = async () => {
    setError(null);
    for (let i = 0; i < lines.length; i++) {
      const { itemName, qty } = lines[i];
      const selected = sourceInventory.find((r) => r.item_name === itemName);
      if (!selected) return setError(`שורה ${i + 1}: בחר פריט`);
      if (!qty || qty <= 0) return setError(`שורה ${i + 1}: כמות חייבת להיות חיובית`);
      if (qty > selected.quantity)
        return setError(`שורה ${i + 1}: חורג מהזמין (${selected.quantity})`);
    }

    try {
      for (const { itemName, qty } of lines) {
        const selected = sourceInventory.find((r) => r.item_name === itemName)!;

        if (mode === 'החתמה') {
          await sign.mutateAsync({
            actor_email: email,
            actor_name: name,
            actor_signature: signature,
            item_name: selected.item_name,
            location,
            qty: qty as number,
          });
        } else {
          // זיכוי: transfer from group back to גדוד
          await transfer.mutateAsync({
            actor_email: email,
            actor_name: name,
            actor_signature: signature,
            item_name: selected.item_name,
            qty: qty as number,
            from_location: location,
            to_location: 'גדוד',
          });
        }
      }
      const itemsList = lines.map((l) => `${l.itemName} (${l.qty})`).join(', ');
      reset();
      onOpenChange(false);
      onSuccess?.(
        mode === 'החתמה'
          ? `הוחתמו בהצלחה לפלוגה ${location}: ${itemsList}`
          : `זוכו בהצלחה מפלוגה ${location} לגדוד: ${itemsList}`
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  const sourceLabel = mode === 'החתמה' ? 'מהגדוד' : `מפלוגה ${location}`;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>החתמה/ זיכוי — פלוגה {location}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4">
          {/* Direction toggle */}
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className={mode === 'החתמה' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
              variant={mode === 'החתמה' ? 'default' : 'outline'}
              onClick={() => switchMode('החתמה')}
            >
              החתמה
            </Button>
            <Button
              type="button"
              size="sm"
              variant={mode === 'זיכוי' ? 'default' : 'outline'}
              onClick={() => switchMode('זיכוי')}
            >
              זיכוי
            </Button>
          </div>

          {/* Item lines */}
          {lines.map((line, i) => {
            const sel = sourceInventory.find((r) => r.item_name === line.itemName);
            return (
              <div key={i} className="flex items-end gap-2">
                <div className="flex-1">
                  {i === 0 && <Label className="text-xs">פריט ({sourceLabel})</Label>}
                  <Select value={line.itemName} onValueChange={(v) => setLineItem(i, v)}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="בחר פריט" /></SelectTrigger>
                    <SelectContent>
                      {sourceInventory.map((r) => (
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
                    disabled={!sel}
                    placeholder={sel ? `1-${sel.quantity}` : ''}
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
          <Button
            onClick={submit}
            disabled={isPending}
            className={mode === 'החתמה' ? 'bg-green-600 hover:bg-green-700 text-white' : ''}
          >
            {isPending ? 'מעבד…' : mode}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SignToGroupForm;
