import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient"
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Trash, LayoutGrid, Table, Info} from "lucide-react";
import {ColDef} from "ag-grid-community";

import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogDescription,
    DialogFooter,
} from '@/components/ui/dialog';
import {
    Popover,
    PopoverContent,
    PopoverTrigger,
} from '@/components/ui/popover';
import {usePermissions} from "@/contexts/PermissionsContext";
import SignatureCanvas from "react-signature-canvas";
import {Label} from "@/components/ui/label";
import jsPDF from "jspdf";
import "jspdf-autotable";
import * as XLSX from "xlsx";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
// Import logo for PDF export
import logoImg from "@/assets/logo.jpeg";

const STATUSES = ['החתמה', 'דיווח'] as const;

// Map internal status names to display names
const STATUS_DISPLAY_MAP: Record<string, string> = {
    'החתמה': 'החתמה',
    'דיווח': 'דיווחים'
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
    סוג_תחמושת?: string;
    is_explosion?: boolean;
};

const Ammo: React.FC<LogisticProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [ballRowData, setBallRowData] = useState<LogisticItem[]>([]);
    const [explosionRowData, setExplosionRowData] = useState<LogisticItem[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});

    // Dialog states
    const [open, setOpen] = useState(false);
    const [dataURL, setDataURL] = useState('');
    const [dialogMode, setDialogMode] = useState<'דיווח' | 'החתמה'>('דיווח');
    const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
    const [currentItem, setCurrentItem] = useState<LogisticItem | null>(null);
    const [selectedRows, setSelectedRows] = useState<LogisticItem[]>([]);

    const [signerName, setSignerName] = useState('');
    const [signerPersonalId, setSignerPersonalId] = useState(0);
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [activeTab, setActiveTab] = useState<string>('דיווח'); // Track active tab
    const [viewMode, setViewMode] = useState<'table' | 'cards'>('cards'); // Toggle between table and card view
    const [cardActionModalOpen, setCardActionModalOpen] = useState(false);
    const [selectedCardItem, setSelectedCardItem] = useState<LogisticItem | null>(null);

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
        שם_החותם: '',
        חתימה: '',
        סטטוס: 'דיווח',
        משתמש: '',
        פלוגה: selectedSheet.range,
        סוג_תחמושת: 'קליעית', // Track ammo type
    };

    // Form items state (dynamic rows)
    const [items, setItems] = useState<Partial<LogisticItem>[]>([{...defaultItem}]);
    const [showSuggestions, setShowSuggestions] = useState<{[key: string]: boolean}>({});

    // Helper function to create an empty item
    function getEmptyItem(): Partial<LogisticItem> {
        return {
            פריט: '',
            כמות: undefined,
            צורך: 'ניפוק',
        };
    }

    // Fetch data from Supabase from unified ammo table
    const fetchData = async () => {
        if (permissions[selectedSheet.range] || permissions['ammo']) {
            try {
                setLoading(true);

                // Fetch all ammo data in chunks of 1000
                let allAmmoData: LogisticItem[] = [];
                let offset = 0;
                const chunkSize = 1000;
                let hasMore = true;

                while (hasMore) {
                    const {data: ammoData, error: ammoError} = await supabase
                        .from('ammo')
                        .select("*")
                        .in("פלוגה", [selectedSheet.range, 'גדוד'])
                        .range(offset, offset + chunkSize - 1);

                    if (ammoError) {
                        console.error("Error fetching ammo data:", ammoError);
                        setStatusMessage({
                            text: `שגיאה בטעינת נתוני תחמושת: ${ammoError.message}`,
                            type: "error"
                        });
                        break;
                    }

                    if (ammoData && ammoData.length > 0) {
                        // @ts-ignore
                        allAmmoData = [...allAmmoData, ...(ammoData as LogisticItem[])];
                        offset += chunkSize;
                        hasMore = ammoData.length === chunkSize;
                    } else {
                        hasMore = false;
                    }
                }

                // Split data by is_explosion flag
                setBallRowData(allAmmoData.filter((item: LogisticItem) => !item.is_explosion));
                setExplosionRowData(allAmmoData.filter((item: LogisticItem) => item.is_explosion));

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

    // Group data by סטטוס for ball table
    const ballDataByStatus = useMemo(() => {
        const grouped = {דיווח: [], החתמה: []} as Record<string, LogisticItem[]>;

        // First group the items by status
        ballRowData.forEach(item => {
            if (STATUSES.includes(item.סטטוס as any)) {
                if (!grouped[item.סטטוס]) {
                    grouped[item.סטטוס] = [];
                }
                grouped[item.סטטוס].push(item);
            }
        });

        // Now sort דיווח items by date (newest first)
        ['דיווח'].forEach(status => {
            if (grouped[status] && grouped[status].length > 0) {
                grouped[status].sort((a, b) => {
                    const dateA = new Date(a.תאריך || '').getTime();
                    const dateB = new Date(b.תאריך || '').getTime();
                    return dateB - dateA; // Sort in descending order (newest first)
                });
            }
        });

        return grouped;
    }, [ballRowData]);

    // Group data by סטטוס for explosion table
    const explosionDataByStatus = useMemo(() => {
        const grouped = {דיווח: [], החתמה: []} as Record<string, LogisticItem[]>;

        // First group the items by status
        explosionRowData.forEach(item => {
            if (STATUSES.includes(item.סטטוס as any)) {
                if (!grouped[item.סטטוס]) {
                    grouped[item.סטטוס] = [];
                }
                grouped[item.סטטוס].push(item);
            }
        });

        // Now sort דיווח items by date (newest first)
        ['דיווח'].forEach(status => {
            if (grouped[status] && grouped[status].length > 0) {
                grouped[status].sort((a, b) => {
                    const dateA = new Date(a.תאריך || '').getTime();
                    const dateB = new Date(b.תאריך || '').getTime();
                    return dateB - dateA; // Sort in descending order (newest first)
                });
            }
        });

        return grouped;
    }, [explosionRowData]);

    // Group דיווח data by תאריך for card view (combine ball and explosion data)
    const groupedByDate = useMemo(() => {
        const ballData = ballDataByStatus['דיווח'] || [];
        const explosionData = explosionDataByStatus['דיווח'] || [];
        const allData = [...ballData, ...explosionData];
        const grouped: { [date: string]: LogisticItem[] } = {};

        allData.forEach(item => {
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
    }, [ballDataByStatus, explosionDataByStatus]);

    // Get unique item names from החתמה status only for דיווח mode
    const uniqueBallItemNames = useMemo(() => {
        // Filter items with status החתמה from גדוד and selectedSheet.range
        const ballItems = ballRowData.filter(item => 
            item.סטטוס === 'החתמה' && (item.פלוגה === 'גדוד' || item.פלוגה === selectedSheet.range)
        );

        // Calculate quantities for each item
        const itemQuantities = new Map<string, number>();
        ballItems.forEach(item => {
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
    }, [ballRowData, selectedSheet.range]);

    const uniqueExplosionItemNames = useMemo(() => {
        // Filter items with status החתמה from גדוד and selectedSheet.range
        const explosionItems = explosionRowData.filter(item => 
            item.סטטוס === 'החתמה' && (item.פלוגה === 'גדוד' || item.פלוגה === selectedSheet.range)
        );

        // Calculate quantities for each item
        const itemQuantities = new Map<string, number>();
        explosionItems.forEach(item => {
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
    }, [explosionRowData, selectedSheet.range]);

    // Get unique item names from החתמה status only for דיווח mode
    const uniqueBallItemNamesFromHahatama = useMemo(() => {
        const ballHahatmaItems = (ballDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range);

        // Calculate quantities for each item
        const itemQuantities = new Map<string, number>();
        ballHahatmaItems.forEach(item => {
            if (item.פריט) {
                const currentQty = itemQuantities.get(item.פריט) || 0;
                const qty = (item.צורך === 'זיכוי' || item.צורך === 'שצל') ? -item.כמות : item.כמות;
                itemQuantities.set(item.פריט, currentQty + qty);
            }
        });

        // Filter items with quantity > 0
        const itemsWithPositiveQty = Array.from(itemQuantities.entries())
            .filter(([_, qty]) => qty > 0)
            .map(([itemName, _]) => itemName);

        return itemsWithPositiveQty.sort();
    }, [ballDataByStatus, selectedSheet.range]);

    const uniqueExplosionItemNamesFromHahatama = useMemo(() => {
        const explosionHahatmaItems = (explosionDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range);

        // Calculate quantities for each item
        const itemQuantities = new Map<string, number>();
        explosionHahatmaItems.forEach(item => {
            if (item.פריט) {
                const currentQty = itemQuantities.get(item.פריט) || 0;
                const qty = (item.צורך === 'זיכוי' || item.צורך === 'שצל') ? -item.כמות : item.כמות;
                itemQuantities.set(item.פריט, currentQty + qty);
            }
        });

        // Filter items with quantity > 0
        const itemsWithPositiveQty = Array.from(itemQuantities.entries())
            .filter(([_, qty]) => qty > 0)
            .map(([itemName, _]) => itemName);

        return itemsWithPositiveQty.sort();
    }, [explosionDataByStatus, selectedSheet.range]);

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

    // Create summary data for החתמה table - Ball
    const summarizedBallSignatureData = useMemo(() => {
        // Get only החתמה data for current פלוגה
        const signatureData = (ballDataByStatus['החתמה'] || []).filter(r => r.פלוגה === selectedSheet.range);

        if (signatureData.length === 0) {
            return [];
        }

        // Create a map to group by פריט (item) and sum up כמות (quantity)
        const itemSummary = new Map<string, LogisticItem>();

        // Process each row
        signatureData.forEach((row: LogisticItem) => {
            const item = row.פריט;
            const quantity = typeof row.כמות === 'number' ? row.כמות : parseInt(String(row.כמות), 10) || 0;
            const signedQuantity = row.צורך === 'ניפוק' ? Math.abs(quantity) : -Math.abs(quantity);

            if (itemSummary.has(item)) {
                // Item exists, update quantity
                const existing = itemSummary.get(item)!;
                existing.כמות = (existing.כמות || 0) + signedQuantity;

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
                    כמות: signedQuantity,
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

        // Convert map to array and filter out items with כמות = 0
        return Array.from(itemSummary.values()).filter(item => item.כמות !== 0);
    }, [ballDataByStatus]);

    // Create summary data for החתמה table - Explosion
    const summarizedExplosionSignatureData = useMemo(() => {
        // Get only החתמה data for current פלוגה
        const signatureData = (explosionDataByStatus['החתמה'] || []).filter(r => r.פלוגה === selectedSheet.range);

        if (signatureData.length === 0) {
            return [];
        }

        // Create a map to group by פריט (item) and sum up כמות (quantity)
        const itemSummary = new Map<string, LogisticItem>();

        // Process each row
        signatureData.forEach((row: LogisticItem) => {
            const item = row.פריט;
            const quantity = typeof row.כמות === 'number' ? row.כמות : parseInt(String(row.כמות), 10) || 0;
            const signedQuantity = row.צורך === 'ניפוק' ? Math.abs(quantity) : -Math.abs(quantity);

            if (itemSummary.has(item)) {
                // Item exists, update quantity
                const existing = itemSummary.get(item)!;
                existing.כמות = (existing.כמות || 0) + signedQuantity;

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
                    כמות: signedQuantity,
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

        // Convert map to array and filter out items with כמות = 0
        return Array.from(itemSummary.values()).filter(item => item.כמות !== 0);
    }, [explosionDataByStatus]);

    // AG Grid column definitions
    const baseColumns = useMemo<ColDef<LogisticItem>[]>(() => {
        const columnDefs: ColDef<LogisticItem>[] = [
            {
                width: 35,
                pinned: 'right',
                headerName: '',
                colId: 'checkboxCol'
            },
            {field: 'תאריך' as keyof LogisticItem, headerName: 'תאריך', sortable: true, filter: true, width: 160},
            {field: 'פריט' as keyof LogisticItem, headerName: 'פריט', sortable: true, filter: true, width: 110},
            {field: 'כמות' as keyof LogisticItem, headerName: 'כמות', sortable: true, filter: true, width: 70,},
            {
                headerName: 'נקרא',
                field: 'נקרא' as keyof LogisticItem,
                sortable: true,
                filter: true,
                width: 80,
                editable: permissions['ammo'],
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {values: ['כן', 'לא']},
                onCellValueChanged: async (params: any) => {
                    await handleReadStatusChange(params);
                }
            },
            {field: 'משתמש' as keyof LogisticItem, headerName: 'שם דורש', sortable: true, filter: true, width: 110},
        ];

        return columnDefs;
    }, [permissions, activeTab]);

    const handleDateClicked = async (data: any) => {
        const date = data.תאריך;
        
        // Find all rows with the same date from BOTH ball and explosion data
        const matchingBallRows = ballRowData.filter(item => item.תאריך === date && item.סטטוס === 'דיווח');
        const matchingExplosionRows = explosionRowData.filter(item => item.תאריך === date && item.סטטוס === 'דיווח');
        const matchingRows = [...matchingBallRows, ...matchingExplosionRows];

        // Create items array from matching rows
        const itemsToShow = matchingRows.map(row => ({
            פריט: row.פריט || '',
            כמות: row.כמות || 1,
            צורך: row.צורך || 'ניפוק',
            סוג_תחמושת: row.is_explosion ? 'נפיצה' : 'קליעית',
        }));

        if (matchingRows.length > 0) {
            setSignerName(matchingRows[0].משתמש);
            setSignerPersonalId(matchingRows[0].מספר_אישי_החותם ?? 0);
            const signatureData = matchingRows[0].חתימה ?? '';
            setDataURL(signatureData);

            // Set the items state to populate the dialog
            setItems(itemsToShow);

            // Set dialog mode to signature
            setDialogMode('החתמה');

            // Open the signature dialog
            setSignatureDialogOpen(true);
        }
    }

    // Handle read status change
    const handleReadStatusChange = async (params: any) => {
        const {data} = params;
        const id = data.id;
        const ddate = data['תאריך'];
        const ditem = data['פריט'];
        const oldReadStatus = params.oldValue;
        const newReadStatus = params.newValue;

        try {
            // Update the read status in Supabase unified ammo table
            const {data: updatedData, error} = await supabase
                .from('ammo')
                .update({"נקרא": newReadStatus}) // key must be quoted
                .eq("id", id)
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

    // Handler for card body click
    const handleCardBodyClick = (item: LogisticItem) => {
        setSelectedCardItem(item);
        setCardActionModalOpen(true);
    };

    // Handler for deleting a single card item
    const handleDeleteCardItem = async () => {
        if (!selectedCardItem || !selectedCardItem.id) return;

        try {
            setLoading(true);
            const {error} = await supabase
                .from('ammo')
                .delete()
                .eq('id', selectedCardItem.id);

            if (error) {
                console.error("Error deleting ammo item:", error);
                setStatusMessage({
                    text: `שגיאה במחיקת פריט: ${error.message}`,
                    type: "error"
                });
                setLoading(false);
                return;
            }

            await fetchData();
            setStatusMessage({
                text: `פריט נמחק בהצלחה - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}`,
                type: "success"
            });
            setCardActionModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during delete:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                type: "error"
            });
            setLoading(false);
        }
    };

    // Handler for toggling read status
    const handleToggleReadStatus = async () => {
        if (!selectedCardItem || !selectedCardItem.id) return;

        const currentStatus = selectedCardItem.נקרא;
        const newStatus = currentStatus === 'כן' ? 'לא' : 'כן';

        try {
            setLoading(true);
            const {error} = await supabase
                .from('ammo')
                .update({נקרא: newStatus})
                .eq('id', selectedCardItem.id);

            if (error) {
                console.error("Error updating read status:", error);
                setStatusMessage({
                    text: `שגיאה בעדכון סטטוס קריאה: ${error.message}`,
                    type: "error"
                });
                setLoading(false);
                return;
            }

            await fetchData();
            setStatusMessage({
                text: `סטטוס קריאה עודכן בהצלחה - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}, מ-"${currentStatus}" ל-"${newStatus}"`,
                type: "success"
            });
            setCardActionModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during status update:", err);
            setStatusMessage({
                text: `שגיאה לא צפויה: ${err.message}`,
                type: "error"
            });
            setLoading(false);
        }
    };

    // Function to add a new logistic item
    const handleAddItem = async () => {
        setStatusMessage({text: "", type: ""});

        if (dialogMode === 'דיווח') {
            let invalidItems = items.filter(item => !item.פריט || !item.כמות || item.כמות <= 0);
            if (invalidItems.length > 0) {
                setStatusMessage({text: "יש למלא את כל השדות הנדרשים (כולל כמות)", type: "error"});
                setOpen(false);
                setSignatureDialogOpen(false);
                return;
            }
            
            // Validate that דיווח שצל (זיכוי) won't result in negative quantities
            for (const item of items) {
                const ballSignatureData = ballDataByStatus['החתמה'] || [];
                const explosionSignatureData = explosionDataByStatus['החתמה'] || [];

                // Calculate current quantities for this item in החתמה status
                const ballItemData = ballSignatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                const explosionItemData = explosionSignatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                const ballCurrentQty = ballItemData.reduce((sum, i) => sum + ((i.צורך === 'זיכוי' || i.צורך === 'שצל') ? -i.כמות : i.כמות), 0);
                const explosionCurrentQty = explosionItemData.reduce((sum, i) => sum + ((i.צורך === 'זיכוי' || i.צורך === 'שצל') ? -i.כמות : i.כמות), 0);
                
                // Determine which type this item is based on סוג_תחמושת
                const isExplosion = item.סוג_תחמושת === 'נפיצה';
                const currentQty = isExplosion ? explosionCurrentQty : ballCurrentQty;
                
                const itemQty = item.כמות || 0;
                
                // דיווח שצל is always זיכוי, so check if it would lead to negative
                if (currentQty - itemQty < 0) {
                    setStatusMessage({
                        text: `לא ניתן לדווח שצל:\n${item.פריט} (כמות נוכחית בהחתמה: ${currentQty}, מנסה לדווח שצל: ${itemQty})`,
                        type: "error"
                    });
                    setLoading(false);
                    setOpen(false);
                    setSignatureDialogOpen(false);
                    return;
                }
            }
        }


        // Validation for החתמה mode
        if (dialogMode === 'החתמה') {
            let invalidItems = items.filter(item => !item.פריט || !item.כמות || item.כמות <= 0);
            const hasShatzalItems = items.some(item => item.צורך === 'שצל');
            
            // If has שצל items, don't require signature fields
            const requiresSignature = !hasShatzalItems;
            
            if (invalidItems.length > 0 || (requiresSignature && (!signerName || !signerPersonalId || !dataURL))) {
                setStatusMessage({text: "יש למלא את כל השדות הנדרשים", type: "error"});
                setOpen(false);
                setSignatureDialogOpen(false);
                return;
            }

            for (const item of items) {
                // Determine which table this item belongs to (for now, we'll need to check both)
                // Check in ball data
                const ballSignatureData = ballDataByStatus['החתמה'] || [];
                const explosionSignatureData = explosionDataByStatus['החתמה'] || [];

                // Calculate current quantities
                const ballItemData = ballSignatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                const explosionItemData = explosionSignatureData.filter(i => i.פריט === item.פריט && i.פלוגה === selectedSheet.range);
                const ballCurrentQty = ballItemData.reduce((sum, i) => sum + ((i.צורך === 'זיכוי') ? -i.כמות : i.כמות), 0);
                const explosionCurrentQty = explosionItemData.reduce((sum, i) => sum + ((i.צורך === 'זיכוי') ? -i.כמות : i.כמות), 0);
                
                // Determine which type this item is based on סוג_תחמושת
                const isExplosion = item.סוג_תחמושת === 'נפיצה';
                const currentQty = isExplosion ? explosionCurrentQty : ballCurrentQty;
                
                // Check if זיכוי would lead to negative
                if (item.צורך === 'זיכוי'  || item.צורך === 'שצל') {
                    const itemQty = item.כמות || 0;

                    if (currentQty - itemQty < 0) {
                        setStatusMessage({
                            text: `לא ניתן להחתים פריטים:\n${item.פריט} (כמות נוכחית: ${currentQty}, מנסה לזכות: ${itemQty})`,
                            type: "error"
                        });
                        setLoading(false);
                        setOpen(false);
                        setSignatureDialogOpen(false);
                        return;
                    }
                }

                // Check if ניפוק would lead to negative in גדוד
                if (item.צורך === 'ניפוק' && item.פריט) {
                    // Determine which type this item is
                    const isExplosion = item.סוג_תחמושת === 'נפיצה';
                    
                    // Fetch גדוד data for this specific item type
                    const {data: gadudData} = await supabase
                        .from('ammo')
                        .select('*')
                        .eq('פלוגה', 'גדוד')
                        .eq('פריט', item.פריט)
                        .eq('is_explosion', isExplosion);

                    // Calculate גדוד quantity
                    const gadudQty = (gadudData || []).reduce((sum: number, i: any) => {
                        const qty = (i.צורך === 'זיכוי') ? -i.כמות : i.כמות;
                        return sum + qty;
                    }, 0);

                    const itemQty = item.כמות || 0;
                    if (gadudQty - itemQty < 0) {
                        setStatusMessage({
                            text: `לא ניתן להחתים - מלאי גדוד אינו מספיק:\n${item.פריט} (סוג: ${item.סוג_תחמושת}) - מלאי בגדוד: ${gadudQty}, מנסה לנפק: ${itemQty}`,
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

        // Format items for insertion - unified table with is_explosion flag
        const formattedDate = new Date().toLocaleString('he-IL');
        const itemsToInsert: any[] = [];

        items.forEach(item => {
            // Determine is_explosion based on selected ammo type
            const isExplosion = item.סוג_תחמושת === 'נפיצה';
            
            const formattedItem = {
                תאריך: formattedDate,
                פריט: item.פריט,
                כמות: item.כמות,
                שם_החותם: signerName,
                מספר_אישי_החותם: dialogMode === 'דיווח' ? (permissions['id'] ? String(permissions['id']) : '') : signerPersonalId,
                חתימת_מחתים: permissions['signature'] ? String(permissions['signature']) : '',
                מספר_אישי_מחתים: permissions['id'] ? String(permissions['id']) : '',
                חתימה: dataURL ? dataURL : String(permissions['signature']),
                צורך: dialogMode === 'דיווח' ? 'שצל' : (item.צורך || 'ניפוק'),
                סטטוס: dialogMode,
                משתמש: permissions['name'] || '',
                פלוגה: selectedSheet.range,
                is_explosion: isExplosion,
            };

            itemsToInsert.push(formattedItem);

            // If החתמה, create battalion entries
            if (dialogMode === 'החתמה' && item.צורך !== 'שצל') {
                const need = (item.צורך === 'ניפוק') ? 'זיכוי' : 'ניפוק';
                const battalionEntry = {
                    תאריך: formattedDate,
                    פריט: item.פריט,
                    כמות: item.כמות,
                    שם_החותם: '',
                    חתימת_מחתים: '',
                    חתימה: '',
                    צורך: need,
                    סטטוס: dialogMode,
                    משתמש: permissions['name'] || '',
                    פלוגה: 'גדוד',
                    הערה: item.צורך + ' מ' + selectedSheet.name,
                    is_explosion: isExplosion,
                };

                itemsToInsert.push(battalionEntry);
            }
        });

        try {
            setLoading(true);

            // Insert to unified ammo table
            if (itemsToInsert.length > 0) {
                const {error: ammoError} = await supabase
                    .from('ammo')
                    .insert(itemsToInsert);

                if (ammoError) {
                    console.error("Error adding ammo items:", ammoError);
                    setStatusMessage({text: `שגיאה בהוספת פריטי תחמושת: ${ammoError.message}`, type: "error"});
                    setLoading(false);
                    return;
                }
            }

            // Reset form and close dialog
            const itemsList = items.map(item => `${item.פריט} (${item.סוג_תחמושת}, כמות: ${item.כמות})`).join(', ');
            const actionType = dialogMode === 'החתמה' ? 'הוחתמו' : 'דווחו';
            setItems([{...defaultItem}]);
            await fetchData();
            setOpen(false);
            setSignatureDialogOpen(false);
            setSignerName('');
            setSignerPersonalId(0);
            setDataURL('');
            setStatusMessage({text: `${actionType} ${items.length} פריטים בהצלחה ל${selectedSheet.name}: ${itemsList}`, type: "success"});
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
            const idsToDelete = selectedRows.map(r => r.id);

            // Delete from unified ammo table
            if (idsToDelete.length > 0) {
                const {error: deleteError} = await supabase
                    .from('ammo')
                    .delete()
                    .in('id', idsToDelete);
                if (deleteError) {
                    console.error("Error deleting ammo items:", deleteError);
                    setStatusMessage({text: `שגיאה במחיקת פריטי תחמושת: ${deleteError.message}`, type: "error"});
                    setLoading(false);
                    return;
                }
            }

            // Create detailed message with deleted items info
            const deletedItemsDetails = selectedRows.map(row => 
                `${row.פריט} (כמות: ${row.כמות}, תאריך: ${row.תאריך})`
            ).join(', ');
            
            await fetchData();
            setSelectedRows([]);
            setStatusMessage({text: `${selectedRows.length} פריטים נמחקו בהצלחה: ${deletedItemsDetails}`, type: "success"});
        } catch (err: any) {
            console.error("Unexpected error during deletion:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        } finally {
            setLoading(false);
        }
    };

    const mirrorHebrewSmart = (str: string | number) => {
        if (str === null || str === undefined || str === '') return '';
        // Convert to string if it's a number
        const strValue = String(str);
        return strValue
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
            // Get active tab data to export from both tables, filtered by location and exclude שצל items
            const ballDataToExport = (ballDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range && item.צורך !== 'שצל');
            const explosionDataToExport = (explosionDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range && item.צורך !== 'שצל');
            const dataToExport = [...ballDataToExport, ...explosionDataToExport];

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

            // Process each date group on its own page
            let pageIndex = 0;
            for (const [date, items] of Object.entries(groupedByDate)) {
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

                // Add table header for items
                y += 15;
                doc.setFillColor(240, 240, 240);
                doc.rect(margin, y, pageWidth - (2 * margin), 10, 'F');

                doc.setFontSize(12);
                doc.text(mirrorHebrewSmart('פריט'), pageWidth - margin - 10, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('כמות'), pageWidth / 2 + 20, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('צורך'), pageWidth / 2 - 20, y + 7, {align: 'right'});

                // Add item details
                y += 15;
                items.forEach((item: LogisticItem, i: number) => {
                    doc.text(mirrorHebrewSmart(item.פריט || ''), pageWidth - margin - 10, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(`${item.כמות || '0'}`), pageWidth / 2 + 20, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(item.צורך || ''), pageWidth / 2 - 20, y, {align: 'right'});
                    y += 8;

                    // Add a light separator line
                    if (i < items.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(margin, y - 4, pageWidth - margin, y - 4);
                    }
                });

                // Footer with signatures side by side
                y = pageHeight - 50;

                // Draw a line to separate content from footer
                doc.setDrawColor(0, 0, 0);
                doc.line(margin, y - 10, pageWidth - margin, y - 10);

                // Create two-column layout for signatures
                const columnWidth = (pageWidth - (2 * margin)) / 2;
                const startY = y;

                // Right column: משתמש and חתימת_מחתים
                doc.setFontSize(10);
                y = startY;
                doc.text(mirrorHebrewSmart(items[0].משתמש || ''), pageWidth - margin - 5, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(items[0].מספר_אישי_מחתים || ''), pageWidth - margin - 5, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart('מחלקת הלוגיסטיקה'), pageWidth - margin - 5, y, {align: 'right'});
                y += 8;

                // Add signature image if available
                if (items[0].חתימת_מחתים && items[0].חתימת_מחתים.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימת_מחתים, 'PNG', pageWidth / 2 + 10, y, columnWidth - 20, 25);
                    } catch (err) {
                        console.error("Error adding מחתים signature:", err);
                    }
                }

                // Left column: שם_החותם and חתימה
                y = startY;
                doc.text(mirrorHebrewSmart(items[0].שם_החותם || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(items[0].מספר_אישי_החותם || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(selectedSheet.name || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 8;

                // Add signature image if available
                if (items[0].חתימה && items[0].חתימה.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימה, 'PNG', margin + 10, y, columnWidth - 20, 25);
                    } catch (err) {
                        console.error("Error adding חותם signature:", err);
                    }
                }

                // Add page number in the bottom center
                y = pageHeight - 10;
                doc.setFontSize(10);
                doc.text(`${pageIndex}/${Object.keys(groupedByDate).length}`, pageWidth / 2, y, {align: 'center'});
            }

            // Add שצל items at the end
            const ballShatzalData = (ballDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range && item.צורך === 'שצל');
            const explosionShatzalData = (explosionDataByStatus['החתמה'] || []).filter(item => item.פלוגה === selectedSheet.range && item.צורך === 'שצל');
            const shatzalDataToExport = [...ballShatzalData, ...explosionShatzalData];

            // Group שצל items by date
            const shatzalGroupedByDate = shatzalDataToExport.reduce((groups: { [key: string]: LogisticItem[] }, item) => {
                const date = item.תאריך || '';
                if (!groups[date]) {
                    groups[date] = [];
                }
                groups[date].push(item);
                return groups;
            }, {});

            // Process each שצל date group on its own page
            for (const [date, items] of Object.entries(shatzalGroupedByDate)) {
                // Add new page for שצל items
                doc.addPage();
                let y = margin;

                // Try to add logo
                try {
                    doc.addImage(logoImg, 'JPEG', margin, y, 30, 30);
                } catch (logoErr) {
                    console.error("Error adding logo:", logoErr);
                }

                // Add header
                y += 35;
                doc.setFontSize(18);
                doc.text(mirrorHebrewSmart(`טופס החתמה שצל - פלוגה ${selectedSheet.range}`), pageWidth - margin, y, {align: 'right'});

                // Add current date label
                y += 12;
                doc.setFontSize(12);
                doc.text(mirrorHebrewSmart('תאריך:'), pageWidth - margin, y, {align: 'right'});
                y += 7;
                doc.text(today, pageWidth - margin, y, {align: 'right'});

                // Add record date label
                y += 10;
                doc.text(mirrorHebrewSmart('תאריך הרישום:'), pageWidth - margin, y, {align: 'right'});
                y += 7;
                doc.text(date, pageWidth - margin, y, {align: 'right'});

                // Add table header for items
                y += 15;
                doc.setFillColor(240, 240, 240);
                doc.rect(margin, y, pageWidth - (2 * margin), 10, 'F');

                doc.setFontSize(12);
                doc.text(mirrorHebrewSmart('פריט'), pageWidth - margin - 10, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('כמות'), pageWidth / 2 + 20, y + 7, {align: 'right'});
                doc.text(mirrorHebrewSmart('צורך'), pageWidth / 2 - 20, y + 7, {align: 'right'});

                // Add item details
                y += 15;
                items.forEach((item: LogisticItem, i: number) => {
                    doc.text(mirrorHebrewSmart(item.פריט || ''), pageWidth - margin - 10, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(`${item.כמות || '0'}`), pageWidth / 2 + 20, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(item.צורך || ''), pageWidth / 2 - 20, y, {align: 'right'});
                    y += 8;

                    // Add a light separator line
                    if (i < items.length - 1) {
                        doc.setDrawColor(200, 200, 200);
                        doc.line(margin, y - 4, pageWidth - margin, y - 4);
                    }
                });

                // Footer with signatures side by side
                y = pageHeight - 50;

                // Draw a line to separate content from footer
                doc.setDrawColor(0, 0, 0);
                doc.line(margin, y - 10, pageWidth - margin, y - 10);

                // Create two-column layout for signatures
                const columnWidth = (pageWidth - (2 * margin)) / 2;
                const startY = y;

                // Right column: משתמש and חתימת_מחתים
                doc.setFontSize(10);
                y = startY;
                doc.text(mirrorHebrewSmart(items[0].משתמש || ''), pageWidth - margin - 5, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(items[0].מספר_אישי_מחתים || ''), pageWidth - margin - 5, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart('מחלקת הלוגיסטיקה'), pageWidth - margin - 5, y, {align: 'right'});
                y += 8;

                // Add signature image if available
                if (items[0].חתימת_מחתים && items[0].חתימת_מחתים.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימת_מחתים, 'PNG', pageWidth / 2 + 10, y, columnWidth - 20, 25);
                    } catch (err) {
                        console.error("Error adding מחתים signature:", err);
                    }
                }

                // Left column: שם_החותם and חתימה
                y = startY;
                doc.text(mirrorHebrewSmart(items[0].שם_החותם || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(items[0].מספר_אישי_החותם || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 5;
                doc.text(mirrorHebrewSmart(selectedSheet.name || ''), pageWidth / 2 - 10, y, {align: 'right'});
                y += 8;

                // Add signature image if available
                if (items[0].חתימה && items[0].חתימה.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימה, 'PNG', margin + 10, y, columnWidth - 20, 25);
                    } catch (err) {
                        console.error("Error adding חותם signature:", err);
                    }
                }
            }

            // Save the PDF
            doc.save(`${selectedSheet.name} - טופס החתמה תחמושת.pdf`);
            setStatusMessage({text: "הפקת דפי החתמה הושלמה בהצלחה", type: "success"});
        } catch (err) {
            console.error("Error in PDF creation:", err);
            setStatusMessage({text: `שגיאה ביצירת PDF: ${err}`, type: "error"});
        }
    };

    // Function to export data to Excel
    const handleExcelExport = () => {
        try {
            const combinedData = [...ballRowData, ...explosionRowData];

            if (!combinedData || combinedData.length === 0) {
                setStatusMessage({text: "אין נתונים להורדה", type: "error"});
                return;
            }

            // Process data to remove 'id' field
            const exportData = combinedData.map(item => {
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
        setSignerPersonalId(0);
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

            {(permissions[selectedSheet.range] || permissions['ammo']) && (
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-4">
                    <h2 className="text-2xl font-bold">{selectedSheet.name}</h2>

                    <div className="flex flex-wrap gap-2">
                        <Button
                            onClick={() => {
                                if (permissions['ammo']) {
                                    setDialogMode('החתמה');
                                    setSignatureDialogOpen(true);
                                } else {
                                    setDialogMode('דיווח');
                                    setOpen(true);
                                }
                            }}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {permissions['ammo'] ? 'החתמה/ זיכוי תחמושת' : 'דיווח שצל'}
                        </Button>

                        {(permissions[selectedSheet.range]) && (
                            <Button
                                onClick={handleDeleteSelectedItems}
                                className="bg-red-500 hover:bg-red-600"
                                disabled={selectedRows.length === 0}
                            >
                                מחיקת דיווח ({selectedRows.length})
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
            
            {/* View toggle for דיווח tab */}
            {activeTab === 'דיווח' && (
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
                    {viewMode === 'cards' && (
                        <Popover>
                            <PopoverTrigger asChild>
                                <Button
                                    variant="outline"
                                    size="sm"
                                    className="flex items-center gap-1"
                                >
                                    <Info className="h-4 w-4" />
                                </Button>
                            </PopoverTrigger>
                            <PopoverContent className="w-80 text-right" align="center" side="bottom" alignOffset={0}>
                                <h4 className="font-bold text-blue-900 mb-2">הפעולות שניתן לבצע הן:</h4>
                                <ul className="list-disc list-inside space-y-1 text-blue-800 text-sm">
                                    {permissions['ammo'] ? (
                                        <>
                                            <li>העברת דיווח לשצל על ידי לחיצה על התאריך והשלמת פרטי השצל.</li>
                                            <li>לחיצה על כרטיסיה פנימית (פריט אחד) וסימון שנקרא (כלומר דיווח טופל), והפוך.</li>
                                            <li>לחיצה על כרטיסיה פנימית (פריט אחד) ומחיקת הפריט במידה ולא נקראה. (במידה וישנו טעות בדיווח).</li>
                                        </>
                                    ) : (
                                        <li>לחיצה על כרטיסיה פנימית (פריט אחד) ומחיקת הפריט במידה ולא נקראה. (במידה וישנו טעות בדיווח).</li>
                                    )}
                                    <li>כרטיסיה עם רקע אדום נחשבת ככרטיסיה שנקראה וטופלה.</li>
                                    <li>מעבר לטבלה על מנת לסנן ולהגיע לתוצאה רצויה.</li>
                                </ul>
                            </PopoverContent>
                        </Popover>
                    )}
                </div>
            )}

            {/* Conditional rendering: Card view or Table view for דיווח */}
            {activeTab === 'דיווח' && viewMode === 'cards' ? (
                <div className="space-y-4 mb-8">
                    {groupedByDate.length === 0 ? (
                        <div className="text-center p-8 text-gray-500">
                            אין דיווחים להצגה
                        </div>
                    ) : (
                        groupedByDate.map(([date, items]) => (
                            <div key={date} className="border rounded-lg shadow-sm bg-white overflow-hidden">
                                {/* Date header */}
                                <div 
                                    className={`bg-blue-50 border-b px-4 py-3 flex justify-between items-center ${permissions['ammo'] ? 'cursor-pointer hover:bg-blue-100' : ''}`}
                                    onClick={() => permissions['ammo'] && handleDateClicked(items[0])}
                                >
                                    <h3 className="font-bold text-lg text-blue-900">{date}</h3>
                                    <span className="text-sm text-blue-700">מדווח: {items[0].משתמש}</span>
                                </div>
                                
                                {/* Items list */}
                                <div className="divide-y">
                                    {items.map((item, idx) => (
                                        <div 
                                            key={item.id || idx} 
                                            className={`p-4 cursor-pointer transition-colors ${item.נקרא === 'כן' ? 'bg-red-100 hover:bg-red-200' : 'hover:bg-gray-50'}`}
                                            onClick={() => handleCardBodyClick(item)}
                                        >
                                            <div className="grid grid-cols-3 gap-3 text-sm">
                                                <div>
                                                    <span className="font-semibold text-gray-600">סוג:</span>
                                                    <span className="mr-2 text-gray-900">{item.is_explosion ? 'נפיצה' : 'קליעית'}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-gray-600">פריט:</span>
                                                    <span className="mr-1 text-gray-900">{item.פריט}</span>
                                                </div>
                                                <div>
                                                    <span className="font-semibold text-gray-600">כמות:</span>
                                                    <span className="mr-2 text-gray-900">{item.כמות}</span>
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        ))
                    )}
                </div>
            ) : (
                <>
                    {/* Ball Ammo Grid */}
                    <div className="mb-8">
                        <div className="flex justify-start items-center gap-4 mb-2">
                            <h3 className="text-xl font-bold">קליעית</h3>
                            {(permissions['ammo']) && activeTab !== 'החתמה' && (
                                <Button
                                    onClick={() => handleDeleteSelectedItems()}
                                    className="bg-red-500 hover:bg-red-600"
                                    disabled={selectedRows.length === 0}
                                >
                                    מחיקת דיווח ({selectedRows.length})
                                </Button>
                            )}
                        </div>
                        <div className="ag-theme-alpine w-[60vh] h-[40vh] mb-4 overflow-auto" style={{maxWidth: '100%'}}>
                            <AgGridReact
                        rowData={activeTab === 'החתמה' ? summarizedBallSignatureData : ballDataByStatus[activeTab] || []}
                        columnDefs={activeTab === 'החתמה' ? summaryColumns : baseColumns}
                        enableRtl={true}
                        defaultColDef={{
                            ...defaultColDef,
                            checkboxSelection: activeTab !== 'החתמה' ? (params) => {
                                return params.column.getColId() === 'checkboxCol';
                            } : false
                        }}
                        suppressHorizontalScroll={false}
                        rowSelection={activeTab !== 'החתמה' ? 'multiple' : undefined}
                        suppressRowClickSelection={true}
                        onSelectionChanged={(params) => {
                            const selectedRows = params.api.getSelectedRows();
                            setSelectedRows(selectedRows);
                        }}
                        onCellClicked={(event) => {
                            if (permissions['ammo'] && event.colDef && event.colDef.field === 'תאריך')
                                handleDateClicked(event.data)
                        }}
                        onCellValueChanged={(params) => {
                            if (params.colDef.field === 'נקרא') {
                                handleReadStatusChange(params);
                            }
                        }}
                        getRowStyle={(params) => {
                            if (params.data && params.data.נקרא === 'כן') {
                                return {backgroundColor: '#ffcccc'};
                            }
                            // Add light blue background to every second row in החתמה mode
                            if (activeTab === 'החתמה' && params.rowIndex % 2 === 1) {
                                return {backgroundColor: '#add8e6'};
                            }
                        }}
                    />
                </div>
            </div>

            {/* Explosion Ammo Grid */}
            <div className="mb-8">
                <div className="flex justify-start items-center gap-4 mb-2">
                    <h3 className="text-xl font-bold">נפיצה</h3>
                </div>
                <div className="ag-theme-alpine w-[60vh] h-[40vh] mb-4 overflow-auto" style={{maxWidth: '100%'}}>
                    <AgGridReact
                        rowData={activeTab === 'החתמה' ? summarizedExplosionSignatureData : explosionDataByStatus[activeTab] || []}
                        columnDefs={activeTab === 'החתמה' ? summaryColumns : baseColumns}
                        enableRtl={true}
                        defaultColDef={{
                            ...defaultColDef,
                            checkboxSelection: activeTab !== 'החתמה' ? (params) => {
                                return params.column.getColId() === 'checkboxCol';
                            } : false
                        }}
                        suppressHorizontalScroll={false}
                        rowSelection={activeTab !== 'החתמה' ? 'multiple' : undefined}
                        suppressRowClickSelection={true}
                        onSelectionChanged={(params) => {
                            const selectedRows = params.api.getSelectedRows();
                            setSelectedRows(selectedRows);
                        }}
                        onCellClicked={(event) => {
                            if (permissions['ammo'] && event.colDef && event.colDef.field === 'תאריך')
                                handleDateClicked(event.data)
                        }}
                        onCellValueChanged={(params) => {
                            if (params.colDef.field === 'נקרא') {
                                handleReadStatusChange(params);
                            }
                        }}
                        getRowStyle={(params) => {
                            if (params.data && params.data.נקרא === 'כן') {
                                return {backgroundColor: '#ffcccc'};
                            }
                            // Add light blue background to every second row in החתמה mode
                            if (activeTab === 'החתמה' && params.rowIndex % 2 === 1) {
                                return {backgroundColor: '#add8e6'};
                            }
                        }}
                    />
                </div>
            </div>
                </>
            )}

            {/* Item form dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-right">{dialogMode === 'דיווח' ? 'דיווח שצל' : 'החתם על פריט'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4 text-right">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <Label htmlFor={`ammo-type-${index}`} className="text-right block mb-2">סוג
                                        תחמושת</Label>
                                    <Select
                                        value={item.סוג_תחמושת || 'קליעית'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].סוג_תחמושת = value;
                                            // Reset פריט when changing ammo type
                                            newItems[index].פריט = '';
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר סוג"/>
                                        </SelectTrigger>
                                        <SelectContent className="text-right" dir="rtl">
                                            <SelectItem value="קליעית">קליעית</SelectItem>
                                            <SelectItem value="נפיצה">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor={`item-${index}`} className="text-right block mb-2">פריט</Label>
                                    <div className="relative">
                                        <Input
                                            id={`item-${index}`}
                                            type="text"
                                            value={item.פריט || ''}
                                            onChange={(e) => {
                                                const newItems = [...items];
                                                newItems[index].פריט = e.target.value;
                                                setItems(newItems);
                                            }}
                                            onFocus={() => {
                                                setShowSuggestions(prev => ({...prev, [index]: true}));
                                            }}
                                            onClick={() => {
                                                setShowSuggestions(prev => ({...prev, [index]: true}));
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setShowSuggestions(prev => ({...prev, [index]: false}));
                                                }, 200);
                                            }}
                                            placeholder="הקלד או בחר פריט"
                                            className="text-right pr-8"
                                            dir="rtl"
                                        />
                                        <svg 
                                            className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {showSuggestions[index] && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {(dialogMode === 'דיווח' 
                                                    ? (item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNamesFromHahatama : uniqueBallItemNamesFromHahatama)
                                                    : (item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNames : uniqueBallItemNames)
                                                ).filter(name => name.toLowerCase().includes((item.פריט || '').toLowerCase()))
                                                .map((name, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => {
                                                            const newItems = [...items];
                                                            newItems[index].פריט = name;
                                                            setItems(newItems);
                                                            setShowSuggestions(prev => ({...prev, [index]: false}));
                                                        }}
                                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-right"
                                                    >
                                                        {name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor={`qty-${index}`} className="text-right block mb-2">כמות</Label>
                                    <Input
                                        id={`qty-${index}`}
                                        type="number"
                                        value={item.כמות || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            const parsed = parseInt(e.target.value, 10);
                                            const safe = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
                                            newItems[index].כמות = safe;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                        min={1}
                                        step={1}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor={`need-${index}`} className="text-right block mb-2">צורך</Label>
                                    <Select
                                        value={!permissions['ammo'] ? 'שצל' : (item.צורך || 'ניפוק')}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].צורך = value;
                                            setItems(newItems);
                                        }}
                                        disabled={!permissions['ammo']} // Disable for non-munitions users
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר צורך"/>
                                        </SelectTrigger>
                                        <SelectContent className="text-right" dir="rtl">
                                            <SelectItem value="שצל">שצל</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                            {dialogMode === 'דיווח' ? 'שלח דרישות' : 'החתם על פריטים'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Signature dialog */}
            <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">החתם על פריטים</DialogTitle>
                        <DialogDescription className="text-right">
                            {currentItem && `החתמה על ${currentItem.פריט} `}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/*<div className="space-y-4 py-4 text-right">*/}
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-4">
                                <div>
                                    <Label htmlFor={`sig-ammo-type-${index}`} className="text-right block mb-2">סוג
                                        תחמושת</Label>
                                    <Select
                                        value={item.סוג_תחמושת || 'קליעית'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].סוג_תחמושת = value;
                                            // Reset פריט when changing ammo type
                                            newItems[index].פריט = '';
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right" dir="rtl">
                                            <SelectValue placeholder="בחר סוג"/>
                                        </SelectTrigger>
                                        <SelectContent className="text-right" dir="rtl">
                                            <SelectItem value="קליעית">קליעית</SelectItem>
                                            <SelectItem value="נפיצה">נפיצה</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div className="md:col-span-2">
                                    <Label htmlFor={`sig-item-${index}`} className="text-right block mb-2">פריט</Label>
                                    <div className="relative">
                                        <Input
                                            id={`sig-item-${index}`}
                                            type="text"
                                            value={item.פריט || ''}
                                            onChange={(e) => {
                                                const newItems = [...items];
                                                newItems[index].פריט = e.target.value;
                                                setItems(newItems);
                                            }}
                                            onFocus={() => {
                                                setShowSuggestions(prev => ({...prev, [`sig-${index}`]: true}));
                                            }}
                                            onClick={() => {
                                                setShowSuggestions(prev => ({...prev, [`sig-${index}`]: true}));
                                            }}
                                            onBlur={() => {
                                                setTimeout(() => {
                                                    setShowSuggestions(prev => ({...prev, [`sig-${index}`]: false}));
                                                }, 200);
                                            }}
                                            placeholder="הקלד או בחר פריט"
                                            className="text-right pr-8"
                                            dir="rtl"
                                        />
                                        <svg 
                                            className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                                            fill="none" 
                                            stroke="currentColor" 
                                            viewBox="0 0 24 24"
                                        >
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7" />
                                        </svg>
                                        {showSuggestions[`sig-${index}`] && (
                                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                {(dialogMode === 'דיווח' 
                                                    ? (item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNamesFromHahatama : uniqueBallItemNamesFromHahatama)
                                                    : (item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNames : uniqueBallItemNames)
                                                ).filter(name => name.toLowerCase().includes((item.פריט || '').toLowerCase()))
                                                .map((name, i) => (
                                                    <div
                                                        key={i}
                                                        onClick={() => {
                                                            const newItems = [...items];
                                                            newItems[index].פריט = name;
                                                            setItems(newItems);
                                                            setShowSuggestions(prev => ({...prev, [`sig-${index}`]: false}));
                                                        }}
                                                        className="px-3 py-2 hover:bg-gray-100 cursor-pointer text-right"
                                                    >
                                                        {name}
                                                    </div>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div>
                                    <Label htmlFor={`sig-qty-${index}`} className="text-right block mb-2">כמות</Label>
                                    <Input
                                        id={`sig-qty-${index}`}
                                        type="number"
                                        value={item.כמות || ''}
                                        onChange={(e) => {
                                            const newItems = [...items];
                                            const parsed = parseInt(e.target.value, 10);
                                            const safe = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
                                            newItems[index].כמות = safe;
                                            setItems(newItems);
                                        }}
                                        className="text-right"
                                        min={1}
                                        step={1}
                                        inputMode="numeric"
                                        pattern="[0-9]*"
                                    />
                                </div>

                                <div>
                                    <Label htmlFor={`sig-need-${index}`} className="text-right block mb-2">צורך</Label>
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
                                        <SelectContent className="text-right" dir="rtl">
                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                            <SelectItem value="שצל">שצל</SelectItem>
                                            <SelectItem value="זיכוי">זיכוי</SelectItem>
                                        </SelectContent>
                                    </Select>
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
                                readOnly={items.some(item => item.צורך === 'שצל')}
                                disabled={items.some(item => item.צורך === 'שצל')}
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
                                readOnly={items.some(item => item.צורך === 'שצל')}
                                disabled={items.some(item => item.צורך === 'שצל')}
                            />
                        </div>

                        {!items.some(item => item.צורך === 'שצל') && (
                            <>
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
                            </>
                        )}
                    </div>

                    <DialogFooter>
                        <Button type="button" onClick={handleCloseModal} variant="outline">
                            ביטול
                        </Button>
                        <Button type="button" onClick={handleAddItem}>
                            {dialogMode === 'דיווח' ? 'שלח דרישות' : 'החתם על פריטים'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Card Action Modal */}
            <Dialog open={cardActionModalOpen} onOpenChange={setCardActionModalOpen}>
                <DialogContent className="sm:max-w-md">
                    <DialogHeader>
                        <DialogTitle>פעולות על פריט</DialogTitle>
                        <DialogDescription>
                            {selectedCardItem && (
                                <div className="mt-2 space-y-1 text-sm">
                                    <p><strong>תאריך:</strong> {selectedCardItem.תאריך}</p>
                                    <p><strong>פריט:</strong> {selectedCardItem.פריט}</p>
                                    <p><strong>כמות:</strong> {selectedCardItem.כמות}</p>
                                    <p><strong>סטטוס קריאה:</strong> {selectedCardItem.נקרא}</p>
                                </div>
                            )}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="flex flex-col gap-3 mt-4">
                        {selectedCardItem?.נקרא === 'לא' && (
                            <Button
                                onClick={handleDeleteCardItem}
                                className="bg-red-500 hover:bg-red-600 w-full"
                            >
                                מחק פריט
                            </Button>
                        )}
                        
                        {permissions['ammo'] && (
                            <Button
                                onClick={handleToggleReadStatus}
                                className="bg-blue-500 hover:bg-blue-600 w-full"
                            >
                                שנה סטטוס קריאה ל-{selectedCardItem?.נקרא === 'כן' ? 'לא' : 'כן'}
                            </Button>
                        )}
                    </div>

                    <DialogFooter className="mt-4">
                        <Button 
                            type="button" 
                            onClick={() => {
                                setCardActionModalOpen(false);
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

export default Ammo;
