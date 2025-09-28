import React, {useMemo, useState, useRef, useEffect} from "react";
import {AgGridReact} from "ag-grid-react";
import "ag-grid-community/styles/ag-grid.css";
import "ag-grid-community/styles/ag-theme-alpine.css";
import {supabase} from "@/lib/supabaseClient"
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Check, ChevronsUpDown, Trash} from "lucide-react";
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
    const [signatureItemPopoverOpen, setSignatureItemPopoverOpen] = useState(false);
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [activeTab, setActiveTab] = useState<string>('הזמנה'); // Track active tab

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
        מידה: '',
        כמות: 1,
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
            מידה: '',
            כמות: 1,
            צורך: 'ניפוק',
            הערה: ''
        };
    }

    // Fetch data from Supabase
    const fetchData = async () => {

        if (permissions[selectedSheet.range] || permissions['Logistic']) {
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
                    setRowData(data || []);
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

    // Initial data fetch
    useEffect(() => {
        fetchData();
    }, [selectedSheet.range]);

    // Group data by סטטוס
    const dataByStatus = useMemo(() => {
        const grouped = {הזמנה: [], החתמה: [], התעצמות: []} as Record<string, LogisticItem[]>;

        // First group the items by status
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

    // Get unique item names from החתמה items for dropdown
    const uniqueItemNames = useMemo(() => {
        const items = dataByStatus['החתמה'] || [];
        const uniqueItems = new Set<string>();

        items.forEach(item => {
            if (item.פריט) {
                uniqueItems.add(item.פריט);
            }
        });

        return Array.from(uniqueItems).sort();
    }, [dataByStatus]);

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

    // Create summary data for החתמה table
    const summarizedSignatureData = useMemo(() => {
        // Get only החתמה data
        const signatureData = dataByStatus['החתמה'] || [];

        if (signatureData.length === 0) {
            return [];
        }

        // Create a map to group by פריט (item) and sum up כמות (quantity)
        const itemSummary = new Map<string, LogisticItem>();

        // Process each row
        signatureData.forEach((row: LogisticItem) => {
            const item = row.פריט;
            const quantity = typeof row.כמות === 'number' ? row.כמות : parseInt(String(row.כמות), 10) || 0;

            if (itemSummary.has(item)) {
                // Item exists, update quantity
                const existing = itemSummary.get(item)!;
                existing.כמות = (existing.כמות || 0) + quantity;

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
                    מידה: row.מידה || '',
                    כמות: quantity,
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

        // Convert map to array
        return Array.from(itemSummary.values());
    }, [dataByStatus]);

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
            {field: 'צורך' as keyof LogisticItem, headerName: 'צורך', sortable: true, filter: true, width: 80},
            {field: 'מידה' as keyof LogisticItem, headerName: 'מידה', sortable: true, filter: true, width: 70},
            {
                field: 'סטטוס' as keyof LogisticItem, headerName: 'סטטוס', sortable: true, filter: true, width: 100,
                editable: permissions['Logistic'],
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {values: ['הזמנה', 'התעצמות', 'החתמה']},
                onCellValueChanged: async (params: any) => {
                    await handleStatusChange(params);
                }
            },
            {
                headerName: 'נקרא',
                field: 'נקרא' as keyof LogisticItem,
                sortable: true,
                filter: true,
                width: 80,
                editable: permissions['Logistic'],
                cellEditor: 'agSelectCellEditor',
                cellEditorParams: {values: ['כן', 'לא']},
                onCellValueChanged: async (params: any) => {
                    await handleReadStatusChange(params);
                }
            },
            {field: 'הערה' as keyof LogisticItem, headerName: 'הערה', sortable: true, filter: true, width: 110},
            {field: 'משתמש' as keyof LogisticItem, headerName: 'דורש', sortable: true, filter: true, width: 110},
        ];

        return columnDefs;
    }, [permissions, activeTab]);

    const handleDateClicked = async (data: any) => {
        const date = data.תאריך;

        // Find all rows with the same date in rowData
        const matchingRows = rowData.filter(item => item.תאריך === date && item.סטטוס === 'הזמנה');

        // Create items array from matching rows
        const itemsToShow = matchingRows.map(row => ({
            פריט: row.פריט || '',
            מידה: row.מידה || '',
            כמות: (row.צורך === 'זיכוי') ? -row.כמות : row.כמות || 1,
            צורך: row.צורך || 'ניפוק',
            הערה: row.הערה || '',
        }));

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
            setStatusMessage({text: "סטטוס עודכן בהצלחה", type: "success"});
        } catch (err: any) {
            console.error("Unexpected error during status update:", err);
            // Revert to old value
            params.node.setDataValue('סטטוס', params.oldValue);
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
        const newReadStatus = params.newValue;

        try {
            // Update the read status in Supabase
            // console.log(newReadStatus);
            // console.log(id);
            // console.log("id value:", id, typeof id);

            const {data, error} = await supabase
                .from("logistic")
                .update({"נקרא": newReadStatus}) // key must be quoted
                .eq("id", id)
                // .eq("פריט", ditem)
                // .eq("כמות", damount)
                .select();

            console.log("Updated:", data, "Error:", error);


            if (error) {
                console.error("Error updating read status:", error);
                // Revert to old value if there was an error
                params.node.setDataValue('נקרא', params.oldValue);
                setStatusMessage({text: `שגיאה בעדכון סטטוס קריאה: ${error.message}`, type: "error"});
                return;
            }

            // Refresh data after update
            fetchData();
            setStatusMessage({text: "סטטוס קריאה עודכן בהצלחה", type: "success"});
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
        const invalidItems = items.filter(item => !item.פריט);
        console.log("invalidItems", invalidItems);
        if (invalidItems.length > 0) {
            setStatusMessage({text: "יש למלא את כל השדות הנדרשים", type: "error"});
            setOpen(false);
            setSignatureDialogOpen(false);
            return;
        }
        // Format items for insertion
        const formattedDate = new Date().toLocaleString('he-IL');
        let formattedItems = items.map(item => ({
            תאריך: formattedDate,
            פריט: item.פריט,
            מידה: item.מידה,
            כמות: (item.צורך === 'זיכוי' && item.כמות) ? -item.כמות : item.כמות,
            שם_החותם: signerName,
            חתימת_מחתים: permissions['signature'] ? String(permissions['signature']) : '',
            חתימה: dataURL,
            צורך: item.צורך || 'ניפוק',
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
                מידה: '',
                // Opposite quantity logic: negative for issues, positive for credits
                כמות: (item.צורך === 'זיכוי' && item.כמות !== undefined) ? (item.כמות || 0) : -(item.כמות || 0),
                שם_החותם: '',
                חתימת_מחתים: '',
                חתימה: '',
                צורך: item.צורך || 'ניפוק',
                הערה: item.הערה || '',
                סטטוס: dialogMode,
                משתמש: permissions['name'] || '',
                פלוגה: 'גדוד', // Battalion inventory
            }));
            
            // Combine original items with battalion entries
            formattedItems = [...formattedItems, ...battalionEntries];
        }

        try {
            setLoading(true);

            console.log('before insert: ', formattedItems)
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
                setItems([{...defaultItem}]);
                await fetchData();
                setOpen(false);
                setSignatureDialogOpen(false);
                setSignerName('');
                setStatusMessage({text: "פריטים נוספו בהצלחה", type: "success"});
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

            if (selectedRows.filter(row => row.נקרא).length > 0) {
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
                await fetchData();
                setSelectedRows([]);
                setStatusMessage({text: `${selectedRows.length} פריטים נמחקו בהצלחה`, type: "success"});
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
            // Get active tab data to export
            const dataToExport = dataByStatus['החתמה'] || [];

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
                doc.text(mirrorHebrewSmart('כמות'), pageWidth / 2, y + 7, {align: 'right'});

                // Add item details
                y += 15;
                items.forEach((item: LogisticItem, i: number) => {
                    doc.text(mirrorHebrewSmart(item.פריט || ''), pageWidth - margin - 10, y, {align: 'right'});
                    doc.text(mirrorHebrewSmart(`${item.כמות || '0'}`), pageWidth / 2, y, {align: 'right'});
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

                // Create two-column layout for signatures
                const columnWidth = (pageWidth - (2 * margin)) / 2;

                // First column: משתמש and חתימת_מחתים
                doc.setFontSize(12);
                doc.text(mirrorHebrewSmart('שם המחתים:'), pageWidth - margin, y, {align: 'right'});
                y += 6;
                doc.text(mirrorHebrewSmart(items[0].משתמש || ''), pageWidth - margin - 10, y, {align: 'right'});

                // Add unit/department line between name and signature
                y += 8;
                doc.text(mirrorHebrewSmart('מחלקת הלוגיסטיקה'), pageWidth - margin - 10, y, {align: 'right'});

                y += 12; // spacing before signature label
                doc.text(mirrorHebrewSmart('חתימת מחתים:'), pageWidth - margin, y, {align: 'right'});
                y += 10; // spacing before signature image

                // Remove border box: draw only the signature image if available
                if (items[0].חתימת_מחתים && items[0].חתימת_מחתים.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימת_מחתים, 'PNG', pageWidth / 2 + 5, y + 2, columnWidth - 15, 30); // Increased height
                    } catch (err) {
                        console.error("Error adding מחתים signature:", err);
                    }
                }

                // Second column: שם_החותם and חתימה (reset y position)
                y = pageHeight - 120; // Match the updated starting position

                doc.text(mirrorHebrewSmart('שם החותם:'), pageWidth / 2 - 5, y, {align: 'right'});
                y += 6;
                doc.text(mirrorHebrewSmart(items[0].שם_החותם || ''), pageWidth / 2 - 15, y, {align: 'right'});

                // Add selected sheet name between signer name and signature
                y += 8;
                doc.text(mirrorHebrewSmart(selectedSheet.name || ''), pageWidth / 2 - 15, y, {align: 'right'});

                y += 12; // spacing before signature label
                doc.text(mirrorHebrewSmart('חתימה:'), pageWidth / 2 - 5, y, {align: 'right'});
                y += 10; // spacing before signature image

                // Remove border box: draw only the signature image if available
                if (items[0].חתימה && items[0].חתימה.startsWith('data:image/')) {
                    try {
                        doc.addImage(items[0].חתימה, 'PNG', margin + 5, y + 2, columnWidth - 15, 30); // Increased height
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
            doc.save(`${selectedSheet.name} - טופס החתמה.pdf`);
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

            {(permissions[selectedSheet.range] || permissions['Logistic']) && (
                <div className="flex justify-between mb-4">
                    <h2 className="text-2xl font-bold">{selectedSheet.name}</h2>

                    <div className="space-x-2">
                        <Button
                            onClick={() => {
                                if (permissions['Logistic']) {
                                    setDialogMode('החתמה');
                                    setSignatureDialogOpen(true);
                                } else {
                                    setDialogMode('הזמנה');
                                    setOpen(true);
                                }
                            }}
                            className="bg-blue-500 hover:bg-blue-600"
                        >
                            {permissions['Logistic'] ? 'החתמה/ זיכוי פריטים' : 'הוספת דרישות'}
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
            <div className="flex overflow-x-auto border-b mb-4">
                {STATUSES.map(status => (
                    <button
                        key={status}
                        className={`py-2 px-4 ${activeTab === status ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                        onClick={() => setActiveTab(status)}
                    >
                        {status} ({dataByStatus[status]?.length || 0})
                    </button>
                ))}
            </div>

            {/* AG Grid component with improved layout */}
            <div className="ag-theme-alpine w-[110vh] h-[45vh] mb-8 overflow-auto" style={{maxWidth: '100%'}}>
                <div className="ag-theme-alpine w-[110vh] h-[45vh] mb-8 overflow-auto" style={{maxWidth: '100%'}}>
                    <AgGridReact
                        ref={gridRef}
                        rowData={activeTab === 'החתמה' ? summarizedSignatureData : dataByStatus[activeTab] || []}
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
                            if (permissions['Logistic'] && event.colDef && event.colDef.field === 'תאריך')
                                handleDateClicked(event.data)
                        }}
                        getRowStyle={(params) => {
                            if (params.data && params.data.נקרא === 'כן') {
                                return {backgroundColor: '#ffcccc'}; // Light red background
                            }
                        }}
                    />
                </div>
            </div>

            {/* Item form dialog */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle
                            className="text-right">{dialogMode === 'הזמנה' ? 'דרישות' : 'החתם על פריט'}</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4 text-right">
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-3 gap-4 mb-4">
                                <div>
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

                                <div>
                                    <Label htmlFor={`size-${index}`} className="text-right block mb-2">מידה</Label>
                                    <Select
                                        value={item.מידה || 'ללא מידה'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].מידה = value === 'ללא מידה' ? '' : value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right">
                                            <SelectValue placeholder="בחר מידה"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ללא מידה">ללא מידה</SelectItem>
                                            <SelectItem value="XXL">XXL</SelectItem>
                                            <SelectItem value="XL">XL</SelectItem>
                                            <SelectItem value="L">L</SelectItem>
                                            <SelectItem value="M">M</SelectItem>
                                            <SelectItem value="S">S</SelectItem>
                                            <SelectItem value="XS">XS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
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

                                <div className="col-span-2">
                                    <Label htmlFor={`need-${index}`} className="text-right block mb-2">צורך</Label>
                                    <Select
                                        value={item.צורך || 'ניפוק'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].צורך = value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר צורך"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                            <SelectItem value="בלאי">בלאי/ החלפה</SelectItem>
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
                            {dialogMode === 'הזמנה' ? 'שלח דרישות' : 'החתם על פריטים'}
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
                            {currentItem && `החתמה על ${currentItem.פריט} (${currentItem.מידה})`}
                        </DialogDescription>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
                        {/*<div className="space-y-4 py-4 text-right">*/}
                        {items.map((item, index) => (
                            <div key={index} className="grid grid-cols-3 gap-4 mb-4">
                                <div>
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

                                <div>
                                    <Label htmlFor={`size-${index}`} className="text-right block mb-2">מידה</Label>
                                    <Select
                                        value={item.מידה || 'ללא מידה'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].מידה = value === 'ללא מידה' ? '' : value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger className="text-right">
                                            <SelectValue placeholder="בחר מידה"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ללא מידה">ללא מידה</SelectItem>
                                            <SelectItem value="XXL">XXL</SelectItem>
                                            <SelectItem value="XL">XL</SelectItem>
                                            <SelectItem value="L">L</SelectItem>
                                            <SelectItem value="M">M</SelectItem>
                                            <SelectItem value="S">S</SelectItem>
                                            <SelectItem value="XS">XS</SelectItem>
                                        </SelectContent>
                                    </Select>
                                </div>

                                <div>
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

                                <div className="col-span-2">
                                    <Label htmlFor={`need-${index}`} className="text-right block mb-2">צורך</Label>
                                    <Select
                                        value={item.צורך || 'ניפוק'}
                                        onValueChange={(value) => {
                                            const newItems = [...items];
                                            newItems[index].צורך = value;
                                            setItems(newItems);
                                        }}
                                    >
                                        <SelectTrigger>
                                            <SelectValue placeholder="בחר צורך"/>
                                        </SelectTrigger>
                                        <SelectContent>
                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                            <SelectItem value="בלאי">בלאי/ החלפה</SelectItem>
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
                            {dialogMode === 'הזמנה' ? 'שלח דרישות' : 'החתם על פריטים'}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </div>
    );
};

export default Logistic;
