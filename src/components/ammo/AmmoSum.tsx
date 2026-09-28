import React, {useMemo, useState, useEffect, useRef} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef} from "ag-grid-community";
import {Button} from '@/components/ui/button';
import * as XLSX from "xlsx";
import {usePermissions} from "@/contexts/PermissionsContext";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import { FileSpreadsheet } from 'lucide-react';
import {InventoryRow, Location} from "./types";

// Type for the summarized data table (rows = items, columns = locations, plus a total)
interface SummaryRow {
    [key: string]: number | string;

    item_name: string;
}

const sortLocations = (a: string, b: string) => {
    if (a === 'גדוד') return 1;
    if (b === 'גדוד') return -1;
    if (a === 'מחסן') return 1;
    if (b === 'מחסן') return -1;
    return a.localeCompare(b);
};

// Build the item x location pivot, with a "סה״כ" total column per row
const generateSummaryData = (locations: string[], items: string[], data: InventoryRow[]): SummaryRow[] => {
    return items.map(item => {
        const row: SummaryRow = {item_name: item};
        let rowTotal = 0;

        locations.forEach(location => {
            const record = data.find(r => r.item_name === item && r.location === location);
            const quantity = record?.quantity ?? 0;
            row[location] = quantity;
            rowTotal += quantity;
        });

        row["סה״כ"] = rowTotal;
        return row;
    });
};

