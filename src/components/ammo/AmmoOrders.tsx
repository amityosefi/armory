import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef } from "ag-grid-community";
import * as XLSX from 'xlsx';
import { Button } from "@/components/ui/button";

interface AmmoOrdersProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

type AmmoItem = {
    id?: string;
    תאריך: string;
    מקט?: string;
    פריט: string;
    כמות: number;
    צורך: string;
    סטטוס: string;
    משתמש: string;
    נקרא?: string;
    חתימה?: string;
    שם_החותם?: string;
    פלוגה: string;
    חתימת_מחתים?: string;
    created_at?: string;
    סוג_תחמושת?: string;
    is_explosion?: boolean;
};

const AmmoOrders: React.FC<AmmoOrdersProps> = ({ selectedSheet }) => {
    const { permissions } = usePermissions();
    const [ballData, setBallData] = useState<AmmoItem[]>([]);
    const [explosionData, setExplosionData] = useState<AmmoItem[]>([]);
    const [missingCompanies, setMissingCompanies] = useState<string[]>([]);
    const [loading, setLoading] = useState(true);

    const allCompanies = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם'];

    // Get today's date in d.m.yyyy format (Hebrew locale, no leading zeros)
    const getTodayDate = () => {
        const today = new Date();
        const day = today.getDate();
        const month = today.getMonth() + 1;
        const year = today.getFullYear();
        return `${day}.${month}.${year}`;
    };

    const fetchData = async () => {
        try {
            if (!permissions['ammo']) return;
            setLoading(true);
            const todayDate = getTodayDate();

            // Fetch all ammo data from unified table
            const { data: ammoData, error: ammoError } = await supabase
                .from('ammo')
                .select("*")
                .eq("סטטוס", "דיווח")
                .like("תאריך", `${todayDate}%`)
                .returns<AmmoItem[]>();

            if (ammoError) {
                console.error("Error fetching ammo data:", ammoError);
            }

            const allItems = ammoData || [];
            const ballItems = allItems.filter(item => !item.is_explosion);
            const explosionItems = allItems.filter(item => item.is_explosion);

            setBallData(ballItems);
            setExplosionData(explosionItems);

            // Find companies that reported
            const reportedCompanies = new Set<string>();
            [...ballItems, ...explosionItems].forEach(item => {
                if (item.פלוגה) {
                    reportedCompanies.add(item.פלוגה);
                }
            });

            // Find missing companies
            const missing = allCompanies.filter(company => !reportedCompanies.has(company));
            setMissingCompanies(missing);

        } catch (error) {
            console.error("Error fetching data:", error);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [selectedSheet]);

    // Export to Excel function
    const handleExportToExcel = () => {
        const todayDate = getTodayDate();
        
        // Prepare ball ammo data
        const ballExportData = ballData.map(item => ({
            'פלוגה': item.פלוגה,
            'פריט': item.פריט,
            'כמות': item.כמות,
            'צורך': item.צורך,
            'סוג': item.is_explosion ? 'נפיצה' : 'קליעית',
            'תאריך': item.תאריך
        }));

        // Prepare explosion ammo data
        const explosionExportData = explosionData.map(item => ({
            'פלוגה': item.פלוגה,
            'פריט': item.פריט,
            'כמות': item.כמות,
            'צורך': item.צורך,
            'סוג': item.is_explosion ? 'נפיצה' : 'קליעית',
            'תאריך': item.תאריך
        }));

        // Create workbook
        const wb = XLSX.utils.book_new();

        // Add ball ammo sheet
        if (ballExportData.length > 0) {
            const wsBall = XLSX.utils.json_to_sheet(ballExportData);
            XLSX.utils.book_append_sheet(wb, wsBall, 'תחמושת קליעית');
        }

        // Add explosion ammo sheet
        if (explosionExportData.length > 0) {
            const wsExplosion = XLSX.utils.json_to_sheet(explosionExportData);
            XLSX.utils.book_append_sheet(wb, wsExplosion, 'תחמושת נפיץ');
        }

        // Add missing companies sheet
        if (missingCompanies.length > 0) {
            const wsMissing = XLSX.utils.json_to_sheet(
                missingCompanies.map(company => ({ 'פלוגות שלא דיווחו': company }))
            );
            XLSX.utils.book_append_sheet(wb, wsMissing, 'פלוגות שלא דיווחו');
        }

        // Download file
        XLSX.writeFile(wb, `שצל_יומי_${todayDate.replace(/\./g, '_')}.xlsx`);
    };

    // Column definitions for ball ammo
    const ballColumnDefs: ColDef[] = [
        { field: "פלוגה", headerName: "פלוגה", sortable: true, filter: true, width: 100, cellStyle: { textAlign: 'center' } },
        { field: "פריט", headerName: "פריט", sortable: true, filter: true, width: 200, cellStyle: { textAlign: 'center' } },
        { field: "כמות", headerName: "כמות", sortable: true, filter: true, width: 80, cellStyle: { textAlign: 'center' } },
        { field: "צורך", headerName: "צורך", sortable: true, filter: true, width: 100, cellStyle: { textAlign: 'center' } },
        { 
            field: "is_explosion", 
            headerName: "סוג", 
            sortable: true, 
            filter: true, 
            width: 100,
            cellRenderer: (params: any) => params.value ? "נפיצה" : "קליעית",
            cellStyle: { textAlign: 'center' }
        },
        { field: "תאריך", headerName: "תאריך", sortable: true, filter: true, width: 150, cellStyle: { textAlign: 'center' } },
    ];

    // Column definitions for explosion ammo
    const explosionColumnDefs: ColDef[] = [
        { field: "פלוגה", headerName: "פלוגה", sortable: true, filter: true, width: 100, cellStyle: { textAlign: 'center' } },
        { field: "פריט", headerName: "פריט", sortable: true, filter: true, width: 200, cellStyle: { textAlign: 'center' } },
        { field: "כמות", headerName: "כמות", sortable: true, filter: true, width: 80, cellStyle: { textAlign: 'center' } },
        { field: "צורך", headerName: "צורך", sortable: true, filter: true, width: 100, cellStyle: { textAlign: 'center' } },
        { 
            field: "is_explosion", 
            headerName: "סוג", 
            sortable: true, 
            filter: true, 
            width: 100,
            cellRenderer: (params: any) => params.value ? "נפיצה" : "קליעית",
            cellStyle: { textAlign: 'center' }
        },
        { field: "תאריך", headerName: "תאריך", sortable: true, filter: true, width: 150, cellStyle: { textAlign: 'center' } },
    ];

    if (loading) {
        return <div className="p-4">טוען נתונים...</div>;
    }

    return (
        <div className="p-4 space-y-6">
            <div className="flex justify-between items-center">
                <h2 className="text-2xl font-bold">הזמנות תחמושת - {getTodayDate()}</h2>
                <Button 
                    onClick={handleExportToExcel}
                    className="bg-green-500 hover:bg-green-600 text-white"
                    disabled={ballData.length === 0 && explosionData.length === 0}
                >
                    הורדת שצל יומי
                </Button>
            </div>

            {/* Missing Companies Alert */}
            {missingCompanies.length > 0 && (
                <div className="bg-red-100 border border-red-400 text-red-700 px-4 py-3 rounded">
                    <strong className="font-bold">פלוגות שלא דיווחו: </strong>
                    <span>{missingCompanies.join(', ')}</span>
                </div>
            )}

            {/* Ball Ammo Table */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">תחמושת קליעית</h3>
                {ballData.length > 0 ? (
                    <div className="ag-theme-alpine" style={{ width: '750px' }}>
                        <AgGridReact
                            rowData={ballData}
                            columnDefs={ballColumnDefs}
                            defaultColDef={{
                                resizable: true,
                                sortable: true,
                                filter: true,
                            }}
                            domLayout="autoHeight"
                        />
                    </div>
                ) : (
                    <div className="text-gray-500 p-4 border rounded">אין דיווחים על תחמושת קליעית להיום</div>
                )}
            </div>

            {/* Explosion Ammo Table */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">תחמושת נפיץ</h3>
                {explosionData.length > 0 ? (
                    <div className="ag-theme-alpine" style={{ width: '750px' }}>
                        <AgGridReact
                            rowData={explosionData}
                            columnDefs={explosionColumnDefs}
                            defaultColDef={{
                                resizable: true,
                                sortable: true,
                                filter: true,
                            }}
                            domLayout="autoHeight"
                        />
                    </div>
                ) : (
                    <div className="text-gray-500 p-4 border rounded">אין דיווחים על תחמושת נפיץ להיום</div>
                )}
            </div>
        </div>
    );
};

export default AmmoOrders;
