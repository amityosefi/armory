import { useMemo } from 'react';
import { DroneGuard } from '../DroneGuard';
import { useSumTabData } from '../hooks/useDroneData';
import { DRONE_LABEL, DRONE_TYPES, itemNamesFor } from '../types';
import type { DroneRow, DroneType, SumTotalRow } from '../types';

interface SectionProps {
  droneType: DroneType;
  totals: SumTotalRow[];
  drones: DroneRow[];
}

function TypeSection({ droneType, totals, drones }: SectionProps) {
  // Union the RPC's totals with the model's catalogue, so an item that is
  // neither signed nor in stock still shows as 0 rather than vanishing.
  const rows = useMemo<SumTotalRow[]>(() => {
    const byItem = new Map<string, SumTotalRow>();
    const seen: Record<string, number> = {};
    totals
      .filter((t) => t.drone_type === droneType)
      .forEach((t) => { byItem.set(t.item_name, t); seen[t.item_name] = t.total; });

    return itemNamesFor(droneType, seen).map(
      (item_name) =>
        byItem.get(item_name) ?? {
          drone_type: droneType, item_name, signed: 0, gadud: 0, total: 0,
        }
    );
  }, [totals, droneType]);
  const mine = useMemo(
    () => drones.filter((d) => d.drone_type === droneType),
    [drones, droneType]
  );

  return (
    <div className="bg-white border rounded-lg shadow-sm overflow-hidden">
      <div className="px-4 py-3 bg-gray-50 border-b">
        <h3 className="font-bold text-gray-800">
          {DRONE_LABEL[droneType]}{' '}
          <span className="text-sm font-normal text-gray-500">
            ({mine.length} רחפנים בחתימה)
          </span>
        </h3>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[32rem]">
          <thead>
            <tr className="text-gray-500 border-b">
              <th className="text-right font-medium px-4 py-2">שם פריט</th>
              <th className="text-center font-medium px-4 py-2 w-24">בחתימה</th>
              <th className="text-center font-medium px-4 py-2 w-24">גדוד</th>
              <th className="text-center font-medium px-4 py-2 w-24">סה"כ</th>
            </tr>
          </thead>
          <tbody>
            {rows.length === 0 ? (
              <tr>
                <td colSpan={4} className="px-4 py-4 text-center text-gray-500">
                  אין נתונים
                </td>
              </tr>
            ) : (
              rows.map((r, i) => (
                <tr
                  key={r.item_name}
                  className={`${i % 2 === 1 ? 'bg-sky-50' : ''} ${r.total === 0 ? 'text-gray-400' : ''}`}
                >
                  <td className="px-4 py-1.5 text-right">{r.item_name}</td>
                  <td className="px-4 py-1.5 text-center">{r.signed}</td>
                  <td className="px-4 py-1.5 text-center">{r.gadud}</td>
                  <td className="px-4 py-1.5 text-center font-bold">{r.total}</td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {mine.length > 0 && (
        <div className="overflow-x-auto border-t">
          <table className="w-full text-sm min-w-[32rem]">
            <thead>
              <tr className="text-gray-500 border-b bg-gray-50">
                <th className="text-right font-medium px-4 py-2">מספר סידורי</th>
                <th className="text-right font-medium px-4 py-2">מחזיק</th>
                <th className="text-center font-medium px-4 py-2 w-28">מספר אישי</th>
                <th className="text-center font-medium px-4 py-2 w-24">פלוגה</th>
              </tr>
            </thead>
            <tbody>
              {mine.map((d, i) => (
                <tr key={d.id} className={i % 2 === 1 ? 'bg-sky-50' : undefined}>
                  <td className="px-4 py-1.5 text-right font-mono">{d.serial}</td>
                  <td className="px-4 py-1.5 text-right">{d.holder_name}</td>
                  <td className="px-4 py-1.5 text-center">{d.location}</td>
                  <td className="px-4 py-1.5 text-center">{d.sheet_range}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}

function SumTabBody() {
  const query = useSumTabData();

  const totals = useMemo(() => query.data?.totals ?? [], [query.data]);
  const drones = useMemo(() => query.data?.drones ?? [], [query.data]);

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
        שגיאה בטעינת הסיכום: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4 space-y-6" dir="rtl">
      <h2 className="text-xl font-bold">סיכום רחפנים</h2>
      {DRONE_TYPES.map((type) => (
        <TypeSection key={type} droneType={type} totals={totals} drones={drones} />
      ))}
    </div>
  );
}

export function DroneSumTab() {
  return (
    <DroneGuard>
      <SumTabBody />
    </DroneGuard>
  );
}

export default DroneSumTab;
