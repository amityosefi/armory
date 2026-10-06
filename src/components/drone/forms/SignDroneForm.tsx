import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSignDrone } from '../hooks/useDroneActions';
import { useDronePermissions } from '../hooks/useDronePermissions';
import { DRONE_DEFAULTS, DRONE_LABEL, itemNamesFor, stockFor } from '../types';
import type { DroneRow, DroneType, ItemMap, PersonOption } from '../types';

interface Props {
  droneType: DroneType;
  sheetRange: string;
  people: PersonOption[];
  stock: DroneRow[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessage: (message: string, isSuccess: boolean) => void;
}

/**
 * החתמת רחפן - quantities start at the model's JSON defaults and every one is
 * editable, including down to 0. Each row shows what גדוד currently holds, so
 * an overdraw is visible before submitting rather than only as an error.
 */
export function SignDroneForm({
  droneType, sheetRange, people, stock, open, onOpenChange, onMessage,
}: Props) {
  const { actorId, actorName } = useDronePermissions();
  const sign = useSignDrone();

  const [serial, setSerial] = useState('');
  const [holderId, setHolderId] = useState<string>('');
  const [quantities, setQuantities] = useState<Record<string, string>>({});
  const [error, setError] = useState<string | null>(null);

  const available = useMemo(
    () => stockFor(stock, droneType)?.items ?? {},
    [stock, droneType]
  );
  const itemNames = useMemo(
    () => itemNamesFor(droneType, available),
    [droneType, available]
  );

  const resetTo = useMemo(() => {
    const defaults = DRONE_DEFAULTS[droneType];
    const seeded: Record<string, string> = {};
    itemNames.forEach((n) => { seeded[n] = String(defaults[n] ?? 0); });
    return seeded;
  }, [droneType, itemNames]);

  // Re-seed whenever the dialog opens or the model changes.
  useEffect(() => {
    if (open) {
      setSerial('');
      setHolderId('');
      setQuantities(resetTo);
      setError(null);
    }
  }, [open, resetTo]);

  const peopleOptions = useMemo(
    () => people.map((p) => ({ value: String(p.id), label: `${p.name} (${p.id})` })),
    [people]
  );

  const submit = async () => {
    setError(null);

    if (!serial.trim()) return setError('חובה להזין מספר סידורי');
    if (!holderId) return setError('חובה לבחור מחזיק');

    const items: ItemMap = {};
    for (const name of itemNames) {
      const raw = quantities[name] ?? '0';
      const n = raw === '' ? 0 : Number(raw);
      if (!Number.isInteger(n) || n < 0) return setError(`${name}: כמות לא תקינה`);
      if (n > 0) items[name] = n;
    }
    if (Object.keys(items).length === 0) return setError('יש להחתים לפחות פריט אחד');

    const short = Object.entries(items).filter(([n, q]) => q > (available[n] ?? 0));
    if (short.length > 0) {
      return setError(
        `אין מספיק מלאי בגדוד: ${short
          .map(([n, q]) => `${n} (נדרש ${q}, קיים ${available[n] ?? 0})`)
          .join(', ')}`
      );
    }

    const holder = people.find((p) => String(p.id) === holderId);
    try {
      await sign.mutateAsync({
        drone_type: droneType,
        serial: serial.trim(),
        sheet_range: sheetRange,
        holder_id: holderId,
        holder_name: holder?.name ?? '',
        items,
        actor_id: actorId,
        actor_name: actorName,
      });
      onOpenChange(false);
      onMessage(`רחפן ${DRONE_LABEL[droneType]} ${serial.trim()} הוחתם על ${holder?.name}`, true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>החתמת רחפן {DRONE_LABEL[droneType]} — פלוגה {sheetRange}</DialogTitle>
        </DialogHeader>

        <div className="space-y-4 max-h-[60vh] overflow-y-auto pr-1">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <div>
              <Label className="text-xs">מספר סידורי</Label>
              <Input
                className="h-9"
                value={serial}
                onChange={(e) => setSerial(e.target.value)}
                placeholder="מספר סידורי של הרחפן"
              />
            </div>
            <div>
              <Label className="text-xs">מחזיק</Label>
              <Combobox
                value={holderId || null}
                onValueChange={(v) => setHolderId(String(v))}
                options={peopleOptions}
                placeholder="בחר חייל"
                searchPlaceholder="חיפוש לפי שם או מספר אישי"
                emptyText="לא נמצאו חיילים בפלוגה"
              />
            </div>
          </div>

          <div>
            <div className="flex justify-between items-center mb-1">
              <Label className="text-xs">פריטים</Label>
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={() => setQuantities(resetTo)}
              >
                איפוס לברירת מחדל
              </Button>
            </div>
            <div className="border rounded divide-y">
              {itemNames.map((name) => {
                const have = available[name] ?? 0;
                const want = Number(quantities[name] ?? 0);
                const over = want > have;
                return (
                  <div key={name} className="flex items-center gap-2 px-3 py-1.5 text-sm">
                    <span className="flex-1 truncate" title={name}>{name}</span>
                    <span className={`text-xs shrink-0 ${over ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                      בגדוד: {have}
                    </span>
                    <Input
                      type="number"
                      min={0}
                      className={`h-8 w-20 shrink-0 text-center ${over ? 'border-red-400' : ''}`}
                      value={quantities[name] ?? ''}
                      onChange={(e) =>
                        setQuantities((p) => ({ ...p, [name]: e.target.value }))
                      }
                    />
                  </div>
                );
              })}
            </div>
          </div>

          {error && <div className="text-sm text-red-600 whitespace-pre-wrap">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={sign.isPending}>
            {sign.isPending ? 'מחתים…' : 'החתמה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default SignDroneForm;
