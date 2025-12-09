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
    is_explosion?: boolean;
};

type AggregatedItem = {
    פריט: string;
    כמות: number;
};

type ItemFormData = {
    פריט: string;
    כמות: number;
    is_explosion?: boolean;
};

type TableType = boolean; // true for explosion, false for ball

const AmmoStock: React.FC<EquipmentStockProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [rawBallData, setRawBallData] = useState<LogisticItem[]>([]);
    const [rawExplosionData, setRawExplosionData] = useState<LogisticItem[]>([]);
    const [aggregatedBallData, setAggregatedBallData] = useState<AggregatedItem[]>([]);
    const [aggregatedExplosionData, setAggregatedExplosionData] = useState<AggregatedItem[]>([]);
    // מחסן data states
    const [rawBallDataWarehouse, setRawBallDataWarehouse] = useState<LogisticItem[]>([]);
    const [rawExplosionDataWarehouse, setRawExplosionDataWarehouse] = useState<LogisticItem[]>([]);
    const [aggregatedBallDataWarehouse, setAggregatedBallDataWarehouse] = useState<AggregatedItem[]>([]);
    const [aggregatedExplosionDataWarehouse, setAggregatedExplosionDataWarehouse] = useState<AggregatedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const [uniqueBallItems, setUniqueBallItems] = useState<string[]>([]);
    const [uniqueExplosionItems, setUniqueExplosionItems] = useState<string[]>([]);
    const [uniqueBallItemsWarehouse, setUniqueBallItemsWarehouse] = useState<string[]>([]);
    const [uniqueExplosionItemsWarehouse, setUniqueExplosionItemsWarehouse] = useState<string[]>([]);
    const [selectedTable, setSelectedTable] = useState<TableType>(false); // false = ball, true = explosion

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [creditDialogOpen, setCreditDialogOpen] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);

    // Form data states
    const [addItems, setAddItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, is_explosion: false}]);
    const [creditItems, setCreditItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, is_explosion: false}]);
    const [transferItems, setTransferItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1, is_explosion: false}]);
    
    // Location selection states
    const [addLocation, setAddLocation] = useState<string>('גדוד');
    const [creditLocation, setCreditLocation] = useState<string>('גדוד');
    const [transferFrom, setTransferFrom] = useState<string>('מחסן');
    const [transferTo, setTransferTo] = useState<string>('גדוד');

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
        if (permissions['ammo']) {
            try {
                setLoading(true);
                
                // Fetch גדוד data
                const ammoResponse = await supabase
                    .from("ammo")
                    .select("*")
                    .eq("פלוגה", selectedSheet.range);

                // Fetch מחסן data
                const warehouseResponse = await supabase
                    .from("ammo")
                    .select("*")
                    .eq("פלוגה", "מחסן");

                if (ammoResponse.error) {
                    console.error("Error fetching ammo data:", ammoResponse.error);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתוני תחמושת: ${ammoResponse.error.message}`,
                        type: "error"
                    });
                } else {
                    // Process גדוד data
                    // @ts-ignore
                    const allData = (ammoResponse.data as LogisticItem[]) || [];
                    const ballData = allData.filter((item: LogisticItem) => !item.is_explosion);
                    const explosionData = allData.filter((item: LogisticItem) => item.is_explosion);
                    
                    setRawBallData(ballData as LogisticItem[]);
                    setRawExplosionData(explosionData as LogisticItem[]);
                    
                    // Process גדוד data for both types
                    processData(ballData as LogisticItem[], false, setAggregatedBallData, setUniqueBallItems);
                    processData(explosionData as LogisticItem[], true, setAggregatedExplosionData, setUniqueExplosionItems);
                    
                    // Process מחסן data
                    if (!warehouseResponse.error && warehouseResponse.data) {
                        const warehouseData = (warehouseResponse.data as LogisticItem[]) || [];
                        const ballDataWarehouse = warehouseData.filter((item: LogisticItem) => !item.is_explosion);
                        const explosionDataWarehouse = warehouseData.filter((item: LogisticItem) => item.is_explosion);
                        
                        setRawBallDataWarehouse(ballDataWarehouse as LogisticItem[]);
                        setRawExplosionDataWarehouse(explosionDataWarehouse as LogisticItem[]);
                        
                        // Process מחסן data for both types
                        processData(ballDataWarehouse as LogisticItem[], false, setAggregatedBallDataWarehouse, setUniqueBallItemsWarehouse);
                        processData(explosionDataWarehouse as LogisticItem[], true, setAggregatedExplosionDataWarehouse, setUniqueExplosionItemsWarehouse);
                    }
                    
                    // Don't clear status message here to allow success messages to show
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
    const processData = (data: LogisticItem[], tableType: TableType, setAggregated: React.Dispatch<React.SetStateAction<AggregatedItem[]>>, setUniqueItems: React.Dispatch<React.SetStateAction<string[]>>) => {
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

        // Filter out items with 0 quantity and sort by פריט alphabetically
        const filteredAggregated = aggregated
            .filter(item => item.כמות !== 0)
            .sort((a, b) => a.פריט.localeCompare(b.פריט));

        // Sort unique items alphabetically for dropdowns
        const sortedUniqueItems = Array.from(uniqueItemsSet).sort((a, b) => a.localeCompare(b));

        // Update the appropriate state using the provided setters
        setAggregated(filteredAggregated);
        setUniqueItems(sortedUniqueItems);
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

            // Prepare items for insertion into unified ammo table
            const itemsToInsert = validItems.map(item => ({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                כמות: item.כמות,
                צורך: 'ניפוק',
                סטטוס: 'החתמה',
                הערה: 'החתמה חדשה',
                משתמש: permissions['name'] || '',
                פלוגה: addLocation,
                חתימת_מחתים: '',
                is_explosion: item.is_explosion ?? selectedTable
            }));

            // Insert into unified ammo table
            const { error } = await supabase.from('ammo').insert(itemsToInsert);
            let errorMsg = error ? error.message : "";

            if (errorMsg) {
                console.error("Error inserting items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בהוספת פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                const itemsList = validItems.map(item => `${item.פריט} (${item.כמות})`).join(', ');
                setStatusMessage({
                    text: `הוספו ${validItems.length} פריטים בהצלחה למלאי ${addLocation}: ${itemsList}`,
                    type: "success"
                });
                setAddDialogOpen(false);
                setAddItems([{פריט: "", כמות: 1, is_explosion: selectedTable}]);
                await fetchData(); // Refresh data
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

            // Validate that crediting won't result in negative quantities
            const invalidItems: string[] = [];
            for (const item of validItems) {
                const isExplosion = item.is_explosion ?? selectedTable;
                
                // Get data based on creditLocation
                const aggregatedData = creditLocation === 'גדוד' ? 
                    (!isExplosion ? aggregatedBallData : aggregatedExplosionData) :
                    (!isExplosion ? aggregatedBallDataWarehouse : aggregatedExplosionDataWarehouse);
                
                // Find current quantity for this item in the selected location
                const currentItem = aggregatedData.find(aggItem => aggItem.פריט === item.פריט);
                const currentQuantity = currentItem ? currentItem.כמות : 0;
                
                // Check if crediting would result in negative quantity
                // Note: זיכוי (credit) reduces the quantity, so we subtract
                if (currentQuantity - item.כמות < 0) {
                    invalidItems.push(`${item.פריט} - כמות לא מספיקה ב${creditLocation} (נוכחי: ${currentQuantity}, מנסה לזכות: ${item.כמות})`);
                }
            }

            if (invalidItems.length > 0) {
                setStatusMessage({
                    text: `לא ניתן לזכות פריטים:\n${invalidItems.join('\n')}`,
                    type: "error"
                });
                setLoading(false);
                setCreditDialogOpen(false);
                return;
            }

            // Prepare items for insertion into unified ammo table
            const itemsToInsert = validItems.map(item => ({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                כמות: item.כמות,
                צורך: 'זיכוי',
                סטטוס: 'החתמה',
                הערה: 'זיכוי חדש',
                משתמש: permissions['name'] || '',
                פלוגה: creditLocation,
                חתימת_מחתים: '',
                is_explosion: item.is_explosion ?? selectedTable
            }));

            // Insert into unified ammo table
            const { error } = await supabase.from('ammo').insert(itemsToInsert);
            let errorMsg = error ? error.message : "";

            if (errorMsg) {
                console.error("Error crediting items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בזיכוי פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                const itemsList = validItems.map(item => `${item.פריט} (${item.כמות})`).join(', ');
                setStatusMessage({
                    text: `זוכו ${validItems.length} פריטים בהצלחה מ${creditLocation}: ${itemsList}`,
                    type: "success"
                });
                setCreditDialogOpen(false);
                setCreditItems([{פריט: "", כמות: 1, is_explosion: selectedTable}]);
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

            // Validate that source and destination are different
            if (transferFrom === transferTo) {
                setStatusMessage({
                    text: "לא ניתן להעביר פריטים לאותו מיקום",
                    type: "error"
                });
                setLoading(false);
                return;
            }

            // Filter out items with empty fields
            const validItems = transferItems.filter(item => item.פריט && item.כמות > 0);

            if (validItems.length === 0) {
                setStatusMessage({
                    text: "אין פריטים תקינים להעברה",
                    type: "error"
                });
                return;
            }

            // Validate that transferring won't result in negative quantities in source or destination
            const invalidTransfers: string[] = [];
            for (const item of validItems) {
                const isExplosion = item.is_explosion ?? selectedTable;
                
                // Get source data based on transferFrom
                const sourceData = transferFrom === 'גדוד' ? 
                    (!isExplosion ? aggregatedBallData : aggregatedExplosionData) :
                    (!isExplosion ? aggregatedBallDataWarehouse : aggregatedExplosionDataWarehouse);

                // Find current quantity for this item in the source location
                const sourceItem = sourceData.find(aggItem => aggItem.פריט === item.פריט);
                const sourceQuantity = sourceItem ? sourceItem.כמות : 0;

                // Check if source will go negative
                if (sourceQuantity - item.כמות < 0) {
                    invalidTransfers.push(`${item.פריט} - כמות לא מספיקה ב${transferFrom} (נוכחי: ${sourceQuantity}, מנסה להעביר: ${item.כמות})`);
                }
            }

            if (invalidTransfers.length > 0) {
                setStatusMessage({
                    text: `לא ניתן להעביר פריטים:\n${invalidTransfers.join('\n')}`,
                    type: "error"
                });
                setLoading(false);
                setTransferDialogOpen(false);
                return;
            }

            // Prepare items for insertion - create pairs of entries into unified ammo table
            const itemsToInsert: any[] = [];
            for (const item of validItems) {
                const isExplosion = item.is_explosion ?? selectedTable;
                // Credit from current unit (גדוד)
                itemsToInsert.push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    כמות: item.כמות,
                    צורך: 'זיכוי',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: transferFrom,
                    הערה: `העברה מ${transferFrom} ל${transferTo}`,
                    חתימת_מחתים: '',
                    is_explosion: isExplosion
                });

                // Issue to storage (מחסן)
                itemsToInsert.push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    כמות: item.כמות,
                    צורך: 'ניפוק',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: transferTo,
                    הערה: `העברה מ${transferFrom} ל${transferTo}`,
                    חתימת_מחתים: '',
                    is_explosion: isExplosion
                });
            }

            // Insert into unified ammo table
            const { error } = await supabase.from('ammo').insert(itemsToInsert);
            let errorMsg = error ? error.message : "";

            if (errorMsg) {
                console.error("Error transferring items:", errorMsg);
                setStatusMessage({
                    text: `שגיאה בהעברת פריטים: ${errorMsg}`,
                    type: "error"
                });
            } else {
                const itemsList = validItems.map(item => `${item.פריט} (${item.כמות})`).join(', ');
                setStatusMessage({
                    text: `הועברו ${validItems.length} פריטים בהצלחה מ${transferFrom} ל${transferTo}: ${itemsList}`,
                    type: "success"
                });
                setTransferDialogOpen(false);
                setTransferItems([{פריט: "", כמות: 1, is_explosion: selectedTable}]);
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
        setItems([...items, {פריט: "", כמות: 1, is_explosion: selectedTable}]);
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
        value: string | number | boolean,
        items: ItemFormData[],
        setItems: React.Dispatch<React.SetStateAction<ItemFormData[]>>
    ) => {
        const newItems = [...items];
        if (field === 'כמות') {
            newItems[index][field] = typeof value === 'string' ? parseInt(value) || 0 : value as number;
        } else if (field === 'is_explosion') {
            newItems[index][field] = value as boolean;
        } else if (field === 'פריט') {
            newItems[index][field] = value as string;
        }
        setItems(newItems);
    };

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [selectedSheet.range]);

    // Automatically adjust transferTo when transferFrom changes to prevent same-location transfers
    useEffect(() => {
        if (transferFrom === transferTo) {
            setTransferTo(transferFrom === 'גדוד' ? 'מחסן' : 'גדוד');
        }
    }, [transferFrom]);

    return (
        <div className="p-9">
            {statusMessage.text && (
                <div
                    className={`p-4 mb-4 rounded-md ${statusMessage.type === 'error' ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'}`}>
                    {statusMessage.text}
                </div>
            )}

            {/* Buttons row */}
            {permissions['ammo'] && (
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
                        העברה בין מחסן וגדוד
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

            {/* מחסן Tables */}
            <div className="mt-12 border-t-4 border-gray-300 pt-8">
                <h1 className="text-2xl font-bold mb-6 text-right">מלאי מחסן</h1>
                
                {/* מחסן Ball Data Grid */}
                <div className="mb-8">
                    <h2 className="text-xl font-bold mb-4 text-right">קליעית - מחסן</h2>
                    <div className="ag-theme-alpine rtl" style={{height: "40vh", width: "40vh", direction: "rtl"}}>
                        <AgGridReact
                            rowData={aggregatedBallDataWarehouse}
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

                {/* מחסן Explosion Data Grid */}
                <div className="mt-8">
                    <h2 className="text-xl font-bold mb-4 text-right">נפיצה - מחסן</h2>
                    <div className="ag-theme-alpine rtl" style={{height: "40vh", width: "40vh", direction: "rtl"}}>
                        <AgGridReact
                            rowData={aggregatedExplosionDataWarehouse}
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
            </div>

            {/* Add Items Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-right">הוספת פריטים</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Location selection */}
                        <div className="mb-4">
                            <Label className="text-right block mb-2">מיקום</Label>
                            <Select value={addLocation} onValueChange={setAddLocation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר מיקום" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="גדוד">גדוד</SelectItem>
                                    <SelectItem value="מחסן">מחסן</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {addItems.map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row items-start md:items-center gap-4">
                                <div className="w-full md:w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={String(item.is_explosion ?? selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'is_explosion' as any, val === 'true', addItems, setAddItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="false">קליעית</SelectItem>
                                            <SelectItem value="true">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 w-full">
                                    <Label className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        options={!(item.is_explosion ?? selectedTable) ? 
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
                        {/* Location selection */}
                        <div className="mb-4">
                            <Label className="text-right block mb-2">מיקום</Label>
                            <Select value={creditLocation} onValueChange={setCreditLocation}>
                                <SelectTrigger>
                                    <SelectValue placeholder="בחר מיקום" />
                                </SelectTrigger>
                                <SelectContent>
                                    <SelectItem value="גדוד">גדוד</SelectItem>
                                    <SelectItem value="מחסן">מחסן</SelectItem>
                                </SelectContent>
                            </Select>
                        </div>
                        
                        {creditItems.map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row items-start gap-4 mb-4">
                                <div className="w-full md:w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={String(item.is_explosion ?? selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'is_explosion' as any, val === 'true', creditItems, setCreditItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="false">קליעית</SelectItem>
                                            <SelectItem value="true">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 w-full flex gap-2">
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
                                                {(!(item.is_explosion ?? selectedTable) ? 
                                                    (creditLocation === 'גדוד' ? uniqueBallItems : uniqueBallItemsWarehouse) : 
                                                    (creditLocation === 'גדוד' ? uniqueExplosionItems : uniqueExplosionItemsWarehouse))
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
                        <DialogTitle className="text-right">העברת פריטים</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/* Transfer direction selection */}
                        <div className="grid grid-cols-2 gap-4 mb-4">
                            <div>
                                <Label className="text-right block mb-2">מ</Label>
                                <Select value={transferFrom} onValueChange={setTransferFrom}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="מיקום מקור" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="גדוד">גדוד</SelectItem>
                                        <SelectItem value="מחסן">מחסן</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                            <div>
                                <Label className="text-right block mb-2">אל</Label>
                                <Select value={transferTo} onValueChange={setTransferTo}>
                                    <SelectTrigger>
                                        <SelectValue placeholder="מיקום יעד" />
                                    </SelectTrigger>
                                    <SelectContent>
                                        <SelectItem value="גדוד" disabled={transferFrom === "גדוד"}>גדוד</SelectItem>
                                        <SelectItem value="מחסן" disabled={transferFrom === "מחסן"}>מחסן</SelectItem>
                                    </SelectContent>
                                </Select>
                            </div>
                        </div>
                        
                        {transferItems.map((item, index) => (
                            <div key={index} className="flex flex-col md:flex-row items-start gap-4 mb-4">
                                <div className="w-full md:w-40">
                                    <Label className="text-right block mb-2">סוג תחמושת</Label>
                                    <Select
                                        value={String(item.is_explosion ?? selectedTable)}
                                        onValueChange={(val) => updateItem(index, 'is_explosion' as any, val === 'true', transferItems, setTransferItems)}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר סוג תחמושת" />
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="false">קליעית</SelectItem>
                                            <SelectItem value="true">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>
                                <div className="flex-1 w-full flex gap-2">
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
                                                {(!(item.is_explosion ?? selectedTable) ? 
                                                    (transferFrom === 'גדוד' ? uniqueBallItems : uniqueBallItemsWarehouse) : 
                                                    (transferFrom === 'גדוד' ? uniqueExplosionItems : uniqueExplosionItemsWarehouse))
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
                            {loading ? "מעביר..." : "העבר"}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default AmmoStock;
