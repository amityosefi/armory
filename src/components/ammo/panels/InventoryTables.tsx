import { useMemo } from 'react';
import { AgGridReact } from 'ag-grid-react';
import 'ag-grid-community/styles/ag-grid.css';
import 'ag-grid-community/styles/ag-theme-alpine.css';
import { ColDef } from 'ag-grid-community';
import { InventoryRow } from '../types';

interface Props {
  inventory: InventoryRow[];
}

const columns: ColDef[] = [
  { headerName: 'פריט', field: 'item_name', flex: 1, sortable: true, filter: true, minWidth: 60 },
  { headerName: "סה\"כ כמות", field: 'quantity', width: 90, sortable: true, filter: 'agNumberColumnFilter' },
];

function InventoryGrid({ rows, label }: { rows: InventoryRow[]; label: string }) {
  return (
    <div className="w-full max-w-xs">
      <h4 className="font-semibold mb-1 text-sm">{label}</h4>
      <div className="ag-theme-alpine overflow-hidden" style={{ direction: 'rtl', width: '100%' }}>
        <AgGridReact
          rowData={rows}
          columnDefs={columns}
          enableRtl
          domLayout="autoHeight"
          overlayNoRowsTemplate="אין פריטים"
          rowHeight={32}
          headerHeight={32}
          suppressHorizontalScroll={false}
          getRowStyle={(params) => {
            if (params.rowIndex % 2 === 0) {
              return { backgroundColor: '#e6f2ff' };
            }
            return undefined;
          }}
        />
      </div>
    </div>
  );
}

export function InventoryTables({ inventory }: Props) {
  const ball = useMemo(
    () => inventory.filter((r) => !r.is_explosion && r.quantity > 0),
    [inventory]
  );
  const explosion = useMemo(
    () => inventory.filter((r) => r.is_explosion && r.quantity > 0),
    [inventory]
  );

  return (
    <div className="flex flex-wrap gap-4" dir="rtl">
      <InventoryGrid rows={ball} label="קליעית" />
      <InventoryGrid rows={explosion} label="נפיצה" />
    </div>
  );
}

export default InventoryTables;
