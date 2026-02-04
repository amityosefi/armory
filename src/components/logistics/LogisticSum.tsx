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
};

// Type for the summarized data table
interface SummaryRow {
    [key: string]: number | string;

    פריט: string;
}

const LogisticSum: React.FC<EquipmentSumProps> = ({selectedSheet}) => {
    const [logisticData, setLogisticData] = useState<LogisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const {permissions} = usePermissions();
    const [uniqueCompanies, setUniqueCompanies] = useState<string[]>([]);
    const [uniqueItems, setUniqueItems] = useState<string[]>([]);
    const [summaryData, setSummaryData] = useState<SummaryRow[]>([]);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const gridRef = useRef<any>(null);

    // Fetch all logistic data from Supabase
    const fetchData = async () => {
        if (permissions['logistic'] || permissions['admin']) {
            try {
                setLoading(true);
                
                // Fetch data in chunks of 1000
                let allData: LogisticItem[] = [];
                let offset = 0;
                const chunkSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const {data, error} = await supabase
                        .from("logistic")
                        .select("*")
                        .eq("סטטוס", "החתמה")
                        .range(offset, offset + chunkSize - 1);

                    if (error) {
                        console.error("Error fetching data:", error);
                        break;
                    }

                    if (data && data.length > 0) {
                        // @ts-ignore
                        allData = [...allData, ...(data as LogisticItem[])];
                        offset += chunkSize;
                        hasMore = data.length === chunkSize;
                    } else {
                        hasMore = false;
                    }
                }

                // @ts-ignore
                setLogisticData(allData);

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

    // Extract unique companies and items
    useEffect(() => {
        if (logisticData.length > 0) {
            // Get unique companies (פלוגה)
            const companiesSet = new Set<string>();
            logisticData.forEach(item => {
                if (item.פלוגה) {
                    companiesSet.add(item.פלוגה);
                }
            });
            // Sort companies with גדוד and מחסן at the end (before סה״כ)
            const companies = Array.from(companiesSet).sort((a, b) => {
                if (a === 'גדוד') return 1;
                if (b === 'גדוד') return -1;
                if (a === 'מחסן') return 1;
                if (b === 'מחסן') return -1;
                return a.localeCompare(b);
            });
            setUniqueCompanies(companies);

            // Get unique items (פריט)
            const itemsSet = new Set<string>();
            logisticData.forEach(item => {
                if (item.פריט) {
                    itemsSet.add(item.פריט);
                }
            });
            const items = Array.from(itemsSet).sort();
            setUniqueItems(items);

            // Generate summary data
            generateSummaryData(companies, items);
        }
    }, [logisticData]);

    // Generate summary data for the 2D grid
    const generateSummaryData = (companies: string[], items: string[]) => {
        const summaryRows: SummaryRow[] = [];

        // For each unique item
        items.forEach(item => {
            // Create a new row with the item name
            const row: SummaryRow = {פריט: item};

            // For each company, calculate the sum of quantities for this item
            companies.forEach(company => {
                // Find all records for this item in this company
                const records = logisticData.filter(record =>
                    record.פריט === item && record.פלוגה === company
                );

                // Sum up quantities
                let totalQuantity = 0;
                records.forEach(record => {
                    // Handle any potential non-numeric values
                    const quantity = typeof record.כמות === 'number' ?
                        record.כמות : parseFloat(String(record.כמות)) || 0;
                    // If צורך is זיכוי, count as negative
                    const adjustedQuantity = record.צורך === 'זיכוי' ? -quantity : quantity;
                    totalQuantity += adjustedQuantity;
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

        // // Add a total row at the bottom
        // const totalRow: SummaryRow = { פריט: "סה״כ" };
        // companies.forEach(company => {
        //     let columnTotal = 0;
        //     summaryRows.forEach(row => {
        //         columnTotal += (row[company] as number) || 0;
        //     });
        //     totalRow[company] = columnTotal;
        // });

        // // Calculate grand total
        // let grandTotal = 0;
        // companies.forEach(company => {
        //     grandTotal += (totalRow[company] as number) || 0;
        // });
        // totalRow["סה״כ"] = grandTotal;
        //
        // summaryRows.push(totalRow);
        setSummaryData(summaryRows);
    };

    // Define AG Grid columns dynamically based on unique companies
    const columnDefs = useMemo<ColDef[]>(() => {
        if (uniqueCompanies.length === 0) return [];

        const columns: ColDef[] = [
            {
                field: 'פריט',
                headerName: 'פריט',
                sortable: true,
                filter: true,
                pinned: 'right',
                width: 150,
                cellStyle: params => {
                    if (params.data?.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2'};
                    }
                    return null;
                }
            }
        ];

        // Add a column for each company
        uniqueCompanies.forEach(company => {
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
                    if (params.data?.פריט === 'סה״כ') {
                        return {fontWeight: 'bold', backgroundColor: '#f2f2f2', textAlign: 'center'};
                    }
                    // Yellow background for גדוד column
                    if (company === 'גדוד') {
                        return {textAlign: 'center', fontWeight: 'normal', backgroundColor: '#fef9c3'};
                    }
                    return {textAlign: 'center', fontWeight: 'normal', backgroundColor: 'transparent'};
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
                if (params.data?.פריט === 'סה״כ') {
                    return {fontWeight: 'bold', backgroundColor: '#e6e6e6', textAlign: 'center'};
                }
                return {fontWeight: 'bold', backgroundColor: 'transparent', textAlign: 'center'};
            }
        });

        return columns;
    }, [uniqueCompanies]);

    // Export to Excel - exports summary data like ArmorySum
    const exportToExcel = () => {
        try {
            const wb = XLSX.utils.book_new();
            
            if (summaryData.length > 0) {
                const excelData = summaryData.map(row => {
                    const excelRow: any = { 'פריט': row.פריט };
                    
                    // Add all company columns
                    uniqueCompanies.forEach(company => {
                        excelRow[company] = row[company] || 0;
                    });
                    
                    // Add total
                    excelRow['סה״כ'] = row['סה״כ'] || 0;
                    
                    return excelRow;
                });
                
                const ws = XLSX.utils.json_to_sheet(excelData);
                XLSX.utils.book_append_sheet(wb, ws, 'לוגיסטיקה');
            }
            
            const today = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
            XLSX.writeFile(wb, `סיכום_לוגיסטיקה_${today}.xlsx`);
            
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
                <h2 className="text-2xl font-bold">סיכום ציוד לפי פלוגות</h2>
                {(permissions['logistic'] && permissions['admin']) && (
                    <Button
                        onClick={exportToExcel}
                        className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2"
                        disabled={loading || summaryData.length === 0}
                    >
                        <FileSpreadsheet className="w-4 h-4" />
                        ייצוא ל-Excel
                    </Button>
                )}
            </div>

            <div className="ag-theme-alpine" style={{height: '40vh', width: '100%', direction: 'rtl'}}>
                {loading ? (
                    <div className="flex justify-center items-center h-full">
                        <p>טוען נתונים...</p>
                    </div>
                ) : (
                    <AgGridReact
                        ref={gridRef}
                        rowData={summaryData}
                        columnDefs={columnDefs}
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

export default LogisticSum;
