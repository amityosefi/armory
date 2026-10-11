import { useState } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { useSetItemQty, useDeleteDrone } from './hooks/useDroneActions';
import { useDronePermissions } from './hooks/useDronePermissions';
import { itemNamesFor } from './types';
import type { DroneRow } from './types';

interface Props {
  drone: DroneRow;
  onReassign: (drone: DroneRow) => void;
  onMessage: (message: string, isSuccess: boolean) => void;
}

/**
 * One signed drone: serial, holder, and its item list.
 *
 * Quantity inputs commit on blur. Because every change moves גדוד stock, a
 * rejected change (not enough in גדוד) reverts the input to the server's value
 * rather than leaving a number the database never accepted.
 */
export function DroneCard({ drone, onReassign, onMessage }: Props) {
  const { canEdit, actorId, actorName } = useDronePermissions();
  const setQty = useSetItemQty();
  const remove = useDeleteDrone();

  // Only the item currently being edited is held locally; everything else
  // renders straight from the query cache.
  const [draft, setDraft] = useState<{ item: string; value: string } | null>(null);
  const [confirmOpen, setConfirmOpen] = useState(false);
  const [expanded, setExpanded] = useState(false);

  const itemNames = itemNamesFor(drone.drone_type, drone.items);
  const qtyOf = (item: string) => drone.items?.[item] ?? 0;

  const commit = async (item: string) => {
    const raw = draft?.value ?? '';
    setDraft(null);
    const next = raw === '' ? 0 : Number(raw);
    if (!Number.isInteger(next) || next < 0) {
      onMessage('כמות חייבת להיות מספר שלם לא שלילי', false);
      return;
    }
    if (next === qtyOf(item)) return;

    try {
      await setQty.mutateAsync({
        drone_id: drone.id,
        item_name: item,
        new_qty: next,
        actor_id: actorId,
        actor_name: actorName,
      });
      onMessage(`${item}: הכמות עודכנה ל-${next}`, true);
    } catch (e) {
      onMessage((e as Error).message, false);
    }
  };

  const confirmDelete = async () => {
    try {
      await remove.mutateAsync({
        drone_id: drone.id,
        actor_id: actorId,
        actor_name: actorName,
      });
      setConfirmOpen(false);
      onMessage(`הרחפן ${drone.serial} נמחק, כל הפריטים הוחזרו לגדוד`, true);
    } catch (e) {
      onMessage((e as Error).message, false);
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-lg shadow-sm p-4" dir="rtl">
      <div
        role="button"
        tabIndex={0}
        aria-expanded={expanded}
        className={`flex flex-wrap justify-between items-start gap-2 cursor-pointer ${
          expanded ? 'mb-3 pb-3 border-b' : ''
        }`}
        onClick={() => setExpanded((v) => !v)}
        onKeyDown={(e) => {
          if (e.target === e.currentTarget && (e.key === 'Enter' || e.key === ' ')) {
            e.preventDefault();
            setExpanded((v) => !v);
          }
        }}
      >
        <div className="flex items-start gap-2">
          <span className="text-gray-400 select-none mt-0.5">{expanded ? '▾' : '◂'}</span>
          <div>
            <div className="font-bold text-gray-800">
              מספר סידורי: <span className="font-mono">{drone.serial}</span>
            </div>
            <div className="text-sm text-gray-600">
              מחזיק: {drone.holder_name}{' '}
              <span className="text-gray-400">({drone.location})</span>
            </div>
            <div className="text-xs text-gray-400">
              {drone.signed_by_name && <>הוחתם ע"י {drone.signed_by_name} · </>}
              {new Date(drone.created_at).toLocaleString('he-IL', {
                dateStyle: 'short',
                timeStyle: 'short',
              })}
            </div>
          </div>
        </div>

        {canEdit && expanded && (
          <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
            <Button variant="outline" size="sm" onClick={() => onReassign(drone)}>
              העברת חתימה
            </Button>
            <Button variant="destructive" size="sm" onClick={() => setConfirmOpen(true)}>
              מחיקת רחפן
            </Button>
          </div>
        )}
      </div>

      {expanded && (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-x-6 gap-y-1">
          {itemNames.map((item) => {
            const qty = qtyOf(item);
            const isEditing = draft?.item === item;
            return (
              <div
                key={item}
                className={`flex justify-between items-center gap-2 py-1 text-sm ${
                  qty === 0 ? 'text-gray-400' : 'text-gray-800'
                }`}
              >
                <span className="truncate" title={item}>{item}</span>
                {canEdit ? (
                  <input
                    type="number"
                    min={0}
                    className="w-16 shrink-0 border rounded px-2 py-0.5 text-center"
                    value={isEditing ? draft.value : String(qty)}
                    onChange={(e) => setDraft({ item, value: e.target.value })}
                    onFocus={() => setDraft({ item, value: String(qty) })}
                    onBlur={() => { if (isEditing) void commit(item); }}
                    onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur(); }}
                  />
                ) : (
                  <span className="w-16 shrink-0 text-center font-medium">{qty}</span>
                )}
              </div>
            );
          })}
        </div>
      )}

      <Dialog open={confirmOpen} onOpenChange={setConfirmOpen}>
        <DialogContent dir="rtl" className="max-w-md">
          <DialogHeader>
            <DialogTitle>מחיקת רחפן {drone.serial}</DialogTitle>
          </DialogHeader>
          <p className="text-sm text-gray-700">
            כל הפריטים של הרחפן יוחזרו למלאי הגדוד. הפעולה תתועד ולא ניתן לבטל אותה.
          </p>
          <DialogFooter>
            <Button variant="outline" onClick={() => setConfirmOpen(false)}>ביטול</Button>
            <Button variant="destructive" onClick={confirmDelete} disabled={remove.isPending}>
              {remove.isPending ? 'מוחק…' : 'מחיקה'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

export default DroneCard;
