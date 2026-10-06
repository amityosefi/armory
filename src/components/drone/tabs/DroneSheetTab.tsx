import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { DroneGuard } from '../DroneGuard';
import { DroneTypeCards } from '../DroneTypeCards';
import { DroneCard } from '../DroneCard';
import { SignDroneForm } from '../forms/SignDroneForm';
import { ChangeHolderForm } from '../forms/ChangeHolderForm';
import { useSheetTabData } from '../hooks/useDroneData';
import { useDronePermissions } from '../hooks/useDronePermissions';
import { DRONE_LABEL } from '../types';
import type { DroneRow, DroneType } from '../types';

interface Props {
  sheetRange: string;
}

function SheetTabBody({ sheetRange }: Props) {
  const { canEdit } = useDronePermissions();
  const query = useSheetTabData(sheetRange);

  const [selected, setSelected] = useState<DroneType | null>(null);
  const [signOpen, setSignOpen] = useState(false);
  const [reassigning, setReassigning] = useState<DroneRow | null>(null);
  const [status, setStatus] = useState<{ message: string; isSuccess: boolean }>({
    message: '',
    isSuccess: true,
  });

  const drones = useMemo(() => query.data?.drones ?? [], [query.data]);
  const stock = useMemo(() => query.data?.stock ?? [], [query.data]);
  const people = useMemo(() => query.data?.people ?? [], [query.data]);

  const counts = useMemo(() => {
    const c = { EVO: 0, AVATA: 0 } as Record<DroneType, number>;
    drones.forEach((d) => { c[d.drone_type] = (c[d.drone_type] ?? 0) + 1; });
    return c;
  }, [drones]);

  const visible = useMemo(
    () => (selected ? drones.filter((d) => d.drone_type === selected) : []),
    [drones, selected]
  );

  const onMessage = (message: string, isSuccess: boolean) =>
    setStatus({ message, isSuccess });

  if (query.isLoading) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="text-center p-4">טוען נתונים...</p>
      </div>
    );
  }

  if (query.isError) {
    return (
      <div className="p-6 text-center text-red-700 bg-red-50 border border-red-200 rounded" dir="rtl">
        שגיאה בטעינת נתוני הרחפנים: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">
      <StatusMessage
        isSuccess={status.isSuccess}
        message={status.message}
        onClose={() => setStatus({ message: '', isSuccess: true })}
      />

      {selected === null ? (
        <>
          <h2 className="text-xl font-bold text-center">בחר סוג רחפן</h2>
          <DroneTypeCards counts={counts} onSelect={setSelected} />
        </>
      ) : (
        <>
          <div className="flex flex-wrap justify-between items-center gap-2 mb-4">
            <div className="flex items-center gap-3">
              <Button variant="outline" size="sm" onClick={() => setSelected(null)}>
                ← חזרה לבחירת סוג
              </Button>
              <h2 className="text-xl font-bold">
                {DRONE_LABEL[selected]} — פלוגה {sheetRange} ({visible.length})
              </h2>
            </div>
            {canEdit && (
              <Button onClick={() => setSignOpen(true)}>החתמת רחפן</Button>
            )}
          </div>

          {visible.length === 0 ? (
            <div className="p-6 text-center text-gray-500 bg-gray-50 border rounded">
              אין רחפני {DRONE_LABEL[selected]} בחתימה בפלוגה {sheetRange}
            </div>
          ) : (
            <div className="space-y-4">
              {visible.map((d) => (
                <DroneCard
                  key={d.id}
                  drone={d}
                  onReassign={setReassigning}
                  onMessage={onMessage}
                />
              ))}
            </div>
          )}

          <SignDroneForm
            droneType={selected}
            sheetRange={sheetRange}
            people={people}
            stock={stock}
            open={signOpen}
            onOpenChange={setSignOpen}
            onMessage={onMessage}
          />
        </>
      )}

      <ChangeHolderForm
        drone={reassigning}
        people={people}
        open={reassigning !== null}
        onOpenChange={(o) => { if (!o) setReassigning(null); }}
        onMessage={onMessage}
      />
    </div>
  );
}

export function DroneSheetTab({ sheetRange }: Props) {
  return (
    <DroneGuard>
      {/* Remount on company change so the type selection does not leak across tabs. */}
      <SheetTabBody key={sheetRange} sheetRange={sheetRange} />
    </DroneGuard>
  );
}

export default DroneSheetTab;
