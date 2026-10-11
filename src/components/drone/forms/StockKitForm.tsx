import { useEffect, useMemo, useState } from 'react';
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
import { useStockChange } from '../hooks/useDroneActions';
import { useDronePermissions } from '../hooks/useDronePermissions';
import { DRONE_DEFAULTS, DRONE_LABEL, itemNamesFor, stockFor } from '../types';
import type { DroneRow, DroneType, ItemMap } from '../types';

interface Props {
  droneType: DroneType;
  stock: DroneRow[];
  /** +1 adds a kit to גדוד, -1 removes one. */
  sign: 1 | -1;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessage: (message: string, isSuccess: boolean) => void;
}

/**
 * הוספת / הוצאת מלאי - restocking is kit-shaped rather than item-shaped: the
 * quantities start from the model's JSON defaults so a whole drone's worth of
 * parts goes in with one action, and each one is still editable.
 */
export function StockKitForm({ droneType, stock, sign, open, onOpenChange, onMessage }: Props) {
  const { actorId, actorName } = useDronePermissions();
  const change = useStockChange();

  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [note, setNote] = useState('');
  const [error, setError] = useState<string | null>(null);

  const current = useMemo(() => stockFor(stock, droneType)?.items ?? {}, [stock, droneType]);
  const itemNames = useMemo(() => itemNamesFor(droneType, current), [droneType, current]);

  const defaultsSeed = useMemo(() => {
    const defaults = DRONE_DEFAULTS[droneType];
    const seeded: Record<string, string> = {};
    itemNames.forEach((n) => { seeded[n] = String(defaults[n] ?? 0); });
    return seeded;
  }, [droneType, itemNames]);

  const zeroSeed = useMemo(() => {
    const seeded: Record<string, string> = {};
    itemNames.forEach((n) => { seeded[n] = '0'; });
    return seeded;
  }, [itemNames]);

  useEffect(() => {
    if (open) {
      // Adding defaults to a whole kit; removing starts empty so nothing
      // leaves the pool by accident.
      setQuantities(sign > 0 ? defaultsSeed : zeroSeed);
      setNote('');
      setError(null);
    }
  }, [open, sign, defaultsSeed, zeroSeed]);

  const isAdd = sign > 0;

  const submit = async () => {
    setError(null);

    const items: ItemMap = {};
    for (const name of itemNames) {
      const raw = quantities[name] ?? '0';
      const n = raw === '' ? 0 : Number(raw);
      if (!Number.isInteger(n) || n < 0) return setError(`${name}: כמות לא תקינה`);
      if (n > 0) items[name] = n;
    }
    if (Object.keys(items).length === 0) return setError('יש להזין כמות לפריט אחד לפחות');

    if (!isAdd) {
      const short = Object.entries(items).filter(([n, q]) => q > (current[n] ?? 0));
      if (short.length > 0) {
        return setError(
          `אין מספיק מלאי בגדוד: ${short
            .map(([n, q]) => `${n} (נדרש ${q}, קיים ${current[n] ?? 0})`)
            .join(', ')}`
        );
      }
    }

    try {
      await change.mutateAsync({
        drone_type: droneType,
        items,
        sign,
        note: note.trim() || undefined,
        actor_id: actorId,
        actor_name: actorName,
      });
      onOpenChange(false);
      onMessage(
        `${isAdd ? 'נוספו' : 'הוצאו'} ${Object.keys(items).length} סוגי פריטים ל${DRONE_LABEL[droneType]} בגדוד`,
        true
      );
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>
            {isAdd ? 'הוספת מלאי' : 'הוצאת מלאי'} — {DRONE_LABEL[droneType]}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="flex gap-2">
            <Button type="button" variant="outline" size="sm" onClick={() => setQuantities(defaultsSeed)}>
              ערכה שלמה
            </Button>
            <Button type="button" variant="outline" size="sm" onClick={() => setQuantities(zeroSeed)}>
              איפוס לאפס
            </Button>
          </div>

          <div className="border rounded divide-y">
            {itemNames.map((name) => (
              <div key={name} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                <span className="flex-1 truncate" title={name}>{name}</span>
                <span className="text-xs text-gray-400 shrink-0">
                  קיים: {current[name] ?? 0}
                </span>
                <Input
                  type="number"
                  min={0}
                  className="h-8 w-20 shrink-0 text-center"
                  value={quantities[name] ?? ''}
                  onChange={(e) => setQuantities((p) => ({ ...p, [name]: e.target.value }))}
                />
              </div>
            ))}
          </div>

          <div>
            <Label className="text-xs">הערה (אופציונלי)</Label>
            <Input className="h-9" value={note} onChange={(e) => setNote(e.target.value)} />
          </div>

          {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={change.isPending}>
            {change.isPending ? 'שומר…' : isAdd ? 'הוספה' : 'הוצאה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default StockKitForm;
