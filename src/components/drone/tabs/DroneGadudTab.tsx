import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { DroneGuard } from '../DroneGuard';
import { StockKitForm } from '../forms/StockKitForm';
import { useGadudTabData } from '../hooks/useDroneData';
import { useDronePermissions } from '../hooks/useDronePermissions';
import { DRONE_LABEL, DRONE_TYPES, itemNamesFor, stockFor } from '../types';
import type { DroneRow, DroneType } from '../types';

interface TableProps {
  droneType: DroneType;
  stock: DroneRow[];
  canEdit: boolean;
  onAdd: (type: DroneType) => void;
  onRemove: (type: DroneType) => void;
}

function StockTable({ droneType, stock, canEdit, onAdd, onRemove }: TableProps) {
  const row = stockFor(stock, droneType);
  const items = useMemo(() => row?.items ?? {}, [row]);
  // Union with the defaults so the full catalogue shows even at 0.
  const itemNames = useMemo(() => itemNamesFor(droneType, items), [droneType, items]);
  const total = itemNames.reduce((sum, n) => sum + (items[n] ?? 0), 0);

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="flex flex-wrap justify-between items-center gap-2 px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-800">
          {DRONE_LABEL[droneType]}{' '}
          <span className="text-sm font-normal text-gray-500">
            ({itemNames.length} סוגי פריטים, {total} יחידות)
          </span>
        </h3>
        {canEdit && (
          <div className="flex gap-2">
            <Button size="sm" onClick={() => onAdd(droneType)}>+ הוספת מלאי</Button>
            <Button size="sm" variant="outline" onClick={() => onRemove(droneType)}>
              - הוצאת מלאי
            </Button>
          </div>
        )}
      </div>

      {!row ? (
        <div className="p-4 text-sm text-red-700 bg-red-50">
          שורת מלאי הגדוד עבור {DRONE_LABEL[droneType]} חסרה — יש להריץ את המיגרציה.
        </div>
      ) : (
        <table className="w-full text-sm">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="text-right font-medium px-4 py-2">שם פריט</th>
              <th className="text-center font-medium px-4 py-2 w-28">כמות</th>
            </tr>
          </thead>
          <tbody>
            {itemNames.map((name, i) => {
              const qty = items[name] ?? 0;
              return (
                <tr key={name} className={i % 2 === 1 ? 'bg-sky-50' : undefined}>
                  <td className={`px-4 py-1.5 ${qty === 0 ? 'text-gray-400' : 'text-gray-800'}`}>
                    {name}
                  </td>
                  <td className={`px-4 py-1.5 text-center font-medium ${qty === 0 ? 'text-gray-400' : ''}`}>
                    {qty}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      )}
    </div>
  );
}

function GadudTabBody() {
  const { canEdit } = useDronePermissions();
  const query = useGadudTabData();

  const [kitForm, setKitForm] = useState<{ type: DroneType; sign: 1 | -1 } | null>(null);
  const [status, setStatus] = useState<{ message: string; isSuccess: boolean }>({
    message: '',
    isSuccess: true,
  });

  const stock = useMemo(() => query.data?.stock ?? [], [query.data]);

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
        שגיאה בטעינת מלאי הגדוד: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      <h2 className="text-xl font-bold">מלאי גדוד — רחפנים</h2>

      <StatusMessage
        isSuccess={status.isSuccess}
        message={status.message}
        onClose={() => setStatus({ message: '', isSuccess: true })}
      />


      {DRONE_TYPES.map((type) => (
        <StockTable
          key={type}
          droneType={type}
          stock={stock}
          canEdit={canEdit}
          onAdd={(t) => setKitForm({ type: t, sign: 1 })}
          onRemove={(t) => setKitForm({ type: t, sign: -1 })}
        />
      ))}

      {kitForm && (
        <StockKitForm
          droneType={kitForm.type}
          stock={stock}
          sign={kitForm.sign}
          open
          onOpenChange={(o) => { if (!o) setKitForm(null); }}
          onMessage={(message, isSuccess) => setStatus({ message, isSuccess })}
        />
      )}
    </div>
  );
}

export function DroneGadudTab() {
  return (
    <DroneGuard>
      <GadudTabBody />
    </DroneGuard>
  );
}

export default DroneGadudTab;
