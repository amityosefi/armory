import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient";
import {ColDef} from "ag-grid-community";
import {usePermissions} from "@/contexts/PermissionsContext";

interface ArmorySumProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

type ArmoryItem = {
    id: number;
    name: string;
    kind?: string;
    location: string;
    person_id?: string;
    is_save?: boolean;
    [key: string]: any;
};

type PersonData = {
    id: string;
    location: string;
    [key: string]: any;
};

type SummaryRow = {
    name: string;
    kind: string;
    א: number;
    ב: number;
    ג: number;
    מסייעת: number;
    אלון: number;
    מכלול: number;
    פלסם: number;
    מנופק: number;
    גדוד: number;
    מחסן: number;
    סדנא: number;
    מאופסן: number;
    'סה״כ': number;
};

const ArmorySum: React.FC<ArmorySumProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [armoryItems, setArmoryItems] = useState<ArmoryItem[]>([]);
    const [peopleData, setPeopleData] = useState<PersonData[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});

    // Fetch data from Supabase in chunks
    const fetchData = async () => {
        try {
            if (!permissions['armory'] && !permissions['admin']) return;
            setLoading(true);
            
            // Fetch armory items in chunks
            const CHUNK_SIZE = 1000;
            let allItems: ArmoryItem[] = [];
            let offset = 0;
            let hasMore = true;

            while (hasMore) {
                const {data: items, error: itemsError} = await supabase
                    .from("armory_items")
                    .select("*")
                    .range(offset, offset + CHUNK_SIZE - 1);

                if (itemsError) {
                    console.error("Error fetching armory items:", itemsError);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתונים: ${itemsError.message}`,
                        type: "error"
                    });
                    setLoading(false);
                    return;
                }

                if (items && items.length > 0) {
                    allItems = [...allItems, ...(items as ArmoryItem[])];
                    offset += CHUNK_SIZE;
                    hasMore = items.length === CHUNK_SIZE;
                } else {
                    hasMore = false;
                }
            }

            setArmoryItems(allItems);
            
            // Fetch people data in chunks
            let allPeople: PersonData[] = [];
            offset = 0;
            hasMore = true;

            while (hasMore) {
                const {data: people, error: peopleError} = await supabase
                    .from("people")
                    .select("id, location")
                    .range(offset, offset + CHUNK_SIZE - 1);

                if (peopleError) {
                    console.error("Error fetching people data:", peopleError);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתוני אנשים: ${peopleError.message}`,
                        type: "error"
                    });
                    break;
                }

                if (people && people.length > 0) {
                    allPeople = [...allPeople, ...(people as PersonData[])];
                    offset += CHUNK_SIZE;
                    hasMore = people.length === CHUNK_SIZE;
                } else {
                    hasMore = false;
                }
            }

            setPeopleData(allPeople);
            setStatusMessage({text: "", type: ""});
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                type: "error"
            });
        } finally {
            setLoading(false);
        }
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, []);
    // Helper function to resolve location from person_id or location field
    const resolveLocation = (item: ArmoryItem): string => {
        const locationValue = item.location;

        // First priority: Check if location is one of the direct location values
        const directLocations = ['גדוד', 'מחסן', 'סדנא'];
        if (locationValue && directLocations.includes(locationValue.toString())) {
            return locationValue.toString();
        }

        // Try to find person by ID (location might be a person ID)
        if (locationValue) {
            const person = peopleData.find(p => {
                // Convert both to string for comparison to handle type mismatches
                return String(p.id) === String(locationValue);
            });
            
            if (person && person.location) {
                return person.location;
            }
        }
        return "no location";
    };

    // Process data into summary format grouped by kind
    const summaryByKind = useMemo(() => {
        if (armoryItems.length === 0) return {};

        const locationColumns = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם', 'גדוד', 'מחסן', 'סדנא', 'מאופסן'];
        const manupakColumns = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם'];
        
        // Group by kind, then by name
        const grouped: { [kind: string]: { [name: string]: { [location: string]: number } } } = {};
        
        // Track items by kind for debugging
        const itemsByKind: { [kind: string]: Set<string> } = {};
        
        armoryItems.forEach(item => {
            const kind = item.kind || 'לא מסווג';
            const name = item.name || 'ללא שם';

            // Track all unique names per kind
            if (!itemsByKind[kind]) {
                itemsByKind[kind] = new Set();
            }
            itemsByKind[kind].add(name);

            if (!grouped[kind]) {
                grouped[kind] = {};
            }
            
            if (!grouped[kind][name]) {
                grouped[kind][name] = {};
                locationColumns.forEach(loc => {
                    grouped[kind][name][loc] = 0;
                });
            }
            
            // Resolve the location (person ID -> person's location, or direct location)
            const location = resolveLocation(item);
            
            // Count in מאופסן if is_save is true
            if (item.is_save === true) {
                grouped[kind][name]['מאופסן'] = (grouped[kind][name]['מאופסן'] || 0) + 1;
            }
            
            // Count in location columns (including פלוגות) regardless of is_save flag
            if (locationColumns.includes(location)) {
                grouped[kind][name][location] = (grouped[kind][name][location] || 0) + 1;
            }
        });
        
        // Convert to array format for each kind
        const result: { [kind: string]: SummaryRow[] } = {};
        
        Object.keys(grouped).forEach(kind => {
            result[kind] = Object.keys(grouped[kind]).map(name => {
                const locationCounts = grouped[kind][name];
                // Calculate מנופק as sum of specific columns
                const manupakSum = manupakColumns.reduce((sum, col) => sum + (locationCounts[col] || 0), 0);
                
                // Calculate סה״כ (total) as sum of מנופק, גדוד, מחסן, סדנא, מאופסן
                const total = manupakSum + 
                             (locationCounts['גדוד'] || 0) + 
                             (locationCounts['מחסן'] || 0) + 
                             (locationCounts['סדנא'] || 0) + 
                             (locationCounts['מנופק'] || 0);
                
                return {
                    name,
                    kind,
                    ...locationCounts,
                    מנופק: manupakSum,
                    'סה״כ': total
                } as SummaryRow;
            });
        });
        
        // Debug: Show unique names per kind vs total items
        Object.keys(result).forEach(kind => {
            const uniqueNames = result[kind].length;
            const totalItems = result[kind].reduce((sum, row) => sum + row['סה״כ'], 0);
        });

        return result;
    }, [armoryItems, peopleData]);

    // Column definitions for summary table
    const columnDefs = useMemo<ColDef<SummaryRow>[]>(() => {
        // Helper to create column definition with common defaults
        const createColumn = (
            field: keyof SummaryRow,
            headerName: string,
            width: number,
            options?: {
                backgroundColor?: string;
                fontWeight?: string;
                textAlign?: 'left' | 'center' | 'right';
                pinned?: 'left' | 'right';
            }
        ): ColDef<SummaryRow> => ({
            field,
            headerName,
            sortable: true,
            filter: true,
            width,
            cellStyle: {
                textAlign: options?.textAlign || 'center',
                ...(options?.backgroundColor && { backgroundColor: options.backgroundColor }),
                ...(options?.fontWeight && { fontWeight: options.fontWeight }),
            } as const,
            ...(options?.pinned && { pinned: options.pinned }),
        });

        return [
            createColumn('name', 'שם', 130, { textAlign: 'right', pinned: 'right' }),
            createColumn('א', 'א', 90),
            createColumn('ב', 'ב', 90),
            createColumn('ג', 'ג', 90),
            createColumn('מסייעת', 'מסייעת', 90),
            createColumn('אלון', 'אלון', 90),
            createColumn('מכלול', 'מכלול', 100),
            createColumn('פלסם', 'פלסם', 90),
            createColumn('מנופק', 'מנופק', 90, { backgroundColor: '#ffcccb' }),
            createColumn('גדוד', 'גדוד', 90, { backgroundColor: '#ffffe0' }),
            createColumn('מחסן', 'מחסן', 90),
            createColumn('סדנא', 'סדנא', 90),
            createColumn('מאופסן', 'מאופסן', 90),
            createColumn('סה״כ', 'סה״כ', 90, { fontWeight: 'bold' }),
        ];
    }, []);

    // Default column definition for AG Grid
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'center'},
        resizable: true,
    };

    // Row style function for alternating colors (every 2 rows)
    const getRowStyle = (params: any) => {
        const rowIndex = params.node.rowIndex;
        // Every 2 rows get light blue background
        if (rowIndex % 2 === 0) {
            return { background: '#e3f2fd' }; // Light blue
        }
        return undefined; // Default white
    };

    return (
        <div className="container mx-auto p-4">
            {statusMessage.text && (
                <div
                    className={`p-4 mb-4 rounded-md ${
                        statusMessage.type === 'error' 
                            ? 'bg-red-100 text-red-700' 
                            : 'bg-green-100 text-green-700'
                    }`}
                >
                    {statusMessage.text}
                </div>
            )}

            <h2 className="text-2xl font-bold mb-6 text-right">סיכום</h2>

            {loading ? (
                <div className="flex flex-col items-center justify-center h-[40vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-center p-4">טוען נתונים...</p>
                </div>
            ) : (
                <div className="space-y-6">
                    {Object.keys(summaryByKind).length === 0 ? (
                        <p className="text-center text-gray-500 p-4">אין נתונים להצגה</p>
                    ) : (
                        Object.entries(summaryByKind).map(([kind, rows]) => (
                            <div key={kind} className="border-2 border-blue-300 rounded-lg p-4 bg-blue-50">
                                <h3 className="text-xl font-semibold mb-4 text-right text-blue-800">
                                    סוג: {kind}
                                </h3>
                                <div 
                                    className="ag-theme-alpine rtl" 
                                    style={{height: "400px", width: "100%", direction: "rtl"}}
                                >
                                    <AgGridReact
                                        rowData={rows}
                                        columnDefs={columnDefs}
                                        defaultColDef={defaultColDef}
                                        pagination={false}
                                        enableRtl={true}
                                        domLayout="normal"
                                        getRowStyle={getRowStyle}
                                    />
                                </div>
                            </div>
                        ))
                    )}
                </div>
            )}
        </div>
    );
};

export default ArmorySum;
