import React, {useMemo, useState, useRef, useEffect} from "react";
import {usePermissions} from "@/contexts/PermissionsContext";
import {supabase} from "@/lib/supabaseClient";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {Button} from "@/components/ui/button";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {Input} from '@/components/ui/input';
import {Label} from '@/components/ui/label';
import {Trash, Plus} from "lucide-react";
import {ColDef} from "ag-grid-community";
import CreatableSelect from 'react-select/creatable';
import {
    Select,
    SelectContent,
    SelectGroup,
    SelectItem,
    SelectLabel,
    SelectTrigger,
    SelectValue,
} from "@/components/ui/select";

// Add CSS for zebra striping
const zebra_styles = `
.light-blue-row {
    background-color: #f0f8ff;
}
`;

interface EquipmentStockProps {
    selectedSheet: {
        name: string;
        range: string;
        id: number;
    };
}

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

type AggregatedItem = {
    פריט: string;
    כמות: number;
};

type ItemFormData = {
    פריט: string;
    כמות: number;
    tableType?: TableType;
};

type TableType = "ammo_ball" | "ammo_explosion";

const AmmoStock: React.FC<EquipmentStockProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [rawBallData, setRawBallData] = useState<LogisticItem[]>([]);
    const [rawExplosionData, setRawExplosionData] = useState<LogisticItem[]>([]);
    const [aggregatedBallData, setAggregatedBallData] = useState<AggregatedItem[]>([]);
    const [aggregatedExplosionData, setAggregatedExplosionData] = useState<AggregatedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const [uniqueBallItems, setUniqueBallItems] = useState<string[]>([]);
    const [uniqueExplosionItems, setUniqueExplosionItems] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<TableType>("ammo_ball");

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [creditDialogOpen, setCreditDialogOpen] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);

    // Form data states
    const [addItems, setAddItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, tableType: "ammo_ball"}]);
    const [creditItems, setCreditItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, tableType: "ammo_ball"}]);
    const [transferItems, setTransferItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, tableType: "ammo_ball"}]);

    // Grid configuration
    const ballGridRef = useRef<AgGridReact>(null);
    const explosionGridRef = useRef<AgGridReact>(null);

    // Grid configuration
    const columnDefs: ColDef[] = [
        {
            field: 'פריט',
            headerName: 'פריט',
            sortable: true,
            filter: true,
            flex: 2
        },
        {
            field: 'כמות',
            headerName: 'כמות',
            sortable: true,
            filter: true,
            flex: 1,
            type: 'numericColumn',
            cellStyle: {textAlign: 'right'},
            headerClass: 'text-right',
            cellClass: 'text-right'
        }
    ];

    // Fetch data from Supabase
    const fetchData = async () => {
        if (permissions['munitions']) {
            try {
                setLoading(true);
                
                // Fetch data from ammo_ball table
                const ballResponse = await supabase
                    .from("ammo_ball")
                    .select("*")
                    .eq("פלוגה", selectedSheet.range);
                
                // Fetch data from ammo_explosion table
                const explosionResponse = await supabase
                    .from("ammo_explosion")
                    .select("*")
                    .eq("פלוגה", selectedSheet.range);

                if (ballResponse.error) {
                    console.error("Error fetching ball data:", ballResponse.error);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתוני תחמושת קליעית: ${ballResponse.error.message}`,
                        type: "error"
                    });
                } 
                
                if (explosionResponse.error) {
                    console.error("Error fetching explosion data:", explosionResponse.error);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתוני תחמושת נפיצה: ${explosionResponse.error.message}`,
                        type: "error"
                    });
                }
                
                if (!ballResponse.error && !explosionResponse.error) {
                    // @ts-ignore
                    setRawBallData(ballResponse.data || []);
                    // @ts-ignore
                    setRawExplosionData(explosionResponse.data || []);
                    
                    // Process data for both tables
                    // @ts-ignore
                    processData(ballResponse.data || [], "ammo_ball");
                    // @ts-ignore
                    processData(explosionResponse.data || [], "ammo_explosion");
                    
                    // Clear error message if any
                    setStatusMessage({text: "", type: ""});
                }
            } catch (err: any) {
                console.error("Unexpected error:", err);
                setStatusMessage({
                    text: `שגיאה לא צפויה: ${err.message}`,
                    type: "error"
                });
            } finally {
                setLoading(false);
            }
        } else {
            setLoading(false);
        }
    };

    // Process raw data to get aggregated values
    const processData = (data: LogisticItem[], tableType: TableType) => {
        // Create a map to hold sums by item
        const itemSums = new Map<string, number>();
        const uniqueItemsSet = new Set<string>();

        // Loop through each record
        data.forEach(item => {
            // Add item to unique items set
            if (item.פריט) {
                uniqueItemsSet.add(item.פריט);
            }

            // Calculate sum based on צורך (issue/credit)
            const currentSum = itemSums.get(item.פריט) || 0;
            const quantityChange = item.צורך === 'זיכוי' ? -item.כמות : item.כמות;
            itemSums.set(item.פריט, currentSum + quantityChange);
        });

        // Convert map to array of objects
        const aggregated = Array.from(itemSums.entries()).map(([פריט, כמות]) => ({
            פריט,
            כמות
        }));

        // Sort by פריט alphabetically
        aggregated.sort((a, b) => a.פריט.localeCompare(b.פריט));

        // Update the appropriate state based on table type
        if (tableType === "ammo_ball") {
            setAggregatedBallData(aggregated);
            setUniqueBallItems(Array.from(uniqueItemsSet));
        } else {
            setAggregatedExplosionData(aggregated);
            setUniqueExplosionItems(Array.from(uniqueItemsSet));
        }
    };

    // Add items to Supabase
    const handleAddItems = async () => {
        try {
            setLoading(true);

            // Filter out items with empty fields
            const validItems = addItems.filter(item => item.פריט && item.כמות > 0);

            if (validItems.length === 0) {
                setStatusMessage({
                    text: "אין פריטים תקינים להוספה",
                    type: "error"
                });
                return;
            }

            // Prepare items for insertion (group by per-item tableType)
            const byTable: Record<TableType, any[]> = { ammo_ball: [], ammo_explosion: [] };
            validItems.forEach(item => {
                const table = (item.tableType || selectedTable);
                byTable[table].push({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                כמות: item.כמות,
                צורך: 'ניפוק',
                סטטוס: 'החתמה',
                הערה: 'החתמה חדשה',
                משתמש: permissions['name'] || '',
                פלוגה: selectedSheet.range,
                חתימת_מחתים: ''
                });
            });

            // Insert per table
            let errorMsg = "";
            for (const table of ["ammo_ball", "ammo_explosion"] as TableType[]) {
                if (byTable[table].length) {
                    const { error } = await supabase.from(table).insert(byTable[table]);
                    if (error) errorMsg += `${table}: ${error.message} `;
                }
            }

            if (errorMsg) {
                console.error("Error inserting items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בהוספת פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים נוספו בהצלחה",
                    type: "success"
                });
                setAddDialogOpen(false);
                setAddItems([{פריט: "", כמות: 1, tableType: selectedTable}]);
                fetchData(); // Refresh data
            }
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

    // Credit items to Supabase
    const handleCreditItems = async () => {
        try {
            setLoading(true);

            // Filter out items with empty fields
            const validItems = creditItems.filter(item => item.פריט && item.כמות > 0);

            if (validItems.length === 0) {
                setStatusMessage({
                    text: "אין פריטים תקינים לזיכוי",
                    type: "error"
                });
                return;
            }

            // Prepare items for insertion (group by per-item tableType)
            const byTable: Record<TableType, any[]> = { ammo_ball: [], ammo_explosion: [] };
            validItems.forEach(item => {
                const table = (item.tableType || selectedTable);
                byTable[table].push({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                כמות: item.כמות,
                צורך: 'זיכוי',
                סטטוס: 'החתמה',
                הערה: 'זיכוי חדש',
                משתמש: permissions['name'] || '',
                פלוגה: selectedSheet.range,
                חתימת_מחתים: ''
                });
            });

            // Insert per table
            let errorMsg = "";
            for (const table of ["ammo_ball", "ammo_explosion"] as TableType[]) {
                if (byTable[table].length) {
                    const { error } = await supabase.from(table).insert(byTable[table]);
                    if (error) errorMsg += `${table}: ${error.message} `;
                }
            }

            if (errorMsg) {
                console.error("Error crediting items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בזיכוי פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים זוכו בהצלחה",
                    type: "success"
                });
                setCreditDialogOpen(false);
                setCreditItems([{פריט: "", כמות: 1, tableType: selectedTable}]);
                fetchData(); // Refresh data
            }
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

    // Transfer items to storage
    const handleTransferItems = async () => {
        try {
            setLoading(true);

            // Filter out items with empty fields
            const validItems = transferItems.filter(item => item.פריט && item.כמות > 0);

            if (validItems.length === 0) {
                setStatusMessage({
                    text: "אין פריטים תקינים להעברה",
                    type: "error"
                });
                return;
            }

            // Prepare items for insertion - create pairs of entries, grouped by per-item tableType
            const byTable: Record<TableType, any[]> = { ammo_ball: [], ammo_explosion: [] };
            for (const item of validItems) {
                const table = (item.tableType || selectedTable);
                // Credit from current unit (גדוד)
                byTable[table].push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    כמות: item.כמות,
                    צורך: 'זיכוי',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: selectedSheet.range === 'גדוד' ? 'גדוד' : 'מחסן',
                    הערה: 'העברת פריטים בין הגדוד למחסן',
                    חתימת_מחתים: ''
                });

                // Issue to storage (מחסן)
                byTable[table].push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    כמות: item.כמות,
                    צורך: 'ניפוק',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: selectedSheet.range !== 'גדוד' ? 'גדוד' : 'מחסן',
                    הערה: 'העברת פריטים בין הגדוד למחסן',
                    חתימת_מחתים: ''
                });
            }

            // Insert per table
            let errorMsg = "";
            for (const table of ["ammo_ball", "ammo_explosion"] as TableType[]) {
                if (byTable[table].length) {
                    const { error } = await supabase.from(table).insert(byTable[table]);
                    if (error) errorMsg += `${table}: ${error.message} `;
                }
            }

            if (errorMsg) {
                console.error("Error transferring items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בהעברת פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים הועברו בהצלחה",
                    type: "success"
                });
                setTransferDialogOpen(false);
                setTransferItems([{פריט: "", כמות: 1, tableType: selectedTable}]);
                fetchData(); // Refresh data
            }
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

    // Helper function to add an empty item to a form
    const addEmptyItem = (items: ItemFormData[], setItems: React.Dispatch<React.SetStateAction<ItemFormData[]>>) => {
        setItems([...items, {פריט: "", כמות: 1, tableType: selectedTable}]);
    };

    // Helper function to remove an item from a form
    const removeItem = (
        index: number,
        items: ItemFormData[],
        setItems: React.Dispatch<React.SetStateAction<ItemFormData[]>>
    ) => {
        const newItems = [...items];
        newItems.splice(index, 1);
        setItems(newItems);
    };

    // Helper function to update an item in a form
    const updateItem = (
        index: number,
        field: keyof ItemFormData,
        value: string | number,
        items: ItemFormData[],
        setItems: React.Dispatch<React.SetStateAction<ItemFormData[]>>
    ) => {
        const newItems = [...items];
        if (field === 'כמות') {
            newItems[index][field] = typeof value === 'string' ? parseInt(value) || 0 : value;
        } else if (field === 'tableType') {
            // Ensure correct union type assignment for TableType
            newItems[index].tableType = value as TableType;
        } else {
            newItems[index][field] = value as string;
        }
        setItems(newItems);
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [selectedSheet.range]);

    return (
        <div className="p-4">
            {statusMessage.text && (
                <div
                    className={`p-4 mb-4 rounded-md ${statusMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {statusMessage.text}
                </div>
            )}

            {/* Buttons row */}
            {permissions['munitions'] && (
                <div className="flex flex-col sm:flex-row gap-2 mb-4">
                    <Button
                        onClick={() => setAddDialogOpen(true)}
                        className="bg-green-500 hover:bg-green-600 text-white"
                    >
                        הוספת פריטים
                    </Button>

                    <Button
                        onClick={() => setCreditDialogOpen(true)}
                        className="bg-red-500 hover:bg-red-600 text-white"
                    >
                        זיכוי פריטים
                    </Button>

                    <Button
                        onClick={() => setTransferDialogOpen(true)}
                        className="bg-blue-500 hover:bg-blue-600 text-white"
                    >
                        {selectedSheet.range === "מחסן" ? "העברה לגדוד" : "העברה למחסן"}
                    </Button>
                </div>
            )}

            {/* Ammo Ball Data Grid */}
            <div className="mb-8">
                <h2 className="text-xl font-bold mb-4 text-right">קליעית</h2>
                <div className="ag-theme-alpine rtl" style={{height: "40vh", width: "40vh", direction: "rtl"}}>
                    <AgGridReact
                        ref={ballGridRef}
                        rowData={aggregatedBallData}
                        columnDefs={columnDefs}
                        defaultColDef={{
                            flex: 1,
                            minWidth: 100,
                            sortable: true,
                            filter: true,
                        }}
                        enableRtl={true}
                        getRowStyle={(params) => {
                            if (params.rowIndex % 2 === 0) {
                                return {backgroundColor: '#e6f2ff'};
                            }
                            return undefined;
                        }}
                    />
                </div>
            </div>

            {/* Ammo Explosion Data Grid */}
            <div className="mt-8">
                <h2 className="text-xl font-bold mb-4 text-right">נפיצה</h2>
                <div className="ag-theme-alpine rtl" style={{height: "40vh", width: "40vh", direction: "rtl"}}>
                    <AgGridReact
                        ref={explosionGridRef}
                        rowData={aggregatedExplosionData}
                        columnDefs={columnDefs}
                        defaultColDef={{
                            flex: 1,
                            minWidth: 100,
                            sortable: true,
                            filter: true,
                        }}
                        enableRtl={true}
                        getRowStyle={(params) => {
                            if (params.rowIndex % 2 === 0) {
                                return {backgroundColor: '#e6f2ff'};
                            }
                            return undefined;
                        }}
                    />
                </div>
            </div>

            {/* Add Items Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-right">הוספת פריטים</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Table selection */}
                        
                        {addItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={(item.tableType || selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'tableType' as any, val, addItems, setAddItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ammo_ball">קליעית</SelectItem>
                                            <SelectItem value="ammo_explosion">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1">
                                    <Label className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        options={(item.tableType || selectedTable) === "ammo_ball" ? 
                                            uniqueBallItems.map(name => ({value: name, label: name})) :
                                            uniqueExplosionItems.map(name => ({value: name, label: name}))}
                                        value={item.פריט ? {value: item.פריט, label: item.פריט} : null}
                                        onChange={(selectedOption) => {
                                            updateItem(
                                                index,
                                                'פריט',
                                                selectedOption ? selectedOption.value : '',
                                                addItems,
                                                setAddItems
                                            );
                                        }}
                                        onCreateOption={(inputValue) => {
                                            updateItem(index, 'פריט', inputValue, addItems, setAddItems);
                                        }}
                                        placeholder="בחר או הכנס פריט"
                                        classNamePrefix="select"
                                        isClearable
                                        styles={{
                                            control: (provided) => ({
                                                ...provided,
                                                textAlign: 'right',
                                                direction: 'rtl'
                                            }),
                                            menu: (provided) => ({
                                                ...provided,
                                                textAlign: 'right',
                                                direction: 'rtl'
                                            }),
                                            option: (provided) => ({
                                                ...provided,
                                                textAlign: 'right',
                                                direction: 'rtl'
                                            })
                                        }}
                                    />
                                </div>

                                <div className="w-20">
                                    <Label className="text-right block mb-2">כמות</Label>
                                    <Input
                                        type="number"
                                        value={item.כמות}
                                        onChange={(e) => updateItem(
                                            index,
                                            'כמות',
                                            e.target.value,
                                            addItems,
                                            setAddItems
                                        )}
                                        min="1"
                                        className="text-right"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index, addItems, setAddItems)}
                                    disabled={addItems.length === 1}
                                >
                                    <Trash className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addEmptyItem(addItems, setAddItems)}
                            className="mt-2"
                        >
                            <Plus className="h-4 w-4 mr-2"/> הוסף פריט נוסף
                        </Button>
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setAddDialogOpen(false)}
                        >
                            ביטול
                        </Button>
                        <Button
                            type="button"
                            onClick={handleAddItems}
                            disabled={loading || addItems.every(item => !item.פריט)}
                        >
                            {loading ? "מוסיף..." : "הוסף פריטים"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Credit Items Dialog */}
            <Dialog open={creditDialogOpen} onOpenChange={setCreditDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-right">זיכוי פריטים</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Table selection */}
                        
                        {creditItems.map((item, index) => (
                            <div key={index} className="flex items-start gap-4 mb-4">
                                <div className="w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={(item.tableType || selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'tableType' as any, val, creditItems, setCreditItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ammo_ball">קליעית</SelectItem>
                                            <SelectItem value="ammo_explosion">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 flex gap-2">
                                    <div className="flex-1">
                                        <Label className="text-right block mb-2">פריט</Label>
                                        <Select
                                            value={item.פריט || ""}
                                            onValueChange={(value) => updateItem(
                                                index,
                                                'פריט',
                                                value,
                                                creditItems,
                                                setCreditItems
                                            )}
                                        >
                                            <SelectTrigger className="text-right">
                                                <SelectValue placeholder="בחר פריט" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {((item.tableType || selectedTable) === "ammo_ball" ? uniqueBallItems : uniqueExplosionItems)
                                                    .map(name => (
                                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="w-24">
                                        <Label className="text-right block mb-2">כמות</Label>
                                        <Input
                                            type="number"
                                            value={item.כמות}
                                            onChange={(e) => updateItem(
                                                index,
                                                'כמות',
                                                e.target.value,
                                                creditItems,
                                                setCreditItems
                                            )}
                                            min="1"
                                            className="text-right"
                                        />
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index, creditItems, setCreditItems)}
                                    disabled={creditItems.length === 1}
                                    className="mt-8"
                                >
                                    <Trash className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addEmptyItem(creditItems, setCreditItems)}
                            className="mt-2"
                        >
                            <Plus className="h-4 w-4 mr-2"/> הוסף פריט נוסף
                        </Button>
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setCreditDialogOpen(false)}
                        >
                            ביטול
                        </Button>
                        <Button
                            type="button"
                            onClick={handleCreditItems}
                            disabled={loading || creditItems.every(item => !item.פריט)}
                        >
                            {loading ? "מזכה..." : "זכה פריטים"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Transfer Items Dialog */}
            <Dialog open={transferDialogOpen} onOpenChange={setTransferDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-right">
                            {selectedSheet.range === "מחסן" ? "העברה לגדוד" : "העברה למחסן"}
                        </DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Table selection */}
                        
                        {transferItems.map((item, index) => (
                            <div key={index} className="flex items-start gap-4 mb-4">
                                <div className="w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={(item.tableType || selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'tableType' as any, val, transferItems, setTransferItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ammo_ball">קליעית</SelectItem>
                                            <SelectItem value="ammo_explosion">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 flex gap-2">
                                    <div className="flex-1">
                                        <Label className="text-right block mb-2">פריט</Label>
                                        <Select
                                            value={item.פריט || ""}
                                            onValueChange={(value) => updateItem(
                                                index,
                                                'פריט',
                                                value,
                                                transferItems,
                                                setTransferItems
                                            )}
                                        >
                                            <SelectTrigger className="text-right">
                                                <SelectValue placeholder="בחר פריט" />
                                            </SelectTrigger>
                                            <SelectContent>
                                                {((item.tableType || selectedTable) === "ammo_ball" ? uniqueBallItems : uniqueExplosionItems)
                                                    .map(name => (
                                                        <SelectItem key={name} value={name}>{name}</SelectItem>
                                                    ))
                                                }
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    <div className="w-24">
                                        <Label className="text-right block mb-2">כמות</Label>
                                        <Input
                                            type="number"
                                            value={item.כמות}
                                            onChange={(e) => updateItem(
                                                index,
                                                'כמות',
                                                e.target.value,
                                                transferItems,
                                                setTransferItems
                                            )}
                                            min="1"
                                            className="text-right"
                                        />
                                    </div>
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index, transferItems, setTransferItems)}
                                    disabled={transferItems.length === 1}
                                    className="mt-8"
                                >
                                    <Trash className="h-4 w-4"/>
                                </Button>
                            </div>
                        ))}

                        <Button
                            variant="outline"
                            size="sm"
                            onClick={() => addEmptyItem(transferItems, setTransferItems)}
                            className="mt-2"
                        >
                            <Plus className="h-4 w-4 mr-2"/> הוסף פריט נוסף
                        </Button>
                    </div>

                    <DialogFooter className="sm:justify-end">
                        <Button
                            type="button"
                            variant="ghost"
                            onClick={() => setTransferDialogOpen(false)}
                        >
                            ביטול
                        </Button>
                        <Button
                            type="button"
                            onClick={handleTransferItems}
                            disabled={loading || transferItems.every(item => !item.פריט)}
                        >
                            {loading ? "מעביר..." : "העבר למחסן"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AmmoStock;
