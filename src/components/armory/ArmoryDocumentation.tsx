import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef, IServerSideDatasource} from "ag-grid-community";
import {usePermissions} from "@/contexts/PermissionsContext";
import {Button} from "@/components/ui/button";
import {X} from "lucide-react";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";


type DocumentItem = {
    id?: string;
    created_at?: string;
    [key: string]: any; // Allow dynamic fields from the table
};

const ArmoryDocumentation: React.FC = () => {
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<DocumentItem[]>([]);
    const [loading, setLoading] = useState(true);
    const gridRef = useRef<AgGridReact>(null);
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [newMessage, setNewMessage] = useState('');
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });

    // Helper function to parse Hebrew locale date string to Date object
    const parseHebrewDate = (dateStr: string): Date => {
        try {
            // Hebrew format: "hh:mm:ss, dd.mm.yyyy" or "hh:mm:ss, dd/mm/yyyy"
            const parts = dateStr.split(', ');
            if (parts.length !== 2) return new Date(0);
            
            const timePart = parts[0]; // "hh:mm:ss"
            const datePart = parts[1]; // "dd.mm.yyyy" or "dd/mm/yyyy"
            
            // Parse date part (handle both . and / separators)
            const dateComponents = datePart.split(/[\.\/ ]/);
            if (dateComponents.length !== 3) return new Date(0);
            
            const day = parseInt(dateComponents[0], 10);
            const month = parseInt(dateComponents[1], 10) - 1; // Month is 0-indexed
            const year = parseInt(dateComponents[2], 10);
            
            // Parse time part
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

    // Fetch data from Supabase
    const fetchData = async () => {
        try {
            if (!permissions['Armory']) return;
            setLoading(true);
            const {data, error} = await supabase
                .from("armory_document")
                .select("*");

            if (error) {
                console.error("Error fetching data:", error);
            } else {
                // Sort data by date in ascending order (oldest first)
                const sortedData = (data || []).sort((a, b) => {
                    const dateA = parseHebrewDate((a['תאריך'] as string) || '');
                    const dateB = parseHebrewDate((b['תאריך'] as string) || '');
                    return dateA.getTime() - dateB.getTime(); // Ascending order
                });
                setRowData(sortedData);
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
        } finally {
            setLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, []);

    const handleInsertRow = async () => {
        if (!newMessage.trim()) {
            setStatusMessage({ text: 'נא להזין הודעה', isSuccess: false });
            return;
        }

        try {
            const { error } = await supabase
                .from("armory_document")
                .insert([{
                    תאריך: new Date().toLocaleString('he-IL'),
                    משתמש: permissions['name'],
                    הודעה: newMessage
                }]);

            if (error) {
                setStatusMessage({ text: `שגיאה: ${error.message}`, isSuccess: false });
            } else {
                setNewMessage('');
                setIsModalOpen(false);
                fetchData(); // Refresh the grid
                // Show success message after modal closes
                setStatusMessage({ text: 'הרשומה נוספה בהצלחה', isSuccess: true });
            }
        } catch (err: any) {
            setStatusMessage({ text: `שגיאה: ${err.message}`, isSuccess: false });
        }
    };

    // AG Grid column definitions - will auto-generate based on data
    const columnDefs = useMemo<ColDef<DocumentItem>[]>(() => {
        if (rowData.length === 0) return [];

        // Get all unique keys from the data
        const keys = new Set<string>();
        rowData.forEach(row => {
            Object.keys(row).forEach(key => keys.add(key));
        });

        // Create column definitions for each key with specific widths
        return Array.from(keys).map(key => {
            const baseConfig: ColDef<DocumentItem> = {
                field: key,
                headerName: key,
                sortable: true,
                filter: key === 'הודעה' ? 'agTextColumnFilter' : true,
            };

            // Add custom comparator for date column
            if (key === 'תאריך') {
                baseConfig.comparator = (valueA: string, valueB: string) => {
                    const dateA = parseHebrewDate(valueA);
                    const dateB = parseHebrewDate(valueB);
                    return dateA.getTime() - dateB.getTime();
                };
            }

            // Set specific widths for different columns
            if (key === 'משתמש') {
                return { ...baseConfig, width: 110 };
            } else if (key === 'תאריך') {
                return { ...baseConfig, width: 180 };
            } else if (key === 'הודעה') {
                return { ...baseConfig, width: 1000 };
            } else {
                return { ...baseConfig, width: 100 };
            }
        });
    }, [rowData]);

    // Default column definition for AG Grid
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'center'},
        resizable: true,
    };

    // Row style function for alternating colors
    const getRowStyle = (params: any) => {
        if (params.node.rowIndex % 2 === 1) {
            return { background: '#e0f2fe' }; // Light blue for odd rows
        }
        return undefined; // Default white for even rows
    };

    return (
        <div className="container mx-auto p-4">
            <div className="flex justify-between items-center mb-4">
                <h2 className="text-xl font-bold text-right">תיעוד</h2>
                {!permissions['Plugot'] && (
                    <Button
                        onClick={() => setIsModalOpen(true)}
                        className="bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-bold py-2 px-4 rounded-lg shadow-lg"
                    >
                        ➕ הוסף רשומה
                    </Button>
                )}
            </div>

            {statusMessage.text && (
                <div className="fixed top-4 left-1/2 transform -translate-x-1/2 z-50 w-full max-w-2xl px-4">
                    <StatusMessage
                        isSuccess={statusMessage.isSuccess}
                        message={statusMessage.text}
                        onClose={() => setStatusMessage({ text: '', isSuccess: false })}
                    />
                </div>
            )}

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

            {/* Insert Row Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl">
                        {/* Header */}
                        <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-6 rounded-t-2xl flex justify-between items-center">
                            <h2 className="text-2xl font-bold text-white">הוסף רשומה חדשה</h2>
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setNewMessage('');
                                }}
                                className="text-white hover:bg-blue-800 rounded-full p-2 transition-colors"
                            >
                                <X size={24} />
                            </button>
                        </div>

                        {/* Content */}
                        <div className="p-6">
                            <div className="mb-4">
                                <label className="block text-right font-semibold text-gray-700 mb-2">
                                    הודעה
                                </label>
                                <textarea
                                    value={newMessage}
                                    onChange={(e) => setNewMessage(e.target.value)}
                                    placeholder="הזן את ההודעה כאן..."
                                    className="w-full px-4 py-3 border-2 border-blue-300 rounded-lg text-right focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                                    rows={5}
                                    dir="rtl"
                                />
                            </div>

                            <div className="text-right text-sm text-gray-600 mb-4">
                                <p><strong>תאריך:</strong> {new Date().toLocaleString('he-IL')}</p>
                                <p><strong>משתמש:</strong> {permissions['name'] || 'לא ידוע'}</p>
                            </div>
                        </div>

                        {/* Footer */}
                        <div className="p-6 bg-gray-50 rounded-b-2xl border-t border-gray-200 flex gap-3 justify-end">
                            <button
                                onClick={() => {
                                    setIsModalOpen(false);
                                    setNewMessage('');
                                }}
                                className="px-6 py-2 bg-gray-300 hover:bg-gray-400 text-gray-800 font-semibold rounded-lg transition-colors"
                            >
                                ביטול
                            </button>
                            <button
                                onClick={handleInsertRow}
                                className="px-6 py-2 bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-700 hover:to-blue-800 text-white font-semibold rounded-lg transition-colors"
                            >
                                הוסף רשומה
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
};

export default ArmoryDocumentation;
