import { useMemo, useState } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ColDef } from 'ag-grid-community';
import { ACTION_LABEL, ChangeLogRow } from '../types';

interface Props {
  rows: ChangeLogRow[];
}

export function ChangeLogGrid({ rows }: Props) {
  const [open, setOpen] = useState(false);

  const columns: ColDef[] = useMemo(
    () => [
      {
        headerName: 'זמן',
        field: 'created_at',
        width: 150,
        minWidth: 130,
        valueFormatter: (p) => {
          if (!p.value) return '';
          const d = new Date(p.value);
          const hh = String(d.getHours()).padStart(2, '0');
          const mm = String(d.getMinutes()).padStart(2, '0');
          const dd = String(d.getDate()).padStart(2, '0');
          const mo = String(d.getMonth() + 1).padStart(2, '0');
          return `${hh}:${mm} ${dd}-${mo}-${d.getFullYear()}`;
        },
      },
      {
        headerName: 'פעולה',
        field: 'action_type',
        width: 130,
        minWidth: 110,
        valueFormatter: (p) => {
          if (p.value === 'sign_to_group') {
            return p.data.delta > 0 ? 'החתמה' : 'זיכוי';
          }
          return ACTION_LABEL[p.value as keyof typeof ACTION_LABEL] ?? p.value;
        },
      },
      { headerName: 'פריט', field: 'item_name', flex: 1, minWidth: 100 },
      { headerName: 'מ-', field: 'from_location', width: 80, minWidth: 60 },
      { headerName: 'אל-', field: 'to_location', width: 80, minWidth: 60 },
      { headerName: 'שינוי', field: 'delta', width: 80, minWidth: 60 },
      { headerName: 'יתרה', field: 'quantity_after_from', width: 100, minWidth: 80 },
      { headerName: 'משתמש', field: 'actor_name', width: 130, minWidth: 110 },
    ],
    []
  );

  return (
    <div>
      <button
        type="button"
        className="flex items-center gap-1 text-sm text-blue-600 hover:text-blue-800 font-medium"
        onClick={() => setOpen((v) => !v)}
      >
        <span>{open ? '▼' : '◀'}</span>
        <span>יומן שינויים ({rows.length})</span>
      </button>

      {open && (
        <div className="ag-theme-alpine mt-2" style={{ direction: 'rtl' }} dir="rtl">
          <AgGridReact
            rowData={rows}
            columnDefs={columns}
            enableRtl
            domLayout="autoHeight"
            rowHeight={36}
            headerHeight={36}
            overlayNoRowsTemplate="אין רישומים"
          />
        </div>
      )}
    </div>
  );
}

export default ChangeLogGrid;
