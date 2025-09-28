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
    מידה: string;
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
};

const EquipmentStock: React.FC<EquipmentStockProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [rawData, setRawData] = useState<LogisticItem[]>([]);
    const [aggregatedData, setAggregatedData] = useState<AggregatedItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const [uniqueItems, setUniqueItems] = useState<string[]>([]);

    // Dialog states
    const [addDialogOpen, setAddDialogOpen] = useState(false);
    const [creditDialogOpen, setCreditDialogOpen] = useState(false);
    const [transferDialogOpen, setTransferDialogOpen] = useState(false);

    // Form data states
    const [addItems, setAddItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1}]);
    const [creditItems, setCreditItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1}]);
    const [transferItems, setTransferItems] = useState<ItemFormData[]>([{פריט: "", כמות: 1}]);

    // Grid configuration
    const gridRef = useRef<AgGridReact>(null);

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
        if (permissions['Logistic']) {
            try {
                setLoading(true);
                const {data, error} = await supabase
                    .from("logistic")
                    .select("*")
                    .eq("פלוגה", selectedSheet.range);

                if (error) {
                    console.error("Error fetching data:", error);
                    setStatusMessage({
                        text: `שגיאה בטעינת נתונים: ${error.message}`,
                        type: "error"
                    });
                } else {
                    // @ts-ignore
                    setRawData(data || []);
                    // @ts-ignore
                    processData(data || []);
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
    const processData = (data: LogisticItem[]) => {
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

        setAggregatedData(aggregated);
        setUniqueItems(Array.from(uniqueItemsSet));
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

            // Prepare items for insertion
            const itemsToInsert = validItems.map(item => ({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                מידה: '',
                כמות: item.כמות,
                צורך: 'ניפוק',
                סטטוס: 'החתמה',
                הערה: 'החתמה חדשה',
                משתמש: permissions['name'] || '',
                פלוגה: selectedSheet.range,
                חתימת_מחתים: ''
            }));

            // Insert into Supabase
            const {error} = await supabase.from("logistic").insert(itemsToInsert);

            if (error) {
                console.error("Error inserting items:", error);
                setStatusMessage({
                    text: `שגיאה בהוספת פריטים: ${error.message}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים נוספו בהצלחה",
                    type: "success"
                });
                setAddDialogOpen(false);
                setAddItems([{פריט: "", כמות: 1}]);
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

            // Prepare items for insertion
            const itemsToInsert = validItems.map(item => ({
                תאריך: new Date().toLocaleString('he-IL'),
                פריט: item.פריט,
                מידה: '',
                כמות: item.כמות,
                צורך: 'זיכוי',
                סטטוס: 'החתמה',
                הערה: 'זיכוי חדש',
                משתמש: permissions['name'] || '',
                פלוגה: selectedSheet.range,
                חתימת_מחתים: ''
            }));

            // Insert into Supabase
            const {error} = await supabase.from("logistic").insert(itemsToInsert);

            if (error) {
                console.error("Error crediting items:", error);
                setStatusMessage({
                    text: `שגיאה בזיכוי פריטים: ${error.message}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים זוכו בהצלחה",
                    type: "success"
                });
                setCreditDialogOpen(false);
                setCreditItems([{פריט: "", כמות: 1}]);
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

            // Prepare items for insertion - create pairs of entries
            const itemsToInsert = [];

            for (const item of validItems) {
                // Credit from current unit (גדוד)
                itemsToInsert.push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    מידה: '',
                    כמות: item.כמות,
                    צורך: 'זיכוי',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: selectedSheet.range === 'גדוד' ? 'גדוד' : 'מחסן',
                    הערה: 'העברת פריטים בין הגדוד למחסן',
                    חתימת_מחתים: ''
                });

                // Issue to storage (מחסן)
                itemsToInsert.push({
                    תאריך: new Date().toLocaleString('he-IL'),
                    פריט: item.פריט,
                    מידה: '',
                    כמות: item.כמות,
                    צורך: 'ניפוק',
                    סטטוס: 'החתמה',
                    משתמש: permissions['name'] || '',
                    פלוגה: selectedSheet.range !== 'גדוד' ? 'גדוד' : 'מחסן',
                    הערה: 'העברת פריטים בין הגדוד למחסן',
                    חתימת_מחתים: ''
                });
            }

            // Insert into Supabase
            const {error} = await supabase.from("logistic").insert(itemsToInsert);

            if (error) {
                console.error("Error transferring items:", error);
                setStatusMessage({
                    text: `שגיאה בהעברת פריטים: ${error.message}`,
                    type: "error"
                });
            } else {
                setStatusMessage({
                    text: "הפריטים הועברו בהצלחה",
                    type: "success"
                });
                setTransferDialogOpen(false);
                setTransferItems([{פריט: "", כמות: 1}]);
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
        setItems([...items, {פריט: "", כמות: 1}]);
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
            {permissions['Logistic'] && (
                <div className="flex justify-between mb-1">
                    <div className="space-x-2">
                    <h2 className="text-2xl font-bold">{selectedSheet.name}</h2>
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
                        </div>ֿ
                </div>
            )}

            {/* Data grid */}
            <div className="ag-theme-alpine rtl" style={{height: "60vh", width: "40vh", direction: "rtl"}}>
                <AgGridReact
                    ref={gridRef}
                    rowData={aggregatedData}
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

            {/* Add Items Dialog */}
            <Dialog open={addDialogOpen} onOpenChange={setAddDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto">
                    <DialogHeader>
                        <DialogTitle className="text-right">הוספת פריטים</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {addItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        options={uniqueItems.map(name => ({value: name, label: name}))}
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
                        {creditItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        options={uniqueItems.map(name => ({value: name, label: name}))}
                                        value={item.פריט ? {value: item.פריט, label: item.פריט} : null}
                                        onChange={(selectedOption) => {
                                            updateItem(
                                                index,
                                                'פריט',
                                                selectedOption ? selectedOption.value : '',
                                                creditItems,
                                                setCreditItems
                                            );
                                        }}
                                        isSearchable
                                        placeholder="בחר פריט"
                                        classNamePrefix="select"
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
                                            creditItems,
                                            setCreditItems
                                        )}
                                        min="1"
                                        className="text-right"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index, creditItems, setCreditItems)}
                                    disabled={creditItems.length === 1}
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
                        {transferItems.map((item, index) => (
                            <div key={index} className="flex items-center gap-4">
                                <div className="flex-1">
                                    <Label className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        options={uniqueItems.map(name => ({value: name, label: name}))}
                                        value={item.פריט ? {value: item.פריט, label: item.פריט} : null}
                                        onChange={(selectedOption) => {
                                            updateItem(
                                                index,
                                                'פריט',
                                                selectedOption ? selectedOption.value : '',
                                                transferItems,
                                                setTransferItems
                                            );
                                        }}
                                        isSearchable
                                        placeholder="בחר פריט"
                                        classNamePrefix="select"
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
                                            transferItems,
                                            setTransferItems
                                        )}
                                        min="1"
                                        className="text-right"
                                    />
                                </div>

                                <Button
                                    variant="ghost"
                                    size="icon"
                                    onClick={() => removeItem(index, transferItems, setTransferItems)}
                                    disabled={transferItems.length === 1}
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

export default EquipmentStock;
