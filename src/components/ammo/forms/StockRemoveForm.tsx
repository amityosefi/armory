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
import { useStockRemove } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { GADUD_LOCATION, InventoryRow, STOCK_LOCATION } from '../types';

type StockLocation = typeof GADUD_LOCATION | typeof STOCK_LOCATION;

interface Props {
  stock: InventoryRow[];
  location: StockLocation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}

type Line = { itemName: string; qty: number | '' };

export function StockRemoveForm({ stock, location, open, onOpenChange, onSuccess }: Props) {
  const { email, name, signature } = useUserRole();
  const remove = useStockRemove();

  const available = stock.filter((r) => r.quantity > 0);
  const [lines, setLines] = useState<Line[]>([{ itemName: '', qty: '' }]);
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setLines([{ itemName: '', qty: '' }]); setNote(''); setError(null); };

  const addLine = () => setLines((p) => [...p, { itemName: '', qty: '' }]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));
  const setLineItem = (i: number, val: string) =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, itemName: val, qty: '' } : l)));
  const setLineQty = (i: number, val: number | '') =>
    setLines((p) => p.map((l, idx) => (idx === i ? { ...l, qty: val } : l)));

  const submit = async () => {
    setError(null);
    for (let i = 0; i < lines.length; i++) {
      const { itemName, qty } = lines[i];
      const selected = available.find((r) => r.item_name === itemName);
      if (!selected) return setError(`שורה ${i + 1}: בחר פריט`);
      if (!qty || qty <= 0) return setError(`שורה ${i + 1}: כמות חייבת להיות חיובית`);
      if (qty > selected.quantity) return setError(`שורה ${i + 1}: חורג מהמלאי (${selected.quantity})`);
    }
    try {
      for (const { itemName, qty } of lines) {
        const selected = available.find((r) => r.item_name === itemName)!;
        await remove.mutateAsync({
          actor_email: email,
          actor_name: name,
          actor_signature: signature,
          item_name: selected.item_name,
          qty: qty as number,
          note: note || undefined,
          location,
        });
      }
      const itemsList = lines.map((l) => `${l.itemName} (${l.qty})`).join(', ');
      reset();
      onOpenChange(false);
      onSuccess?.(`הוצאו בהצלחה מ${location}: ${itemsList}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>הוצאה מה{location === 'גדוד' ? 'גדוד' : 'מחסן'}</DialogTitle>
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
                          {r.item_name} (במחסן: {r.quantity})
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
          <Button onClick={submit} disabled={remove.isPending}>
            {remove.isPending ? 'מעבד…' : 'הוצאה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockRemoveForm;
