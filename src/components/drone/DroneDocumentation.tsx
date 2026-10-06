import { useMemo, useRef } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import type { ColDef } from 'ag-grid-community';
import { DroneGuard } from './DroneGuard';
import { useDroneDocument } from './hooks/useDroneData';
import { DRONE_ACTION_LABEL } from './types';
import type { DroneAction, DroneDocumentRow, ItemMap } from './types';

/** "רחפן×1, סוללה×2" - a compact rendering of the items snapshot. */
function summarizeItems(items: ItemMap | null): string {
  if (!items) return '';
  return Object.entries(items)
    .map(([name, qty]) => `${name}×${qty}`)
    .join(', ');
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleString('he-IL', {
    day: '2-digit', month: '2-digit', year: 'numeric',
    hour: '2-digit', minute: '2-digit',
  });
}

function DocumentationBody() {
  const gridRef = useRef<AgGridReact<DroneDocumentRow>>(null);
  const query = useDroneDocument();

  const rowData = useMemo(() => query.data ?? [], [query.data]);

  const columnDefs = useMemo<ColDef<DroneDocumentRow>[]>(() => [
    {
      field: 'created_at', headerName: 'תאריך', width: 150,
      valueFormatter: (p) => (p.value ? formatDate(p.value as string) : ''),
      comparator: (a: string, b: string) =>
        new Date(a).getTime() - new Date(b).getTime(),
    },
    {
      field: 'action_type', headerName: 'פעולה', width: 130,
      valueFormatter: (p) => DRONE_ACTION_LABEL[p.value as DroneAction] ?? String(p.value ?? ''),
    },
    { field: 'drone_type', headerName: 'סוג', width: 90 },
    { field: 'serial', headerName: 'מספר סידורי', width: 130 },
    { field: 'sheet_range', headerName: 'פלוגה', width: 90 },
    { field: 'item_name', headerName: 'פריט', width: 200 },
    { field: 'delta', headerName: 'שינוי', width: 90 },
    { field: 'quantity_before', headerName: 'לפני', width: 80 },
    { field: 'quantity_after', headerName: 'אחרי', width: 80 },
    {
      colId: 'items', headerName: 'פריטים', width: 320,
      valueGetter: (p) => summarizeItems(p.data?.items ?? null),
      cellStyle: { textAlign: 'right' },
    },
    { field: 'holder_name', headerName: 'מחזיק', width: 140 },
    { field: 'holder_id', headerName: 'מספר אישי', width: 110 },
    { field: 'prev_holder_name', headerName: 'מחזיק קודם', width: 140 },
    { field: 'actor_name', headerName: 'בוצע ע"י', width: 140 },
    { field: 'note', headerName: 'הערה', width: 200, cellStyle: { textAlign: 'right' } },
  ], []);

  const defaultColDef = useMemo<ColDef<DroneDocumentRow>>(() => ({
    headerClass: 'ag-right-aligned-header',
    cellStyle: { textAlign: 'center' },
    sortable: true,
    resizable: true,
    filter: 'agTextColumnFilter',
    filterParams: {
      filterOptions: ['contains'],
      defaultOption: 'contains',
      suppressAndOrCondition: true,
    },
  }), []);

  if (query.isError) {
    return (
      <div className="p-6 text-center text-red-700 bg-red-50 border border-red-200 rounded" dir="rtl">
        שגיאה בטעינת התיעוד: {(query.error as Error).message}
      </div>
    );
  }

  return (
    <div className="container mx-auto p-4" dir="rtl">
      <div className="flex justify-between items-center mb-4">
        <h2 className="text-xl font-bold text-right">תיעוד רחפנים</h2>
      </div>

      {query.isLoading ? (
        <div className="flex flex-col items-center justify-center h-[40vh]">
          <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
          <p className="text-center p-4">טוען נתונים...</p>
        </div>
      ) : (
        <div className="ag-theme-alpine rtl" style={{ height: '60vh', width: '100%', direction: 'rtl' }}>
          <AgGridReact<DroneDocumentRow>
            ref={gridRef}
            rowData={rowData}
            columnDefs={columnDefs}
            defaultColDef={defaultColDef}
            enableRtl
            domLayout="normal"
            enableCellTextSelection
            ensureDomOrder
            getRowStyle={(p) =>
              (p.node.rowIndex ?? 0) % 2 === 1 ? { background: '#e0f2fe' } : undefined
            }
          />
        </div>
      )}
    </div>
  );
}

export function DroneDocumentation() {
  return (
    <DroneGuard>
      <DocumentationBody />
    </DroneGuard>
  );
}

export default DroneDocumentation;
