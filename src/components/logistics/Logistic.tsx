import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient"
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Check, ChevronsUpDown, Trash, LayoutGrid, Table} from "lucide-react";
import {ColDef} from "ag-grid-community";
import CreatableSelect from 'react-select/creatable';

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {usePermissions} from "@/contexts/PermissionsContext";
import SignatureCanvas from "react-signature-canvas";
import {Label} from "@/components/ui/label";
// import jsPDF from "/../../../jsPDF";
import autoTable from "jspdf-autotable";
import * as XLSX from "xlsx";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
// Import logo for PDF export
import logoImg from "@/assets/logo.jpeg";
import jsPDF from "jspdf";

const STATUSES = ['החתמה', 'הזמנה', 'התעצמות'] as const;

// Map internal status names to display names
const STATUS_DISPLAY_MAP: Record<string, string> = {
    'החתמה': 'החתמה',
    'הזמנה': 'דרישות',
    'התעצמות': 'התעצמות'
};

interface LogisticProps {
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
    מספר_אישי_החותם?: number;
    מספר_אישי_מחתים?: number;
    פלוגה: string;
    חתימת_מחתים?: string;
    created_at?: string;
};

const Logistic: React.FC<LogisticProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<LogisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    // Dialog states
    const [open, setOpen] = useState(false);
    const [dataURL, setDataURL] = useState('');
    const [dialogMode, setDialogMode] = useState<'הזמנה' | 'החתמה'>('הזמנה');
    const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<LogisticItem | null>(null);
    const [selectedMatchingRows, setSelectedMatchingRows] = useState<LogisticItem[]>([]);
    const [matchingDateRows, setMatchingDateRows] = useState<LogisticItem[]>([]);
    const signatureRef = useRef<SignatureCanvas>(null);
    const [selectedRows, setSelectedRows] = useState<LogisticItem[]>([]);
    const gridRef = useRef<any>(null);
    const [customItemInput, setCustomItemInput] = useState(''); // For tracking custom item input

    const [signerName, setSignerName] = useState('');
    const [signerPersonalId, setSignerPersonalId] = useState(0);
    const [signatureItemPopoverOpen, setSignatureItemPopoverOpen] = useState(false);
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [activeTab, setActiveTab] = useState<string>('הזמנה'); // Track active tab
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards'); // Toggle between table and card view
    const [cardDetailModalOpen, setCardDetailModalOpen] = useState(false);
    const [selectedCardItem, setSelectedCardItem] = useState<LogisticItem | null>(null);
    const [showInfoText, setShowInfoText] = useState(true);

    // Import logo image for PDF
    const [logoBase64, setLogoBase64] = useState<string>('');

    // Load logo image as base64 on component mount
    useEffect(() => {
        const loadLogo = async () => {
            try {
                // Use the imported logoImg directly instead of fetching
                const img = new Image();
                img.src = logoImg;
                img.onload = () => {
                    const canvas = document.createElement('canvas');
                    canvas.width = img.width;
                    canvas.height = img.height;
                    const ctx = canvas.getContext('2d');
                    ctx?.drawImage(img, 0, 0);
                    setLogoBase64(canvas.toDataURL('image/jpeg'));
                };
            } catch (error) {
                console.error('Error loading logo:', error);
            }
        };
        loadLogo();
    }, []);

    // Default item template for form
    const defaultItem = {
        פריט: '',
        כמות: undefined,
        צורך: 'ניפוק',
        הערה: '',
        שם_החותם: '',
        חתימה: '',
        סטטוס: 'הזמנה',
        חתימת_מחתים: '',
    };

    // Form items state (dynamic rows)
    const [items, setItems] = useState<Partial<LogisticItem>[]>([{...defaultItem}]);
    const [editedItems, setEditedItems] = useState<Partial<LogisticItem>[]>([getEmptyItem()]);
    const [originalItem, setOriginalItem] = useState<any>(null);

    // Helper function to create an empty item
    function getEmptyItem(): Partial<LogisticItem> {
        return {
            פריט: '',
            כמות: undefined,
            צורך: 'ניפוק',
            הערה: ''
        };
    }

    // Fetch data from Supabase
    const fetchData = async () => {

        if (permissions[selectedSheet.range] || permissions['logistic']) {
            try {
                setLoading(true);
                
                // Fetch data for both current פלוגה and גדוד in chunks
                let allData: LogisticItem[] = [];
                let offset = 0;
                const chunkSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const {data, error} = await supabase
                        .from("logistic")
                        .select("*")
                        .in("פלוגה", [selectedSheet.range, "גדוד"])
                        .range(offset, offset + chunkSize - 1);

                    if (error) {
                        console.error("Error fetching data:", error);
                        setStatusMessage({
                            text: `שגיאה בטעינת נתונים: ${error.message}`,
                            type: "error"
                        });
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
                setRowData(allData);

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

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [selectedSheet.range]);

    // Group data by סטטוס (includes both current פלוגה and גדוד for calculations)
    const dataByStatus = useMemo(() => {
        const grouped = {הזמנה: [], החתמה: [], התעצמות: []} as Record<string, LogisticItem[]>;

        // First group the items by status (all data including גדוד)
        rowData.forEach(item => {
            if (STATUSES.includes(item.סטטוס as any)) {
                if (!grouped[item.סטטוס]) {
                    grouped[item.סטטוס] = [];
                }
                grouped[item.סטטוס].push(item);
            }
        });

        // Now sort הזמנה and התעצמות items by date (newest first)
        ['הזמנה', 'התעצמות'].forEach(status => {
            if (grouped[status] && grouped[status].length > 0) {
                grouped[status].sort((a, b) => {
                    const dateA = new Date(a.תאריך || '').getTime();
                    const dateB = new Date(b.תאריך || '').getTime();
                    return dateB - dateA; // Sort in descending order (newest first)
                });
            }
        });

        return grouped;
    }, [rowData]);

    // Filtered data for display (only current פלוגה, excludes גדוד)
    const displayDataByStatus = useMemo(() => {
        const filtered = {הזמנה: [], החתמה: [], התעצמות: []} as Record<string, LogisticItem[]>;
        
        Object.keys(dataByStatus).forEach(status => {
            filtered[status] = dataByStatus[status].filter(item => item.פלוגה === selectedSheet.range);
        });
        
        return filtered;
    }, [dataByStatus, selectedSheet.range]);

    // Group data by תאריך for card view based on active tab
    const groupedByDate = useMemo(() => {
        const currentTabData = displayDataByStatus[activeTab] || [];
        const grouped: { [date: string]: LogisticItem[] } = {};
        
        currentTabData.forEach(item => {
            const date = item.תאריך || '';
            if (!grouped[date]) {
                grouped[date] = [];
            }
            grouped[date].push(item);
        });
        
        // Sort dates in descending order (newest first)
        const sortedEntries = Object.entries(grouped).sort((a, b) => {
            // Parse Hebrew locale date format: "dd.mm.yyyy, hh:mm:ss"
            const parseHebrewDate = (dateStr: string) => {
                if (!dateStr) return 0;
                // Format: "20.12.2025, 21:38:45"
                const [datePart, timePart] = dateStr.split(', ');
                if (!datePart) return 0;
                
                const [day, month, year] = datePart.split('.').map(Number);
                const [hours = 0, minutes = 0, seconds = 0] = (timePart || '').split(':').map(Number);
                
                return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
            };
            
            const dateA = parseHebrewDate(a[0]);
            const dateB = parseHebrewDate(b[0]);
            return dateB - dateA;
        });
        
        return sortedEntries;
    }, [displayDataByStatus, activeTab]);

    // Get all unique item names from both גדוד and current פלוגה - for הזמנה (דרישות)
    const allItemNames = useMemo(() => {
        const items = dataByStatus['החתמה'] || [];
        
        // Filter items from both גדוד and current פלוגה
        const relevantItems = items.filter(item => 
            item.פלוגה === 'גדוד' || item.פלוגה === selectedSheet.range
        );
        
        // Get all unique item names (no quantity filtering for הזמנה)
        const uniqueItems = new Set<string>();
        relevantItems.forEach(item => {
            if (item.פריט) {
                uniqueItems.add(item.פריט);
            }
        });

        return Array.from(uniqueItems).sort();
    }, [dataByStatus, selectedSheet.range]);

    // Get unique item names from החתמה items for dropdown (גדוד and selectedSheet.range items with כמות > 0)
    const uniqueItemNames = useMemo(() => {
        const items = dataByStatus['החתמה'] || [];
        
        // Filter items from גדוד and current selectedSheet.range
        const relevantItems = items.filter(item => 
            item.פלוגה === 'גדוד' || item.פלוגה === selectedSheet.range
        );
        
        // Calculate quantities for each item
        const itemQuantities = new Map<string, number>();
        relevantItems.forEach(item => {
            const currentQty = itemQuantities.get(item.פריט) || 0;
            const quantityChange = item.צורך === 'זיכוי' ? -item.כמות : item.כמות;
            itemQuantities.set(item.פריט, currentQty + quantityChange);
        });
        
        // Only include items with כמות > 0
        const uniqueItems = new Set<string>();
        itemQuantities.forEach((quantity, itemName) => {
            if (quantity > 0) {
                uniqueItems.add(itemName);
            }
        });

        return Array.from(uniqueItems).sort();
    }, [dataByStatus, selectedSheet.range]);

    const summaryColumns = useMemo<ColDef<LogisticItem>[]>(() => {
        return [
            {field: 'פריט' as keyof LogisticItem, headerName: 'פריט', sortable: true, filter: true, width: 200},
            {
                field: 'כמות' as keyof LogisticItem,
                headerName: 'סה"כ כמות',
                sortable: true,
                filter: true,
                width: 150,
                valueFormatter: (params: any) => {
                    return params.value !== undefined ? params.value.toString() : '';
                }
            },
        ];
    }, []);

    // Create summary data for החתמה table (only display current פלוגה)
    const summarizedSignatureData = useMemo(() => {
        // Get only החתמה data from current פלוגה (not גדוד)
        const signatureData = displayDataByStatus['החתמה'] || [];

        if (signatureData.length === 0) {
            return [];
        }

        // Create a map to group by פריט (item) and sum up כמות (quantity)
        const itemSummary = new Map<string, LogisticItem>();

        // Process each row
        signatureData.forEach((row: LogisticItem) => {
            const item = row.פריט;
            const quantity = typeof row.כמות === 'number' ? row.כמות : parseInt(String(row.כמות), 10) || 0;
            // If צורך is זיכוי, make quantity negative
            const adjustedQuantity = row.צורך === 'זיכוי' ? -quantity : quantity;

            if (itemSummary.has(item)) {
                // Item exists, update quantity
                const existing = itemSummary.get(item)!;
                existing.כמות = (existing.כמות || 0) + adjustedQuantity;

                // Keep the latest date
                const existingDate = new Date(existing.תאריך || '').getTime() || 0;
                const currentDate = new Date(row.תאריך || '').getTime() || 0;
                if (currentDate > existingDate) {
                    existing.תאריך = row.תאריך;
                    existing.משתמש = row.משתמש || '';
                    existing.שם_החותם = row.שם_החותם || '';
                }
            } else {
                // New item, add to map
                itemSummary.set(item, {
                    פריט: item,
                    כמות: adjustedQuantity,
                    תאריך: row.תאריך || '',
                    משתמש: row.משתמש || '',
                    שם_החותם: row.שם_החותם || '',
                    סטטוס: 'החתמה',
                    פלוגה: row.פלוגה,
                    צורך: row.צורך,
                    חתימת_מחתים: row.חתימת_מחתים
                });
            }
        });

        // Convert map to array and filter out items with כמות 0
        return Array.from(itemSummary.values()).filter(item => item.כמות !== 0);
    }, [displayDataByStatus]);

    // AG Grid column definitions
    const baseColumns = useMemo<ColDef<LogisticItem>[]>(() => {
        const columnDefs: ColDef<LogisticItem>[] = [
            {
                width: 35,
                pinned: 'right',
                headerName: '',
                colId: 'checkboxCol'
            },
            {field: 'תאריך' as keyof LogisticItem, headerName: 'תאריך', sortable: true, filter: true, width: 160, sort: 'desc', sortIndex: 0},
            {field: 'פריט' as keyof LogisticItem, headerName: 'פריט', sortable: true, filter: true, width: 110},
            {field: 'כמות' as keyof LogisticItem, headerName: 'כמות', sortable: true, filter: true, width: 70,},
            {field: 'צורך' as keyof LogisticItem, headerName: 'צורך', sortable: true, filter: true, width: 80},
            {field: 'הערה' as keyof LogisticItem, headerName: 'הערה', sortable: true, filter: true, width: 110},
            {field: 'משתמש' as keyof LogisticItem, headerName: 'דורש', sortable: true, filter: true, width: 110},
            {
                headerName: 'נקרא',
                field: 'נקרא' as keyof LogisticItem,
                sortable: true,
                filter: true,
                width: 80,
                editable: permissions['logistic'],
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {values: ['כן', 'לא']},
                onCellValueChanged: async (params: any) => {
                    await handleReadStatusChange(params);
                }
            },
            {
                field: 'סטטוס' as keyof LogisticItem, headerName: 'סטטוס', sortable: true, filter: true, width: 100,
                editable: permissions['logistic'],
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {values: ['הזמנה', 'התעצמות']},
                onCellValueChanged: async (params: any) => {
                    await handleStatusChange(params);
                }
            },
        ];

        return columnDefs;
    }, [permissions, activeTab]);

    const handleDateClicked = async (data: any) => {
        const date = data.תאריך;

        // Find all rows with the same date in rowData
        const matchingRows = rowData.filter(item => item.תאריך === date && item.סטטוס === 'הזמנה');

        // Create items array from matching rows
        const itemsToShow = matchingRows.filter(row => row.צורך !== 'בלאי')
            .map(row => ({
            פריט: row.פריט || '',
            כמות: row.כמות || 1,
            צורך: row.צורך || 'ניפוק',
            הערה: row.הערה || '',
        }));

        if (matchingRows.length > 0) {
            setSignerName(matchingRows[0].משתמש);
            setSignerPersonalId(matchingRows[0].מספר_אישי_מחתים ?? 0);
            const signatureData = matchingRows[0].חתימת_מחתים ?? '';
            setDataURL(signatureData);
        }

        // Set the items state to populate the dialog
        setItems(itemsToShow);

        // Set dialog mode to signature
        setDialogMode('החתמה');

        // Open the signature dialog
        setSignatureDialogOpen(true);
    }
    // Handle AG Grid status change
    const handleStatusChange = async (params: any) => {
        const {data} = params;
        const id = data.id;
        const ddate = data['תאריך'];
        const ditem = data['פריט'];
        const oldStatus = params.oldValue;
        const newStatus = params.newValue;

        try {
            // Update the status in Supabase
            const {error} = await supabase
                .from('logistic')
                .update({סטטוס: newStatus})
                .eq('id', id);

            if (error) {
                console.error("Error updating status:", error);
                // Revert to old value if there was an error
                params.node.setDataValue('סטטוס', params.oldValue);
                setStatusMessage({
                    text: `שגיאה בעדכון סטטוס: ${error.message}`,
                    type: "error"
                });
                return;
            }

            // Refresh data after update
            fetchData();
            setStatusMessage({text: `סטטוס עודכן בהצלחה - תאריך: ${ddate}, פריט: ${ditem}, מ-"${oldStatus}" ל-"${newStatus}"`, type: "success"});
        } catch (err: any) {
            console.error("Unexpected error during status update:", err);
            // Revert to old value
            params.node.setDataValue('סטטוס', params.oldValue);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    // Handle opening card detail modal
    const handleCardClick = (item: LogisticItem) => {
        setSelectedCardItem(item);
        setCardDetailModalOpen(true);
    };

    // Handle delete item from card detail modal
    const handleDeleteCardItem = async () => {
        if (!selectedCardItem?.id) {
            setStatusMessage({text: "שגיאה: לא ניתן למחוק פריט ללא מזהה", type: "error"});
            return;
        }

        if (selectedCardItem.נקרא === 'כן') {
            setStatusMessage({text: "לא ניתן למחוק פריט שנקרא כבר", type: "error"});
            return;
        }

        try {
            const {error} = await supabase
                .from("logistic")
                .delete()
                .eq("id", selectedCardItem.id);

            if (error) {
                console.error("Error deleting item:", error);
                setStatusMessage({text: `שגיאה במחיקת פריט: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after delete
            await fetchData();
            setStatusMessage({
                text: `פריט נמחק בהצלחה - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}, הערה: ${selectedCardItem.הערה || 'אין'}`,
                type: "success"
            });
            setCardDetailModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during delete:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    // Handle toggle read status from card detail modal
    const handleToggleCardReadStatus = async () => {
        if (!selectedCardItem?.id) {
            setStatusMessage({text: "שגיאה: לא ניתן לעדכן פריט ללא מזהה", type: "error"});
            return;
        }

        const currentStatus = selectedCardItem.נקרא;
        const newStatus = currentStatus === 'כן' ? 'לא' : 'כן';

        try {
            const {error} = await supabase
                .from("logistic")
                .update({"נקרא": newStatus})
                .eq("id", selectedCardItem.id);

            if (error) {
                console.error("Error updating read status:", error);
                setStatusMessage({text: `שגיאה בעדכון סטטוס קריאה: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after update
            await fetchData();
            setStatusMessage({
                text: `סטטוס קריאה עודכן - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}, נקרא: ${currentStatus} -> ${newStatus}`,
                type: "success"
            });
            setCardDetailModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during read status update:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    // Handle toggle status (הזמנה/התעצמות) from card detail modal
    const handleToggleCardStatus = async () => {
        if (!selectedCardItem?.id) {
            setStatusMessage({text: "שגיאה: לא ניתן לעדכן פריט ללא מזהה", type: "error"});
            return;
        }

        const currentStatus = selectedCardItem.סטטוס;
        const newStatus = currentStatus === 'הזמנה' ? 'התעצמות' : 'הזמנה';

        try {
            const {error} = await supabase
                .from("logistic")
                .update({"סטטוס": newStatus})
                .eq("id", selectedCardItem.id);

            if (error) {
                console.error("Error updating status:", error);
                setStatusMessage({text: `שגיאה בעדכון סטטוס: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after update
            await fetchData();
            setStatusMessage({
                text: `סטטוס עודכן - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}, סטטוס: ${currentStatus} -> ${newStatus}`,
                type: "success"
            });
            setCardDetailModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during status update:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    // Handle read status toggle for card view (kept for backward compatibility)
    const handleCardReadStatusToggle = async (item: LogisticItem) => {
        if (!item.id) {
            setStatusMessage({text: "שגיאה: לא ניתן לעדכן פריט ללא מזהה", type: "error"});
            return;
        }

        const currentStatus = item.נקרא;
        const newStatus = currentStatus === 'כן' ? 'לא' : 'כן';

        try {
            const {error} = await supabase
                .from("logistic")
                .update({"נקרא": newStatus})
                .eq("id", item.id);

            if (error) {
                console.error("Error updating read status:", error);
                setStatusMessage({text: `שגיאה בעדכון סטטוס קריאה: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after update
            await fetchData();
            setStatusMessage({text: `סטטוס קריאה עודכן בהצלחה - ${item.פריט} שונה ל-"${newStatus}"`, type: "success"});
        } catch (err: any) {
            console.error("Unexpected error during read status update:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    // Handle read status change
    const handleReadStatusChange = async (params: any) => {
        const {data} = params;
        const id = data.id;
        const ddate = data['תאריך'];
        const ditem = data['פריט'];
        const damount = data['כמות'];
        const oldReadStatus = params.oldValue;
        const newReadStatus = params.newValue;

        try {

            const {data, error} = await supabase
                .from("logistic")
                .update({"נקרא": newReadStatus}) // key must be quoted
                .eq("id", id)
                // .eq("פריט", ditem)
                // .eq("כמות", damount)
                .select();

            if (error) {
                console.error("Error updating read status:", error);
                // Revert to old value if there was an error
                params.node.setDataValue('נקרא', params.oldValue);
                setStatusMessage({text: `שגיאה בעדכון סטטוס קריאה: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after update
            fetchData();
            setStatusMessage({text: `סטטוס קריאה עודכן בהצלחה - תאריך: ${ddate}, פריט: ${ditem}, מ-"${oldReadStatus}" ל-"${newReadStatus}"`, type: "success"});
        } catch (err: any) {
            console.error("Unexpected error during read status update:", err);
            // Revert to old value
            params.node.setDataValue('נקרא', params.oldValue);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            setDataURL(sigPadRef.current.getCanvas().toDataURL("image/png"));
        }
    };

    // Function to add a new logistic item
    const handleAddItem = async () => {
        setStatusMessage({text: "", type: ""});


        // Input validation
        const invalidItems = items.filter(item => !item.פריט || !item.כמות || item.כמות <= 0);
        if (invalidItems.length > 0) {
            setStatusMessage({text: "יש למלא את כל השדות הנדרשים (כולל כמות)", type: "error"});
            setOpen(false);
            setSignatureDialogOpen(false);
            setLoading(false);
            return;
        }

        // Validate personal ID for החתמה mode
        if (dialogMode === 'החתמה' && !signerPersonalId) {
            setStatusMessage({text: "יש למלא את כל השדות הנדרשים", type: "error"});
            setOpen(false);
            setLoading(false);
            setSignatureDialogOpen(false);
            return;
        }

        // Validate צורך for החתמה mode - only allow ניפוק or זיכוי
        if (dialogMode === 'החתמה') {
            const invalidItems = items.filter(item => item.צורך !== 'ניפוק' && item.צורך !== 'זיכוי');
            if (invalidItems.length > 0) {
                setStatusMessage({text: "בהחתמה ניתן לבחור רק ניפוק או זיכוי", type: "error"});
                setOpen(false);
                setLoading(false);
                setSignatureDialogOpen(false);
                return;
            }
        }

        // Validate that זיכוי won't result in negative quantities in הזמנה (דרישות) mode
        if (dialogMode === 'הזמנה') {
            const signatureData = dataByStatus['החתמה'] || [];

            for (const item of items) {
                if (item.צורך === 'זיכוי') {
                    // Calculate current quantity for this item in החתמה status for current פלוגה
                    const itemData = signatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                    const currentQty = itemData.reduce((sum, i) => sum + (i.כמות || 0), 0);

                    const itemQty = item.כמות || 0;

                    // Check if זיכוי would lead to negative total quantity
                    if (currentQty - itemQty < 0) {
                        setStatusMessage({
                            text: `לא ניתן לזכות - הכמות תהיה שלילית:\n${item.פריט} (כמות נוכחית: ${currentQty}, מנסה לזכות: ${itemQty}, יתרה חדשה: ${currentQty - itemQty})`,
                            type: "error"
                        });
                        setLoading(false);
                        setOpen(false);
                        setSignatureDialogOpen(false);
                        return;
                    }
                }
            }
        }

        // Validate that זיכוי won't result in negative quantities in החתמה
        if (dialogMode === 'החתמה') {
            const signatureData = dataByStatus['החתמה'] || [];

            for (const item of items) {
                // Calculate current quantity for this item in החתמה status
                // Note: כמות in database already has correct sign (negative for זיכוי)
                const itemData = signatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                const currentQty = itemData.reduce((sum, i) => sum + ( i.צורך=== 'ניפוק' ? i.כמות : -i.כמות || 0), 0);
                const itemQty = item.כמות || 0;

                // Check if זיכוי would lead to negative total quantity
                if (item.צורך === 'זיכוי' && currentQty - itemQty < 0) {
                    setStatusMessage({
                        text: `לא ניתן לזכות - הכמות תהיה שלילית:\n${item.פריט} (כמות נוכחית: ${currentQty}, מנסה לזכות: ${itemQty}, יתרה חדשה: ${currentQty - itemQty})`,
                        type: "error"
                    });
                    setLoading(false);
                    setOpen(false);
                    setSignatureDialogOpen(false);
                    return;
                }

                // Validate inventory based on צורך type
                // For ניפוק (issue): check גדוד inventory
                // For זיכוי (credit): check current location inventory (already checked above)
                if (item.צורך === 'ניפוק') {
                    // Get ALL החתמה data to check גדוד inventory
                    const allSignatureData = dataByStatus['החתמה'] || [];
                    const battalionData = allSignatureData.filter(i => i.פריט === item.פריט && i.פלוגה === 'גדוד');
                    const battalionQty = battalionData.reduce((sum, i) => sum + ((i.צורך === 'זיכוי') ? -i.כמות : i.כמות), 0);

                    // When issuing (ניפוק), גדוד loses items
                    const newBattalionQty = battalionQty - itemQty;

                    if (newBattalionQty < 0) {
                        setStatusMessage({
                            text: `לא ניתן להחתים - מלאי גדוד יהיה שלילי:\n${item.פריט} (מלאי נוכחי בגדוד: ${battalionQty}, מנסה לנפק: ${itemQty}, מלאי חדש: ${newBattalionQty})`,
                            type: "error"
                        });
                        setLoading(false);
                        setOpen(false);
                        setSignatureDialogOpen(false);
                        return;
                    }
                }
            }
        }
        // Format items for insertion
        const formattedDate = new Date().toLocaleString('he-IL');
        let formattedItems = items.map(item => ({
            תאריך: formattedDate,
            פריט: item.פריט,
            כמות: item.כמות || 1,
            שם_החותם: signerName,
            מספר_אישי_החותם: signerPersonalId,
            מספר_אישי_מחתים: permissions['id'] || 0,
            חתימת_מחתים: permissions['signature'] ? String(permissions['signature']) : '',
            חתימה: dataURL,
            צורך: item.צורך,
            הערה: item.הערה || '',
            סטטוס: dialogMode,
            משתמש: permissions['name'] || '',
            פלוגה: selectedSheet.range,
        }));

        // If it's a formal signature (החתמה), create battalion entries
        if (dialogMode === 'החתמה') {
            // Create mirror entries for battalion inventory tracking
            const battalionEntries = items.map(item => ({
                תאריך: formattedDate,
                פריט: item.פריט,
                כמות: item.כמות || 1,
                שם_החותם: '',
                מספר_אישי_החותם: 0,
                מספר_אישי_מחתים: 0,
                חתימת_מחתים: '',
                חתימה: '',
                צורך: (item.צורך === 'ניפוק') ? 'זיכוי' : 'ניפוק',
                הערה: '',
                סטטוס: dialogMode,
                משתמש: permissions['name'] || '',
                פלוגה: 'גדוד', // Battalion inventory
            }));

            // Combine original items with battalion entries
            formattedItems = [...formattedItems, ...battalionEntries];
        }

        try {
            setLoading(true);

            // Insert new items to Supabase
            const {data, error} = await supabase
                .from('logistic')
                .insert(formattedItems)
                .select();

            if (error) {
                console.error("Error adding items:", error);
                setStatusMessage({text: `שגיאה בהוספת פריטים: ${error.message}`, type: "error"});
            } else {
                // Reset form and close dialog
                const itemsList = formattedItems.filter(item => item.פלוגה===selectedSheet.range).map(item => `${item.פריט} (${item.צורך==='ניפוק' ? item.כמות : item.כמות}-)`).join(', ');
                const action = dialogMode === 'הזמנה' ? 'דווחו' : 'הוחתמו/ זוכו';
                setItems([{...defaultItem}]);
                await fetchData();
                setOpen(false);
                setSignatureDialogOpen(false);
                setSignerName('');
                setSignerPersonalId(0);
                setStatusMessage({text: `${action} פריטים בהצלחה: ${itemsList}`, type: "success"});
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        } finally {
            setOpen(false);
            setSignatureDialogOpen(false);
            setLoading(false);
        }
    };

    const handleDeleteSelectedItems = async () => {

        try {
            setLoading(true);

            if (selectedRows.filter(row => row.נקרא === 'כן').length > 0) {
                setStatusMessage({text: `לא ניתן למחוק פריטים שנקראו`, type: "error"});
                return;
            }
            // Extract IDs from selected rows
            const selectedIds = selectedRows.map(row => row.id);

            const {error} = await supabase
                .from('logistic')
                .delete()
                .in('id', selectedIds);

            if (error) {
                console.error("Error deleting items:", error);
                setStatusMessage({text: `שגיאה במחיקת פריטים: ${error.message}`, type: "error"});
            } else {
                // Create detailed message with deleted items info
                const deletedItemsDetails = selectedRows.map(row =>
                    `${row.פריט} (כמות: ${row.כמות}, תאריך: ${row.תאריך})`
                ).join(', ');

                await fetchData();
                setSelectedRows([]);
                setStatusMessage({text: `${selectedRows.length} פריטים נמחקו בהצלחה: ${deletedItemsDetails}`, type: "success"});
            }
        } catch (err: any) {
            console.error("Unexpected error during deletion:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    const mirrorHebrewSmart = (str: string) => {
        if (str === null || str === undefined || str === '') return '';
        return str
            .split(/\s+/)
            .map(word =>
                /[\u0590-\u05FF]/.test(word) ? word.split('').reverse().join('') : word
            )
            .reverse() // Reverse word order too
            .join(' ');
    };

    // Function to create PDF export
    const handlePdfExport = async () => {
        try {
            // Get active tab data to export (only current פלוגה, not גדוד)
            const dataToExport = displayDataByStatus['החתמה'] || [];

            if (dataToExport.length === 0) {
                return;
            }

            const doc = new jsPDF({
                orientation: 'portrait',
                unit: 'mm',
                format: 'a4'
            });

            // Add Hebrew font support
            doc.addFont('NotoSansHebrew-normal.ttf', 'NotoSansHebrew', 'normal');
            doc.setFont('NotoSansHebrew');

            // Get page dimensions
            const pageWidth = doc.internal.pageSize.getWidth();
            const pageHeight = doc.internal.pageSize.getHeight();
            const margin = 15;
            const today = new Date().toLocaleDateString('he-IL');

            // Group data by date
            const groupedByDate = dataToExport.reduce((groups: { [key: string]: LogisticItem[] }, item) => {
                const date = item.תאריך || '';
                if (!groups[date]) {
                    groups[date] = [];
                }
                groups[date].push(item);
                return groups;
            }, {});

            // Sort dates in descending order (newest first)
            const sortedDateEntries = Object.entries(groupedByDate).sort((a, b) => {
                const dateA = new Date(a[0] || '').getTime();
                const dateB = new Date(b[0] || '').getTime();
                return dateB - dateA; // Descending order (newest first)
            });

            // Process each date group on its own page
            let pageIndex = 0;
            for (const [date, items] of sortedDateEntries) {
                // Add new page if not the first group
                if (pageIndex > 0) {
                    doc.addPage();
                }
                pageIndex++;

                let y = margin;

                // Try to add logo - if it fails, continue without it
                try {
                    // Use imported logoImg directly without getBase64FromImg
                    doc.addImage(logoImg, 'JPEG', margin, y, 30, 30);
                } catch (logoErr) {
                    console.error("Error adding logo:", logoErr);
                    // Continue without logo
                }

                // Add header with title and date
                y += 35; // Increased from 20 to account for larger logo
                doc.setFontSize(18);
                doc.text(mirrorHebrewSmart(`טופס החתמה פלוגה ${selectedSheet.range}`), pageWidth - margin, y, {align: 'right'});

                // Add current date label on one row
                y += 12;
                doc.setFontSize(12);
                doc.text(mirrorHebrewSmart('תאריך:'), pageWidth - margin, y, {align: 'right'});
                // And date value below
                y += 7;
                doc.text(today, pageWidth - margin, y, {align: 'right'});

                // Add record date label on one row
                y += 10;
                doc.text(mirrorHebrewSmart('תאריך הרישום:'), pageWidth - margin, y, {align: 'right'});
                // And date value below
                y += 7;
                doc.text(date, pageWidth - margin, y, {align: 'right'});

                // Add table header for items (3 columns: פריט, כמות, צורך)
                y += 15;
                doc.setFillColor(240, 240, 240);
                doc.rect(margin, y, pageWidth - (2 * margin), 10, 'F');

                doc.setFontSize(12);
                const col1X = pageWidth - margin - 10; // פריט
                const col2X = pageWidth - margin - 80; // כמות
                const col3X = pageWidth - margin - 130; // צורך

                doc.text(mirrorHebrewSmart('פריט'), col1X, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('כמות'), col2X, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('צורך'), col3X, y + 7, {align: 'right'});

                // Add item details
                y += 15;
                items.forEach((item: LogisticItem, i: number) => {
                    doc.text(mirrorHebrewSmart(item.פריט || ''), col1X, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(`${Math.abs(item.כמות || 0)}`), col2X, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(item.צורך || ''), col3X, y, {align: 'right'});
                    y += 8;

                    // Add a light separator line
                    if (i < items.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(margin, y - 4, pageWidth - margin, y - 4);
                    }
                });

                // Footer with signature sections - make it bigger
                y = pageHeight - 120; // Changed from -50 to -120 for a bigger footer

                // Draw a line to separate content from signatures
                doc.setDrawColor(0, 0, 0);
                doc.line(margin, y - 10, pageWidth - margin, y - 10);

                // Create two-column layout for signatures (side by side)
                const columnWidth = (pageWidth - (2 * margin)) / 2;
                const startY = y;

                // Right column: מחתים (approver)
                doc.setFontSize(10);
                let rightY = startY;
                doc.text(mirrorHebrewSmart(items[0].משתמש || ''), pageWidth - margin - 10, rightY, {align: 'right'});
                rightY += 5;
                doc.text(mirrorHebrewSmart(String(items[0].מספר_אישי_מחתים || '')), pageWidth - margin - 10, rightY, {align: 'right'});
                rightY += 5;
                doc.text(mirrorHebrewSmart('מחלקת הלוגיסטיקה'), pageWidth - margin - 10, rightY, {align: 'right'});
                rightY += 5;

                // Add מחתים signature image
                if (items[0].חתימת_מחתים && items[0].חתימת_מחתים.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימת_מחתים, 'PNG', pageWidth / 2 + 5, rightY, columnWidth - 15, 30);
                    } catch (err) {
                        console.error("Error adding מחתים signature:", err);
                    }
                }

                // Left column: חותם (signer)
                let leftY = startY;
                doc.text(mirrorHebrewSmart(items[0].שם_החותם || ''), pageWidth / 2 - 10, leftY, {align: 'right'});
                leftY += 5;
                doc.text(mirrorHebrewSmart(String(items[0].מספר_אישי_החותם || '')), pageWidth / 2 - 10, leftY, {align: 'right'});
                leftY += 5;
                doc.text(mirrorHebrewSmart(selectedSheet.name || ''), pageWidth / 2 - 10, leftY, {align: 'right'});
                leftY += 5;

                // Add חותם signature image
                if (items[0].חתימה && items[0].חתימה.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימה, 'PNG', margin + 5, leftY, columnWidth - 15, 30);
                    } catch (err) {
                        console.error("Error adding חותם signature:", err);
                    }
                }

                // Add page number in the bottom center
                y = pageHeight - 10;
                doc.setFontSize(10);
                doc.text(`${pageIndex}/${Object.keys(groupedByDate).length}`, pageWidth / 2, y, {align: 'center'});
            }

            // Save the PDF
            doc.save(`${selectedSheet.name} - טופס החתמה לוגיסטיקה.pdf`);
            setStatusMessage({text: "הפקת דפי החתמה הושלמה בהצלחה", type: "success"});
        } catch (err) {
            console.error("Error in PDF creation:", err);
            setStatusMessage({text: `שגיאה ביצירת PDF: ${err}`, type: "error"});
        }
    };

    // Function to export data to Excel
    const handleExcelExport = () => {
        try {

            if (!rowData || rowData.length === 0) {
                setStatusMessage({text: "אין נתונים להורדה", type: "error"});
                return;
            }

            // Process data to remove 'id' field
            const exportData = rowData.map(item => {
                const {id, ...rest} = item; // Destructure to separate id from other fields
                return rest; // Return object without id field
            });
            // Create workbook and worksheet
            const wb = XLSX.utils.book_new();
            const ws = XLSX.utils.json_to_sheet(exportData);

            // Set RTL direction for Excel

            ws['!cols'] = baseColumns
                .filter(col => col.field) // Filter out checkbox column
            // .map(col => ({ wch: Math.floor(col.width / 8) })); // Approximate width conversion

            // Add the worksheet to the workbook
            XLSX.utils.book_append_sheet(wb, ws, `${selectedSheet.name}`);
            XLSX.writeFile(wb, `${selectedSheet.name} לוגיסטיקה .xlsx`);

        } catch (err: any) {
            console.error("Error exporting Excel:", err);
        }
    };

    // Default column definition for AG Grid
    const defaultColDef = {
        headerClass: 'ag-right-aligned-header',
        cellStyle: {textAlign: 'center'},
        resizable: true,
    };

    // Loading indicator
    if (loading) {
        return (
            <div className="flex flex-col items-center justify-center h-[50vh]">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                <p className="text-center p-4">טוען נתונים...</p>
            </div>
        );
    }

    function handleCloseModal() {
        setSignatureDialogOpen(false);
        setOpen(false);
        setSignerName('');
        setDataURL('');
        setItems([{...defaultItem}]);
    }

    return (
        <div className="container mx-auto p-4">

            {statusMessage.text && (
                <StatusMessage
                    message={statusMessage.text}
                    isSuccess={statusMessage.type === 'success'}
                    onClose={() => setStatusMessage({text: '', type: ''})}
                />
            )}

            {(permissions[selectedSheet.range] || permissions['logistic']) && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold">{selectedSheet.name}</h2>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => {
                                if (permissions['logistic']) {
                                    setDialogMode('החתמה');
                                    setSignatureDialogOpen(true);
                                } else {
                                    setDialogMode('הזמנה');
                                    setOpen(true);
                                }
                            }}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {permissions['logistic'] ? 'החתמה/ זיכוי פריטים' : 'הוספת דרישות'}
                        </Button>

                        {(activeTab === 'הזמנה' || activeTab === 'התעצמות') && (
                            <Button
                                onClick={handleDeleteSelectedItems}
                                className="bg-red-500 hover:bg-red-600"
                                disabled={selectedRows.length === 0}
                            >
                                מחק דרישה ({selectedRows.length})
                            </Button>
                        )}

                        <Button
                            onClick={handlePdfExport}
                            className="bg-green-500 hover:bg-green-600"
                        >
                            הורדת דפי החתמות
                        </Button>
                        {permissions['admin'] && (
                            <Button
                                onClick={handleExcelExport}
                                className="bg-green-500 hover:bg-green-600"
                            >
                                הורדה לאקסל
                            </Button>)}
                    </div>
                </div>
            )}

            {/* Status tabs */}
            <div className="border-b mb-4">
                <div className="flex overflow-x-auto">
                    {STATUSES.map(status => (
                        <button
                            key={status}
                            className={`py-2 px-4 ${activeTab === status ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                            onClick={() => setActiveTab(status)}
                        >
                            {STATUS_DISPLAY_MAP[status] || status}
                        </button>
                    ))}
                </div>
            </div>

            {/* View toggle for הזמנה and התעצמות tabs */}
            {(activeTab === 'הזמנה' || activeTab === 'התעצמות') && (
                <div className="flex justify-center gap-2 mb-4">
                    <Button
                        variant={viewMode === 'cards' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('cards')}
                        className="flex items-center gap-1"
                    >
                        <LayoutGrid className="h-4 w-4" />
                    </Button>
                    <Button
                        variant={viewMode === 'table' ? 'default' : 'outline'}
                        size="sm"
                        onClick={() => setViewMode('table')}
                        className="flex items-center gap-1"
                    >
                        <Table className="h-4 w-4" />
                    </Button>
                </div>
            )}

            {/* Info text for card operations */}
            {viewMode === 'cards' && showInfoText && (
                <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 mb-4 text-right relative">
                    <button
                        onClick={() => setShowInfoText(false)}
                        className="absolute left-2 top-2 text-blue-600 hover:text-blue-800 font-bold text-xl"
                        aria-label="Close"
                    >
                        ×
                    </button>
                    <h4 className="font-bold text-blue-900 mb-2">הפעולות שניתן לבצע הן:</h4>
                    <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                        {permissions['logistic'] && (
                            <>
                                <li>העברת דרישות להחתמה על ידי לחיצה על התאריך והשלמת פרטים.</li>
                                <li>לחיצה על כרטיסיה פנימית (פריט אחד) וסימון שנקרא (כלומר דיווח טופל), והפוך.</li>
                            </>
                        )}
                        <li>כרטיסיה עם רקע אדום נחשבת ככרטיסיה שנקראה וטופלה.</li>
                        <li>לחיצה על כרטיסיה פנימית (פריט אחד) ומחיקת הפריט במידה ולא נקראה. (במידה וישנו טעות בדרישה).</li>
                        <li>מעבר לטבלה על מנת לסנן ולהגיע לתוצאה רצויה.</li>
                    </ul>
                </div>
            )}

            {/* Conditional rendering: Card view or Table view */}
            {(activeTab === 'הזמנה' || activeTab === 'התעצמות') && viewMode === 'cards' ? (
                // Card view for הזמנה
                <div className="space-y-4 mb-8">
                    {groupedByDate.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            אין דרישות להצגה
                        </div>
                    ) : (
                        groupedByDate.map(([date, items]) => (
                            <div key={date} className="border rounded-lg shadow-sm bg-white overflow-hidden">
                                {/* Date header */}
                                <div
                                    className="bg-blue-50 border-b px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors"
                                    onClick={() => {
                                        if (permissions['logistic']) {
                                            handleDateClicked({תאריך: date});
                                        }
                                    }}
                                >
                                    <h3 className="font-bold text-lg text-blue-900">{date}</h3>
                                    <span className="text-sm text-blue-700">דורש: {items[0].משתמש}</span>
                                </div>

                                {/* Items list */}
                                <div className="divide-y">
                                    {items.map((item, idx) => (
                                        <div
                                            key={item.id || idx}
                                            className={`p-4 hover:bg-gray-100 cursor-pointer transition-colors ${item.נקרא === 'כן' ? 'bg-red-50 hover:bg-red-100' : ''}`}
                                            onClick={() => handleCardClick(item)}
                                        >
                                            <div className="grid grid-cols-2 gap-3 text-sm">
                                                <div>
                                                    <span className="font-semibold text-gray-600">פריט:</span>
                                                    <span className="mr-2 text-gray-900">{item.פריט}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-gray-600">כמות:</span>
                                                    <span className="mr-2 text-gray-900">{item.כמות}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-gray-600">צורך:</span>
                                                    <span className="mr-2 text-gray-900">{item.צורך}</span>
                                                </div>
                                                {item.הערה && (
                                                    <div className="col-span-2">
                                                        <span className="font-semibold text-gray-600">הערה:</span>
                                                        <span className="mr-2 text-gray-900">{item.הערה}</span>
                                                    </div>
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                // Table view (AG Grid) for all tabs
                <div className="ag-theme-alpine w-[110vh] h-[45vh] mb-8 overflow-auto" style={{maxWidth: '100%'}}>
                    <div className="ag-theme-alpine w-[110vh] h-[45vh] mb-8 overflow-auto" style={{maxWidth: '100%'}}>
                        <AgGridReact
                            ref={gridRef}
                            key={`${activeTab}-${rowData.length}`}
                            rowData={activeTab === 'החתמה' ? summarizedSignatureData : displayDataByStatus[activeTab] || []}
                            columnDefs={activeTab === 'החתמה' ? summaryColumns : baseColumns}
                            enableRtl={true}
                            defaultColDef={{
                                ...defaultColDef,
                                checkboxSelection: activeTab !== 'החתמה' ? (params) => {
                                    // This will make the checkbox appear only in the first column
                                    return params.column.getColId() === 'checkboxCol';
                                } : false
                            }}
                            suppressHorizontalScroll={false}
                            rowSelection={activeTab !== 'החתמה' ? 'multiple' : undefined}
                            suppressRowClickSelection={true} /* Changed to always true to prevent row selection on click */
                            onSelectionChanged={(params) => {
                                const selectedRows = params.api.getSelectedRows();
                                setSelectedRows(selectedRows);
                            }}
                            onCellClicked={(event) => {
                                if (permissions['logistic'] && event.colDef && event.colDef.field === 'תאריך')
                                    handleDateClicked(event.data)
                            }}
                            getRowStyle={(params) => {
                                // For החתמה tab, apply light blue to odd rows
                                if (activeTab === 'החתמה') {
                                    if (params.node && params.node.rowIndex !== undefined && params.node.rowIndex !== null && params.node.rowIndex % 2 !== 0) {
                                        return {backgroundColor: '#e3f2fd'}; // Light blue background for odd rows
                                    }
                                    return undefined;
                                }
                                // For other tabs, keep the red background for נקרא=כן
                                if (params.data && params.data.נקרא === 'כן') {
                                    return {backgroundColor: '#ffcccc'}; // Light red background
                                }
                            }}
                        />
                    </div>
                </div>
            )}

            {/* Item form dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-right">{dialogMode === 'הזמנה' ? 'דרישות' : 'החתם על פריט'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4 text-right">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div className="md:col-span-2">
                                    <Label htmlFor={`item-${index}`} className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        id={`item-${index}`}
                                        options={(dialogMode === 'הזמנה' ? allItemNames : uniqueItemNames).map(name => ({ value: name, label: name }))}
                                        value={item.פריט ? { value: item.פריט, label: item.פריט } : null}
                                        getOptionLabel={(option: any) => option.label}
                                        getOptionValue={(option: any) => option.value}
                                        onChange={(selectedOption) => {
                                            const newItems = [...items];
                                            // If no option is selected (user cleared the field)
                                            if (!selectedOption) {
                                                newItems[index].פריט = '';
                                                setItems(newItems);
                                                return;
                                            }

                                            // Use the value directly
                                            newItems[index].פריט = selectedOption.value;
                                            setItems(newItems);
                                        }}
                                        onCreateOption={(inputValue) => {
                                            // Create a new option when user enters custom text
                                            const newItems = [...items];
                                            newItems[index].פריט = inputValue;
                                            setItems(newItems);
                                            // Also update custom item input for potential future use
                                            setCustomItemInput(inputValue);
                                        }}
                                        placeholder="בחר או הכנס פריט"
                                        noOptionsMessage={() => "לא נמצאו פריטים"}
                                        formatCreateLabel={(inputValue) => `הוסף "${inputValue}"`}
                                        classNamePrefix="item-select"
                                        isClearable
                                        isSearchable
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
                                            }),
                                            placeholder: (provided) => ({
                                                ...provided,
                                                textAlign: 'right'
                                            }),
                                            singleValue: (provided) => ({
                                                ...provided,
                                                textAlign: 'right'
                                            })
                                        }}
                                        theme={(theme) => ({
                                            ...theme,
                                            colors: {
                                                ...theme.colors,
                                                primary: '#3b82f6', // Blue color for selection
                                                primary25: '#eff6ff' // Light blue for hover
                                            }
                                        })}
                                    />
                                </div>

                                <div className="w-20">
                                    <Label htmlFor={`qty-${index}`} className="text-right block mb-2">כמות</Label>
                                    <Input
                                        id={`qty-${index}`}
                                        type="number"
                                        value={item.כמות || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            newItems[index].כמות = parseInt(e.target.value, 10) || 0;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor={`need-${index}`} className="text-right block mb-2">צורך</Label>
                                    <Select
                                        value={item.צורך || 'ניפוק'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].צורך = value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר צורך"/>
                                        </SelectTrigger>
                                        <SelectContent className="text-right">
                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                            <SelectItem value="בלאי" disabled={dialogMode === 'החתמה'}>בלאי/ החלפה</SelectItem>
                                            <SelectItem value="זיכוי">זיכוי</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor={`note-${index}`} className="text-right block mb-2">הערה</Label>
                                    <Input
                                        id={`note-${index}`}
                                        value={item.הערה || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            newItems[index].הערה = e.target.value;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                    />
                                </div>

                                {index > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setItems(items.filter((_, i) => i !== index));
                                        }}
                                        className="col-span-1 text-red-500 hover:text-red-700"
                                    >
                                        <Trash className="h-5 w-5"/>
                                    </Button>
                                )}
                            </div>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setItems([...items, {...defaultItem}]);
                            }}
                            className="w-full"
                        >
                            הוסף פריט נוסף
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button type="button" onClick={() => setOpen(false)} variant="outline">
                            ביטול
                        </Button>
                        <Button type="button" onClick={handleAddItem}>
                            {dialogMode === 'הזמנה' ? 'שלח דרישות' : 'שלח טופס'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Signature dialog */}
            <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">טופס החתמה</DialogTitle>
                        <DialogDescription className="text-right">
                            {currentItem && `החתמה על ${currentItem.פריט}`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/*<div className="space-y-4 py-4 text-right">*/}
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div className="md:col-span-2">
                                    <Label htmlFor={`item-${index}`} className="text-right block mb-2">פריט</Label>
                                    <CreatableSelect
                                        id={`item-${index}`}
                                        options={uniqueItemNames.map(name => ({ value: name, label: name }))}
                                        value={item.פריט ? { value: item.פריט, label: item.פריט } : null}
                                        getOptionLabel={(option: any) => option.label}
                                        getOptionValue={(option: any) => option.value}
                                        onChange={(selectedOption) => {
                                            const newItems = [...items];
                                            // If no option is selected (user cleared the field)
                                            if (!selectedOption) {
                                                newItems[index].פריט = '';
                                                setItems(newItems);
                                                return;
                                            }

                                            // Use the value directly
                                            newItems[index].פריט = selectedOption.value;
                                            setItems(newItems);
                                        }}
                                        onCreateOption={(inputValue) => {
                                            // Create a new option when user enters custom text
                                            const newItems = [...items];
                                            newItems[index].פריט = inputValue;
                                            setItems(newItems);
                                            // Also update custom item input for potential future use
                                            setCustomItemInput(inputValue);
                                        }}
                                        placeholder="בחר או הכנס פריט"
                                        noOptionsMessage={() => "לא נמצאו פריטים"}
                                        formatCreateLabel={(inputValue) => `הוסף "${inputValue}"`}
                                        classNamePrefix="item-select"
                                        isClearable
                                        isSearchable
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
                                            }),
                                            placeholder: (provided) => ({
                                                ...provided,
                                                textAlign: 'right'
                                            }),
                                            singleValue: (provided) => ({
                                                ...provided,
                                                textAlign: 'right'
                                            })
                                        }}
                                        theme={(theme) => ({
                                            ...theme,
                                            colors: {
                                                ...theme.colors,
                                                primary: '#3b82f6', // Blue color for selection
                                                primary25: '#eff6ff' // Light blue for hover
                                            }
                                        })}
                                    />
                                </div>

                                <div className="w-20">
                                    <Label htmlFor={`qty-${index}`} className="text-right block mb-2">כמות</Label>
                                    <Input
                                        id={`qty-${index}`}
                                        type="number"
                                        value={item.כמות || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            newItems[index].כמות = parseInt(e.target.value, 10) || 0;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                        min="1"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor={`need-${index}`} className="text-right block mb-2">צורך</Label>
                                    <Select
                                        value={item.צורך || 'ניפוק'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].צורך = value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר צורך"/>
                                        </SelectTrigger>
                                        <SelectContent className="text-right">
                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                            <SelectItem value="בלאי" disabled={dialogMode === 'החתמה'}>בלאי/ החלפה</SelectItem>
                                            <SelectItem value="זיכוי">זיכוי</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
                                    <Label htmlFor={`note-${index}`} className="text-right block mb-2">הערה</Label>
                                    <Input
                                        id={`note-${index}`}
                                        value={item.הערה || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            newItems[index].הערה = e.target.value;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                    />
                                </div>

                                {index > 0 && (
                                    <Button
                                        type="button"
                                        variant="ghost"
                                        size="icon"
                                        onClick={() => {
                                            setItems(items.filter((_, i) => i !== index));
                                        }}
                                        className="col-span-1 text-red-500 hover:text-red-700"
                                    >
                                        <Trash className="h-5 w-5"/>
                                    </Button>
                                )}
                            </div>
                        ))}

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                setItems([...items, {...defaultItem}]);
                            }}
                            className="w-full"
                        >
                            הוסף פריט נוסף
                        </Button>

                        <div>
                            <Label htmlFor="signer-name" className="text-right block mb-2">שם החותם</Label>
                            <Input
                                id="signer-name"
                                value={signerName}
                                onChange={(e) => setSignerName(e.target.value)}
                                className="text-right mb-4"
                            />
                        </div>

                        <div>
                            <Label htmlFor="signer-personal-id" className="text-right block mb-2">מספר אישי של החותם</Label>
                            <Input
                                id="signer-personal-id"
                                type="text"
                                inputMode="numeric"
                                value={signerPersonalId === 0 ? '' : signerPersonalId}
                                onChange={(e) => {
                                    const value = e.target.value;
                                    if (value === '' || /^[1-9]\d*$/.test(value)) {
                                        setSignerPersonalId(value === '' ? 0 : parseInt(value, 10));
                                    }
                                }}
                                className="text-right mb-4"
                                placeholder="מספר אישי"
                            />
                        </div>

                        <div className="border rounded p-2">
                            <label className="block text-right font-medium mb-1">חתימה</label>
                            <SignatureCanvas
                                ref={sigPadRef}
                                penColor="black"
                                onEnd={saveSignature}  // Automatically saves when drawing ends
                                canvasProps={{
                                    width: 300,
                                    height: 150,
                                    className: "border border-gray-300 rounded",
                                    style: {direction: "ltr"},
                                }}
                                clearOnResize={false}
                                backgroundColor="white"
                            />
                        </div>

                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => sigPadRef.current?.clear()}
                            className="w-full"
                        >
                            נקה חתימה
                        </Button>
                    </div>

                    <DialogFooter>
                        <Button type="button" onClick={handleCloseModal} variant="outline">
                            ביטול
                        </Button>
                        <Button type="button" onClick={handleAddItem}>
                            {dialogMode === 'הזמנה' ? 'שלח דרישות' : 'שלח טופס'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Card Detail Modal */}
            <Dialog open={cardDetailModalOpen} onOpenChange={setCardDetailModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle className="text-right">פרטי פריט</DialogTitle>
                    </DialogHeader>
                    
                    {selectedCardItem && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-right">
                                <div>
                                    <span className="font-semibold text-gray-600">תאריך:</span>
                                    <div className="text-gray-900">{selectedCardItem.תאריך}</div>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">פריט:</span>
                                    <div className="text-gray-900">{selectedCardItem.פריט}</div>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">כמות:</span>
                                    <div className="text-gray-900">{selectedCardItem.כמות}</div>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">צורך:</span>
                                    <div className="text-gray-900">{selectedCardItem.צורך}</div>
                                </div>
                                {selectedCardItem.הערה && (
                                    <div className="col-span-2">
                                        <span className="font-semibold text-gray-600">הערה:</span>
                                        <div className="text-gray-900">{selectedCardItem.הערה}</div>
                                    </div>
                                )}
                            </div>

                            <div className="flex flex-col gap-2 pt-4">
                                {/* Delete button - only if נקרא=לא */}
                                {selectedCardItem.נקרא !== 'כן' && (
                                    <Button
                                        type="button"
                                        variant="destructive"
                                        onClick={handleDeleteCardItem}
                                        className="w-full"
                                    >
                                        מחק פריט
                                    </Button>
                                )}

                                {/* Toggle read status - only for permission['ammo'] */}
                                {permissions['ammo'] && (
                                    <Button
                                        type="button"
                                        onClick={handleToggleCardReadStatus}
                                        className="w-full bg-blue-600 hover:bg-blue-700"
                                    >
                                        שנה נקרא ל-{selectedCardItem.נקרא === 'כן' ? 'לא' : 'כן'}
                                    </Button>
                                )}

                                {/* Toggle status - only for permission['ammo'] */}
                                {permissions['ammo'] && (
                                    <Button
                                        type="button"
                                        onClick={handleToggleCardStatus}
                                        className="w-full bg-green-600 hover:bg-green-700"
                                    >
                                        שנה סטטוס ל-{selectedCardItem.סטטוס === 'הזמנה' ? 'התעצמות' : 'דרישה'}
                                    </Button>
                                )}
                            </div>
                        </div>
                    )}

                    <DialogFooter>
                        <Button 
                            type="button" 
                            onClick={() => {
                                setCardDetailModalOpen(false);
                                setSelectedCardItem(null);
                            }} 
                            variant="outline"
                        >
                            ביטול
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Logistic;