const AmmoSum: React.FC = () => {
    const [ballData, setBallData] = useState<InventoryRow[]>([]);
    const [explosionData, setExplosionData] = useState<InventoryRow[]>([]);
    const [loading, setLoading] = useState(true);
    const {permissions} = usePermissions();
    const [uniqueLocationsBall, setUniqueLocationsBall] = useState<string[]>([]);
    const [uniqueLocationsExplosion, setUniqueLocationsExplosion] = useState<string[]>([]);
    const [summaryDataBall, setSummaryDataBall] = useState<SummaryRow[]>([]);
    const [summaryDataExplosion, setSummaryDataExplosion] = useState<SummaryRow[]>([]);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const ballGridRef = useRef<any>(null);
    const explosionGridRef = useRef<any>(null);

    // Fetch current inventory from Supabase
    const fetchData = async () => {
        if (permissions['logistic'] || permissions['admin']) {
            try {
                setLoading(true);

                const {data, error} = await supabase
                    .from("inventory")
                    .select("item_name, location, quantity, is_explosion");

                if (error) {
                    console.error("Error fetching inventory data:", error);
                    return;
                }

                const inventory = (data ?? []) as InventoryRow[];
                setBallData(inventory.filter(item => !item.is_explosion));
                setExplosionData(inventory.filter(item => item.is_explosion));
            } catch (err: any) {
                console.error("Unexpected error:", err);
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, []);

    // Process ball data
    useEffect(() => {
        if (ballData.length > 0) {
            const locations = Array.from(new Set(ballData.map(item => item.location))).sort(sortLocations);
            setUniqueLocationsBall(locations);

            const items = Array.from(new Set(ballData.map(item => item.item_name))).sort();

            setSummaryDataBall(generateSummaryData(locations, items, ballData));
        } else {
            setUniqueLocationsBall([]);
            setSummaryDataBall([]);
        }
    }, [ballData]);

    // Process explosion data
    useEffect(() => {
        if (explosionData.length > 0) {
            const locations = Array.from(new Set(explosionData.map(item => item.location))).sort(sortLocations);
            setUniqueLocationsExplosion(locations);

            const items = Array.from(new Set(explosionData.map(item => item.item_name))).sort();

            setSummaryDataExplosion(generateSummaryData(locations, items, explosionData));
        } else {
            setUniqueLocationsExplosion([]);
            setSummaryDataExplosion([]);
        }
    }, [explosionData]);

    // Shared column-def builder: an item column, one column per location, then a total column
    const buildColumnDefs = (locations: string[]): ColDef[] => {
        const columns: ColDef[] = [
            {
                field: 'item_name',
                headerName: 'פריט',
                sortable: true,
                filter: true,
                width: 150,
            }
        ];

        locations.forEach(location => {
            columns.push({
                field: location,
                headerName: location,
                sortable: true,
                filter: true,
                width: 120,
                valueFormatter: params => (params.value ?? 0).toString(),
                cellStyle: () => location === 'גדוד'
                    ? {fontWeight: 'normal', backgroundColor: '#fef9c3'}
                    : {fontWeight: 'normal', backgroundColor: 'transparent'},
            });
        });

        columns.push({
            field: 'סה״כ',
            headerName: 'סה״כ',
            sortable: true,
            filter: true,
            width: 120,
            valueFormatter: params => (params.value ?? 0).toString(),
            cellStyle: {fontWeight: 'bold', backgroundColor: 'transparent'},
        });

        return columns;
    };

    const ballColumnDefs = useMemo<ColDef[]>(() => buildColumnDefs(uniqueLocationsBall), [uniqueLocationsBall]);
    const explosionColumnDefs = useMemo<ColDef[]>(() => buildColumnDefs(uniqueLocationsExplosion), [uniqueLocationsExplosion]);

    // Every 2nd row gets a light-blue background for readability
    const zebraRowStyle = (params: any) => {
        if (params.rowIndex % 2 === 0) {
            return {backgroundColor: '#e6f2ff'};
        }
        return undefined;
    };

    // Export to Excel - exports summary data like ArmorySum
    const exportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();

            const buildExcelRows = (rows: SummaryRow[], locations: string[]) =>
                rows.map(row => {
                    const excelRow: any = {'פריט': row.item_name};
                    locations.forEach(location => {
                        excelRow[location] = row[location] || 0;
                    });
                    excelRow['סה״כ'] = row['סה״כ'] || 0;
                    return excelRow;
                });

            // Export Ball (קליעית) summary data
            if (summaryDataBall.length > 0) {
                const wsBall = XLSX.utils.json_to_sheet(buildExcelRows(summaryDataBall, uniqueLocationsBall));
                XLSX.utils.book_append_sheet(wb, wsBall, 'קליעית');
            }

            // Export Explosion (נפיצה) summary data
            if (summaryDataExplosion.length > 0) {
                const wsExplosion = XLSX.utils.json_to_sheet(buildExcelRows(summaryDataExplosion, uniqueLocationsExplosion));
                XLSX.utils.book_append_sheet(wb, wsExplosion, 'נפיצה');
            }

            const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
            XLSX.writeFile(wb, `סיכום_תחמושת_${today}.xlsx`);

            setStatusMessage({
                text: 'הקובץ הורד בהצלחה',
                type: 'success'
            });
        } catch (error: any) {
            console.error('Error exporting to Excel:', error);
            setStatusMessage({
                text: `שגיאה ביצירת קובץ Excel: ${error.message}`,
                type: 'error'
            });
        }
    };

    return (
        <div className="p-4">
            <StatusMessage
                isSuccess={statusMessage.type === 'success'}
                message={statusMessage.text}
                onClose={() => setStatusMessage({text: "", type: ""})}
            />

            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">סיכום תחמושת לפי פלוגות</h2>
                {(permissions['ammo'] && permissions['admin']) && (
                    <Button
                        onClick={exportToExcel}
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                        disabled={loading || (summaryDataBall.length === 0 && summaryDataExplosion.length === 0)}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        ייצוא ל-Excel
                    </Button>
                )}
            </div>

            {/* Ball Ammo Table */}
            <h3 className="text-xl font-bold mb-2 text-right">קליעית</h3>
            <div className="ag-theme-alpine mb-8" style={{height: '40vh', width: '100%', direction: 'rtl'}}>
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <p>טוען נתונים...</p>
                    </div>
                ) : ballData.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p>אין נתונים להצגה</p>
                    </div>
                ) : (
                    <AgGridReact
                        ref={ballGridRef}
                        rowData={summaryDataBall}
                        columnDefs={ballColumnDefs}
                        defaultColDef={{
                            resizable: true,
                            sortable: true,
                            filter: true
                        }}
                        enableRtl={true}
                        getRowStyle={zebraRowStyle}
                    />
                )}
            </div>

            {/* Explosion Ammo Table */}
            <h3 className="text-xl font-bold mb-2 text-right">נפיצה</h3>
            <div className="ag-theme-alpine" style={{height: '40vh', width: '100%', direction: 'rtl'}}>
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <p>טוען נתונים...</p>
                    </div>
                ) : explosionData.length === 0 ? (
                    <div className="flex justify-center items-center h-full">
                        <p>אין נתונים להצגה</p>
                    </div>
                ) : (
                    <AgGridReact
                        ref={explosionGridRef}
                        rowData={summaryDataExplosion}
                        columnDefs={explosionColumnDefs}
                        defaultColDef={{
                            resizable: true,
                            sortable: true,
                            filter: true
                        }}
                        enableRtl={true}
                        getRowStyle={zebraRowStyle}
                    />
                )}
            </div>
        </div>
    );
};

export default AmmoSum;