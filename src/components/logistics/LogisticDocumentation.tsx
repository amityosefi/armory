import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef} from "ag-grid-community";
import {usePermissions} from "@/contexts/PermissionsContext";

type DocumentItem = {
    id?: string;
    created_at?: string;
    [key: string]: any;
};

const LogisticDocumentation: React.FC = () => {
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const gridRef = useRef<AgGridReact>(null);

    const parseHebrewDate = (dateStr: string): Date => {
        try {
            const parts = dateStr.split(', ');
            if (parts.length !== 2) return new Date(0);
            
            const timePart = parts[0];
            const datePart = parts[1];
            
            const dateComponents = datePart.split(/[\.\/ ]/);
            if (dateComponents.length !== 3) return new Date(0);
            
            const day = parseInt(dateComponents[0], 10);
            const month = parseInt(dateComponents[1], 10) - 1;
            const year = parseInt(dateComponents[2], 10);
            
            const timeComponents = timePart.split(':');
            if (timeComponents.length !== 3) return new Date(year, month, day);
            
            const hours = parseInt(timeComponents[0], 10);
            const minutes = parseInt(timeComponents[1], 10);
            const seconds = parseInt(timeComponents[2], 10);
            
            return new Date(year, month, day, hours, minutes, seconds);
        } catch (e) {
            return new Date(0);
        }
    };

    const fetchData = async () => {
        try {
            if (!permissions['logistic'] && !permissions['admin']) return;
            setLoading(true);
            
            let allData: any[] = [];
            let offset = 0;
            const chunkSize = 1000;
            let hasMore = true;

            while (hasMore) {
                const {data, error} = await supabase
                    .from("logistic")
                    .select("*")
                    .range(offset, offset + chunkSize - 1);

                if (error) {
                    console.error("Error fetching data:", error);
                    break;
                }

                if (data && data.length > 0) {
                    allData = [...allData, ...data];
                    offset += chunkSize;
                    hasMore = data.length === chunkSize;
                } else {
                    hasMore = false;
                }
            }

            const sortedData = allData.sort((a, b) => {
                const dateA = parseHebrewDate((a['תאריך'] as string) || '');
                const dateB = parseHebrewDate((b['תאריך'] as string) || '');
                return dateA.getTime() - dateB.getTime();
            });
            setRowData([...sortedData].reverse());

        } catch (err: any) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, []);

    const columnDefs = useMemo<ColDef<DocumentItem>[]>(() => {
        if (rowData.length === 0) return [];

        const keys = new Set<string>();
        rowData.forEach(row => {
            Object.keys(row).forEach(key => keys.add(key));
        });

        return Array.from(keys).map(key => {
            const baseConfig: ColDef<DocumentItem> = {
                field: key,
                headerName: key,
                sortable: true,
                filter: 'agTextColumnFilter',
                filterParams: {
                    filterOptions: ['contains'],
                    defaultOption: 'contains',
                    suppressAndOrCondition: true,
                },
            };

            if (key === 'תאריך') {
                baseConfig.comparator = (valueA: string, valueB: string) => {
                    const dateA = parseHebrewDate(valueA);
                    const dateB = parseHebrewDate(valueB);
                    return dateA.getTime() - dateB.getTime();
                };
            }

            if (key === 'משתמש') {
                return { ...baseConfig, width: 110 };
            } else if (key === 'תאריך') {
                return { ...baseConfig, width: 180 };
            } else if (key === 'הודעה') {
                return { ...baseConfig, width: 1000, cellStyle: {textAlign: 'right'} };
            } else {
                return { ...baseConfig, width: 100 };
            }
        });
    }, [rowData]);

    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'center'},
        resizable: true,
    };

    const getRowStyle = (params: any) => {
        if (params.node.rowIndex % 2 === 1) {
            return { background: '#e0f2fe' };
        }
        return undefined;
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-right">תיעוד</h2>
            </div>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[40vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-center p-4">טוען נתונים...</p>
                </div>
            ) : (
                <div 
                    className="ag-theme-alpine rtl" 
                    style={{height: "40vh", width: "100%", direction: "rtl"}}
                >
                    <AgGridReact
                        ref={gridRef}
                        rowData={rowData}
                        columnDefs={columnDefs}
                        defaultColDef={defaultColDef}
                        pagination={false}
                        enableRtl={true}
                        domLayout="normal"
                        rowSelection='multiple'
                        suppressRowClickSelection={true}
                        enableCellTextSelection={true}
                        ensureDomOrder={true}
                        getRowStyle={getRowStyle}
                        alwaysShowHorizontalScroll={false}
                        suppressHorizontalScroll={false}
                    />
                </div>
            )}
        </div>
    );
};

export default LogisticDocumentation;
