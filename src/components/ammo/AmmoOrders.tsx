import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { usePermissions } from "@/contexts/PermissionsContext";
import { AgGridReact } from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import { ColDef } from "ag-grid-community";

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

    // Get today's date in dd.mm.yyyy format (Hebrew locale)
    const getTodayDate = () => {
        const today = new Date();
        const day = String(today.getDate()).padStart(2, '0');
        const month = String(today.getMonth() + 1).padStart(2, '0');
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

    // Column definitions for ball ammo
    const ballColumnDefs: ColDef[] = [
        { field: "פלוגה", headerName: "פלוגה", sortable: true, filter: true, width: 120 },
        { field: "פריט", headerName: "פריט", sortable: true, filter: true, flex: 1 },
        { field: "כמות", headerName: "כמות", sortable: true, filter: true, width: 100 },
        { field: "צורך", headerName: "צורך", sortable: true, filter: true, width: 120 },
        { field: "משתמש", headerName: "משתמש", sortable: true, filter: true, width: 150 },
        { field: "תאריך", headerName: "תאריך", sortable: true, filter: true, width: 180 },
    ];

    // Column definitions for explosion ammo
    const explosionColumnDefs: ColDef[] = [
        { field: "פלוגה", headerName: "פלוגה", sortable: true, filter: true, width: 120 },
        { field: "פריט", headerName: "פריט", sortable: true, filter: true, flex: 1 },
        { field: "כמות", headerName: "כמות", sortable: true, filter: true, width: 100 },
        { field: "צורך", headerName: "צורך", sortable: true, filter: true, width: 120 },
        { field: "משתמש", headerName: "משתמש", sortable: true, filter: true, width: 150 },
        { field: "תאריך", headerName: "תאריך", sortable: true, filter: true, width: 180 },
    ];

    if (loading) {
        return <div className="p-4">טוען נתונים...</div>;
    }

    return (
        <div className="p-4 space-y-6">
            <h2 className="text-2xl font-bold">הזמנות תחמושת - {getTodayDate()}</h2>

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
                    <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
                        <AgGridReact
                            rowData={ballData}
                            columnDefs={ballColumnDefs}
                            defaultColDef={{
                                resizable: true,
                                sortable: true,
                                filter: true,
                            }}
                            domLayout="autoHeight"
                            pagination={true}
                            paginationPageSize={20}
                        />
                    </div>
                ) : (
                    <div className="text-gray-500 p-4 border rounded">אין דיווחים על תחמושת קליעית להיום</div>
                )}
            </div>

            {/* Explosion Ammo Table */}
            <div className="space-y-2">
                <h3 className="text-xl font-semibold">תחמושת נפץ</h3>
                {explosionData.length > 0 ? (
                    <div className="ag-theme-alpine" style={{ height: 400, width: '100%' }}>
                        <AgGridReact
                            rowData={explosionData}
                            columnDefs={explosionColumnDefs}
                            defaultColDef={{
                                resizable: true,
                                sortable: true,
                                filter: true,
                            }}
                            domLayout="autoHeight"
                            pagination={true}
                            paginationPageSize={20}
                        />
                    </div>
                ) : (
                    <div className="text-gray-500 p-4 border rounded">אין דיווחים על תחמושת נפץ להיום</div>
                )}
            </div>
        </div>
    );
};

export default AmmoOrders;
