import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
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
import { useStockAdd } from '../hooks/useInventoryActions';
import { useUserRole } from '../hooks/useUserRole';
import { CatalogItem, GADUD_LOCATION, InventoryRow, STOCK_LOCATION } from '../types';

type StockLocation = typeof GADUD_LOCATION | typeof STOCK_LOCATION;

interface Props {
  catalog: CatalogItem[];
  stock: InventoryRow[];
  location: StockLocation;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: (message: string) => void;
}

type Line =
  | { mode: 'existing'; itemName: string; qty: number | '' }
  | { mode: 'new'; itemName: string; isExplosion: boolean; qty: number | '' };

const emptyLine = (): Line => ({ mode: 'existing', itemName: '', qty: '' });

export function StockAddForm({ catalog, stock, location, open, onOpenChange, onSuccess }: Props) {
  const { email, name, signature } = useUserRole();
  const add = useStockAdd();

  const stockByItem = useMemo(() => {
    const m = new Map<string, number>();
    stock.forEach((r) => m.set(r.item_name, r.quantity));
    return m;
  }, [stock]);

  const [lines, setLines] = useState<Line[]>([emptyLine()]);
  const [error, setError] = useState<string | null>(null);

  const reset = () => { setLines([emptyLine()]); setError(null); };

  const addLine = () => setLines((p) => [...p, emptyLine()]);
  const removeLine = (i: number) => setLines((p) => p.filter((_, idx) => idx !== i));

  const updateLine = (i: number, patch: Partial<Line>) =>
    setLines((p) => p.map((l, idx) => (idx === i ? ({ ...l, ...patch } as Line) : l)));

  const setLineMode = (i: number, mode: 'existing' | 'new') =>
    setLines((p) =>
      p.map((l, idx) =>
        idx === i
          ? mode === 'existing'
            ? { mode: 'existing', itemName: '', qty: '' }
            : { mode: 'new', itemName: '', isExplosion: false, qty: '' }
          : l
      )
    );

  const submit = async () => {
    setError(null);
    const resolved: { itemName: string; isExplosion: boolean; qty: number }[] = [];

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];
      if (!line.qty || (line.qty as number) <= 0) return setError(`שורה ${i + 1}: כמות חייבת להיות חיובית`);

      if (line.mode === 'existing') {
        const item = catalog.find((c) => c.item_name === line.itemName);
        if (!item) return setError(`שורה ${i + 1}: בחר פריט`);
        resolved.push({ itemName: item.item_name, isExplosion: item.is_explosion, qty: line.qty as number });
      } else {
        const trimmed = line.itemName.trim();
        if (!trimmed) return setError(`שורה ${i + 1}: הכנס שם פריט`);
        if (catalog.some((c) => c.item_name === trimmed))
          return setError(`שורה ${i + 1}: פריט "${trimmed}" קיים - בחר "פריט קיים"`);
        resolved.push({ itemName: trimmed, isExplosion: line.isExplosion, qty: line.qty as number });
      }
    }

    try {
      for (const { itemName, isExplosion, qty } of resolved) {
        await add.mutateAsync({
          actor_email: email,
          actor_name: name,
          actor_signature: signature,
          item_name: itemName,
          is_explosion: isExplosion,
          qty,
          location,
        });
      }
      const itemsList = resolved.map((r) => `${r.itemName} (${r.qty})`).join(', ');
      reset();
      onOpenChange(false);
      onSuccess?.(`הוספו בהצלחה ל${location}: ${itemsList}`);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) reset(); onOpenChange(o); }}>
      <DialogContent dir="rtl" className="max-w-lg">
        <DialogHeader>
          <DialogTitle>הוספה ל{location === 'גדוד' ? 'גדוד' : 'מחסן'}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          {lines.map((line, i) => (
            <div key={i} className="border rounded p-3 space-y-2 relative">
              {lines.length > 1 && (
                <button
                  type="button"
                  onClick={() => removeLine(i)}
                  className="absolute left-2 top-2 text-gray-400 hover:text-red-500 text-lg leading-none"
                >
                  ✕
                </button>
              )}

              {/* Mode toggle */}
              <div className="flex gap-2">
                <Button
                  type="button"
                  variant={line.mode === 'existing' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLineMode(i, 'existing')}
                >
                  פריט קיים
                </Button>
                <Button
                  type="button"
                  variant={line.mode === 'new' ? 'default' : 'outline'}
                  size="sm"
                  onClick={() => setLineMode(i, 'new')}
                >
                  פריט חדש
                </Button>
              </div>

              {line.mode === 'existing' ? (
                <div>
                  <Label className="text-xs">פריט</Label>
                  <Select value={line.itemName} onValueChange={(v) => updateLine(i, { itemName: v })}>
                    <SelectTrigger className="h-9"><SelectValue placeholder="בחר פריט" /></SelectTrigger>
                    <SelectContent>
                      {catalog.map((c) => (
                        <SelectItem key={c.item_name} value={c.item_name}>
                          {c.item_name} ({c.is_explosion ? 'נפיצה' : 'קליעית'}) · במחסן: {stockByItem.get(c.item_name) ?? 0}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
              ) : (
                <>
                  <div>
                    <Label className="text-xs">שם פריט</Label>
                    <Input
                      className="h-9"
                      value={line.itemName}
                      onChange={(e) => updateLine(i, { itemName: e.target.value })}
                    />
                  </div>
                  <div className="flex items-center gap-2">
                    <Checkbox
                      id={`explosion-${i}`}
                      checked={line.isExplosion}
                      onCheckedChange={(v) => updateLine(i, { isExplosion: v === true })}
                    />
                    <Label htmlFor={`explosion-${i}`} className="text-xs">נפיצה (אחרת - קליעית)</Label>
                  </div>
                </>
              )}

              <div>
                <Label className="text-xs">כמות להוספה</Label>
                <Input
                  type="number"
                  min={1}
                  className="h-9"
                  value={line.qty}
                  onChange={(e) => updateLine(i, { qty: e.target.value === '' ? '' : Number(e.target.value) })}
                />
              </div>
            </div>
          ))}

          <Button type="button" variant="outline" size="sm" onClick={addLine}>
            + הוסף פריט
          </Button>

          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={add.isPending}>
            {add.isPending ? 'מוסיף…' : 'הוספה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockAddForm;
