import React, {useMemo, useState, useEffect, useRef} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef} from "ag-grid-community";
import {Button} from '@/components/ui/button';
import * as XLSX from "xlsx";
import {usePermissions} from "@/contexts/PermissionsContext";

interface EquipmentSumProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

// Define the structure for our Ammo items in Supabase
type LogisticItem = {
    id?: string;
    תאריך: string;
    מקט?: string;
    פריט: string;
    כמות: number;
    צורך: string;
    הערה?: string;
    סטטוס: string;
    משתמש: string;
    נקרא?: string;
    חתימה?: string;
    שם_החותם?: string;
    פלוגה: string;
    חתימת_מחתים: string;
    created_at?: string;
    is_explosion?: boolean;
};

// Type for the summarized data table
interface SummaryRow {
    [key: string]: number | string;

    פריט: string;
}

const AmmoSum: React.FC<EquipmentSumProps> = ({selectedSheet}) => {
    const [ballData, setBallData] = useState<LogisticItem[]>([]);
    const [explosionData, setExplosionData] = useState<LogisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const {permissions} = usePermissions();
    const [uniqueCompaniesBall, setUniqueCompaniesBall] = useState<string[]>([]);
    const [uniqueItemsBall, setUniqueItemsBall] = useState<string[]>([]);
    const [uniqueCompaniesExplosion, setUniqueCompaniesExplosion] = useState<string[]>([]);
    const [uniqueItemsExplosion, setUniqueItemsExplosion] = useState<string[]>([]);
    const [summaryDataBall, setSummaryDataBall] = useState<SummaryRow[]>([]);
    const [summaryDataExplosion, setSummaryDataExplosion] = useState<SummaryRow[]>([]);
    const ballGridRef = useRef<any>(null);
    const explosionGridRef = useRef<any>(null);

    // Fetch all logistic data from Supabase
    const fetchData = async () => {
        if (permissions['logistic']) {
            try {
                setLoading(true);
                
                // Fetch all ammo data from unified table
                const ammoResponse = await supabase
                    .from("ammo")
                    .select("*")
                    .eq("סטטוס", "החתמה"); // We only want items with status "החתמה"

                if (ammoResponse.error) {
                    console.error("Error fetching ammo data:", ammoResponse.error);
                } else {
                    // @ts-ignore
                    const allData = ammoResponse.data || [];
                    // Split data by is_explosion flag
                    setBallData(allData.filter((item: LogisticItem) => !item.is_explosion));
                    setExplosionData(allData.filter((item: LogisticItem) => item.is_explosion));
                }
                
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
            // Get unique companies (פלוגה)
            const companiesSet = new Set<string>();
            ballData.forEach(item => {
                if (item.פלוגה) {
                    companiesSet.add(item.פלוגה);
                }
            });
            const companies = Array.from(companiesSet).sort();
            setUniqueCompaniesBall(companies);

            // Get unique items (פריט)
            const itemsSet = new Set<string>();
            ballData.forEach(item => {
                if (item.פריט) {
                    itemsSet.add(item.פריט);
                }
            });
            const items = Array.from(itemsSet).sort();
            setUniqueItemsBall(items);

            // Generate summary data
            generateSummaryData(companies, items, ballData, setSummaryDataBall);
        }
    }, [ballData]);

    // Process explosion data
    useEffect(() => {
        if (explosionData.length > 0) {
            // Get unique companies (פלוגה)
            const companiesSet = new Set<string>();
            explosionData.forEach(item => {
                if (item.פלוגה) {
                    companiesSet.add(item.פלוגה);
                }
            });
            const companies = Array.from(companiesSet).sort();
            setUniqueCompaniesExplosion(companies);

            // Get unique items (פריט)
            const itemsSet = new Set<string>();
            explosionData.forEach(item => {
                if (item.פריט) {
                    itemsSet.add(item.פריט);
                }
            });
            const items = Array.from(itemsSet).sort();
            setUniqueItemsExplosion(items);

            // Generate summary data
            generateSummaryData(companies, items, explosionData, setSummaryDataExplosion);
        }
    }, [explosionData]);

    // Generate summary data for the 2D grid
    const generateSummaryData = (
        companies: string[], 
        items: string[], 
        data: LogisticItem[], 
        setData: React.Dispatch<React.SetStateAction<SummaryRow[]>>
    ) => {
        const summaryRows: SummaryRow[] = [];

        // For each unique item
        items.forEach(item => {
            // Create a new row with the item name
            const row: SummaryRow = {פריט: item};

            // For each company, calculate the sum of quantities for this item
            companies.forEach(company => {
                // Find all records for this item in this company
                const records = data.filter(record =>
                    record.פריט === item && record.פלוגה === company
                );

                // Sum up quantities (decrease when צורך === 'זיכוי')
                let totalQuantity = 0;
                records.forEach(record => {
                    // Handle any potential non-numeric values
                    const qty = typeof record.כמות === 'number'
                        ? record.כמות
                        : parseFloat(String(record.כמות)) || 0;
                    const signed = record.צורך === 'זיכוי' ? -Math.abs(qty) : Math.abs(qty);
                    totalQuantity += signed;
                });

                // Add the total quantity to the row
                row[company] = totalQuantity;
            });

            // Add a "סה״כ" (total) column
            let rowTotal = 0;
            companies.forEach(company => {
                rowTotal += (row[company] as number) || 0;
            });
            row["סה״כ"] = rowTotal;

            // Add the row to our summary data
            summaryRows.push(row);
        });

        // Set the summary data
        setData(summaryRows);
    };

    // Define column definitions for AG Grid for ball data
    const ballColumnDefs = useMemo<ColDef[]>(() => {
        const columns: ColDef[] = [
            {
                field: 'פריט',
                headerName: 'פריט',
                sortable: true,
                filter: true,
                width: 150,
                cellStyle: params => {
                    if (params.data && params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2'};
                    }
                    return null;
                }
            }
        ];

        // Add a column for each company
        uniqueCompaniesBall.forEach(company => {
            columns.push({
                field: company,
                headerName: company,
                sortable: true,
                filter: true,
                width: 120,
                valueFormatter: params => {
                    if (params.value !== undefined && params.value !== null) {
                        return params.value.toString();
                    }
                    return '0';
                },
                cellStyle: params => {
                    if (params.data && params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2'};
                    }
                    return null;
                }
            });
        });

        // Add total column
        columns.push({
            field: 'סה״כ',
            headerName: 'סה״כ',
            sortable: true,
            filter: true,
            width: 120,
            valueFormatter: params => {
                if (params.value !== undefined && params.value !== null) {
                    return params.value.toString();
                }
                return '0';
            },
            cellStyle: params => {
                if (params.data) {
                    if (params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#e6e6e6'};
                    } else {
                        return {fontWeight: 'bold', backgroundColor: 'transparent'};
                    }
                }
                return null;
            }
        });

        return columns;
    }, [uniqueCompaniesBall]);

    // Define column definitions for AG Grid for explosion data
    const explosionColumnDefs = useMemo<ColDef[]>(() => {
        const columns: ColDef[] = [
            {
                field: 'פריט',
                headerName: 'פריט',
                sortable: true,
                filter: true,
                width: 150,
                cellStyle: params => {
                    if (params.data && params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2'};
                    }
                    return null;
                }
            }
        ];

        // Add a column for each company
        uniqueCompaniesExplosion.forEach(company => {
            columns.push({
                field: company,
                headerName: company,
                sortable: true,
                filter: true,
                width: 120,
                valueFormatter: params => {
                    if (params.value !== undefined && params.value !== null) {
                        return params.value.toString();
                    }
                    return '0';
                },
                cellStyle: params => {
                    if (params.data && params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2'};
                    }
                    return null;
                }
            });
        });

        // Add total column
        columns.push({
            field: 'סה״כ',
            headerName: 'סה״כ',
            sortable: true,
            filter: true,
            width: 120,
            valueFormatter: params => {
                if (params.value !== undefined && params.value !== null) {
                    return params.value.toString();
                }
                return '0';
            },
            cellStyle: params => {
                if (params.data) {
                    if (params.data.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#e6e6e6'};
                    } else {
                        return {fontWeight: 'bold', backgroundColor: 'transparent'};
                    }
                }
                return null;
            }
        });

        return columns;
    }, [uniqueCompaniesExplosion]);

    // Export to Excel - includes both datasets
    const exportToExcel = () => {
        if (!ballGridRef.current && !explosionGridRef.current) return;

        // Create a new workbook
        const wb = XLSX.utils.book_new();
        
        // Create worksheets for each dataset
        if (ballData.length > 0) {
            const wsBall = XLSX.utils.json_to_sheet(ballData);
            XLSX.utils.book_append_sheet(wb, wsBall, "קליעית");
        }
        
        if (explosionData.length > 0) {
            const wsExplosion = XLSX.utils.json_to_sheet(explosionData);
            XLSX.utils.book_append_sheet(wb, wsExplosion, "נפיצה");
        }

        // Generate a download of the excel file
        XLSX.writeFile(wb, "סיכום תחמושת.xlsx");
    };

    return (
        <div className="p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-2xl font-bold">סיכום תחמושת לפי פלוגות</h2>
                <Button
                    onClick={exportToExcel}
                    disabled={loading || (summaryDataBall.length === 0 && summaryDataExplosion.length === 0)}
                >
                    ייצא לאקסל
                </Button>
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
                        getRowStyle={(params) => {
                            if (params.rowIndex % 2 === 0) {
                                return { backgroundColor: '#e6f2ff' };
                            }
                            return undefined;
                        }}
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
                        getRowStyle={(params) => {
                            if (params.rowIndex % 2 === 0) {
                                return { backgroundColor: '#e6f2ff' };
                            }
                            return undefined;
                        }}
                    />
                )}
            </div>
        </div>
    );
};

export default AmmoSum;
