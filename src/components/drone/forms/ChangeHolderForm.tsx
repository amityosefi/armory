import { useEffect, useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Label } from '@/components/ui/label';
import { Combobox } from '@/components/ui/combobox';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useChangeHolder } from '../hooks/useDroneActions';
import { useDronePermissions } from '../hooks/useDronePermissions';
import type { DroneRow, PersonOption } from '../types';

interface Props {
  drone: DroneRow | null;
  people: PersonOption[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onMessage: (message: string, isSuccess: boolean) => void;
}

/**
 * העברת חתימה - the holder changes in place, so the items stay with the drone
 * and גדוד is untouched. Candidates are limited to the drone's own company,
 * which the RPC re-checks.
 */
export function ChangeHolderForm({ drone, people, open, onOpenChange, onMessage }: Props) {
  const { actorId, actorName } = useDronePermissions();
  const change = useChangeHolder();

  const [holderId, setHolderId] = useState('');
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (open) {
      setHolderId('');
      setError(null);
    }
  }, [open, drone?.id]);

  // The current holder is not a useful choice.
  const options = useMemo(
    () =>
      people
        .filter((p) => String(p.id) !== drone?.location)
        .map((p) => ({ value: String(p.id), label: `${p.name} (${p.id})` })),
    [people, drone?.location]
  );

  const submit = async () => {
    setError(null);
    if (!drone) return;
    if (!holderId) return setError('חובה לבחור מחזיק חדש');

    const holder = people.find((p) => String(p.id) === holderId);
    try {
      await change.mutateAsync({
        drone_id: drone.id,
        holder_id: holderId,
        holder_name: holder?.name ?? '',
        actor_id: actorId,
        actor_name: actorName,
      });
      onOpenChange(false);
      onMessage(`הרחפן ${drone.serial} הועבר ל${holder?.name}`, true);
    } catch (e) {
      setError((e as Error).message);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent dir="rtl" className="max-w-md">
        <DialogHeader>
          <DialogTitle>העברת חתימה — רחפן {drone?.serial}</DialogTitle>
        </DialogHeader>

        <div className="space-y-3">
          <div className="text-sm text-gray-600">
            מחזיק נוכחי: {drone?.holder_name}{' '}
            <span className="text-gray-400">({drone?.location})</span>
          </div>
          <div>
            <Label className="text-xs">מחזיק חדש (מפלוגה {drone?.sheet_range})</Label>
            <Combobox
              value={holderId || null}
              onValueChange={(v) => setHolderId(String(v))}
              options={options}
              placeholder="בחר חייל"
              searchPlaceholder="חיפוש לפי שם או מספר אישי"
              emptyText="לא נמצאו חיילים נוספים בפלוגה"
            />
          </div>
          <p className="text-xs text-gray-500">
            הפריטים נשארים על הרחפן, מלאי הגדוד אינו משתנה.
          </p>
          {error && <div className="text-sm text-red-600">{error}</div>}
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>ביטול</Button>
          <Button onClick={submit} disabled={change.isPending}>
            {change.isPending ? 'מעביר…' : 'העברה'}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export default ChangeHolderForm;
