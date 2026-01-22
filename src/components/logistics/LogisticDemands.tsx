import React, {useMemo, useState, useEffect, useRef} from "react";
import {supabase} from "@/lib/supabaseClient"
import {usePermissions} from "@/contexts/PermissionsContext";
import StatusMessage from "@/components/feedbackFromBackendOrUser/StatusMessageProps";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import {Button} from '@/components/ui/button';
import {Label} from '@/components/ui/label';
import {Input} from '@/components/ui/input';
import SignatureCanvas from "react-signature-canvas";
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';
import CreatableSelect from 'react-select/creatable';
import {Trash, LayoutGrid, Table as TableIcon, ArrowUpDown, ArrowUp, ArrowDown, Filter, Download} from 'lucide-react';
import * as XLSX from 'xlsx';

interface LogisticDemandsProps {
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
    מספר_אישי_החותם?: number;
    מספר_אישי_מחתים?: number;
    פלוגה: string;
    חתימת_מחתים?: string;
    created_at?: string;
};

const LogisticDemands: React.FC<LogisticDemandsProps> = ({selectedSheet}) => {
    const {permissions} = usePermissions();
    const [rowData, setRowData] = useState<LogisticItem[]>([]);
    const [allData, setAllData] = useState<LogisticItem[]>([]);
    const [viewMode, setViewMode] = useState<'cards' | 'table'>('cards');
    const [loading, setLoading] = useState(true);
    const [sortConfig, setSortConfig] = useState<{key: keyof LogisticItem | null, direction: 'asc' | 'desc' | null}>({key: null, direction: null});
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({
        תאריך: '',
        פלוגה: '',
        משתמש: '',
        פריט: '',
        צורך: '',
        הערה: '',
        נקרא: ''
    });
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const [statusMessage, setStatusMessage] = useState({text: "", type: ""});
    const [selectedCardItem, setSelectedCardItem] = useState<LogisticItem | null>(null);
    const [cardDetailModalOpen, setCardDetailModalOpen] = useState(false);
    const [matchingDateRows, setMatchingDateRows] = useState<LogisticItem[]>([]);
    const [open, setOpen] = useState(false);
    
    // Signature dialog states
    const [signatureDialogOpen, setSignatureDialogOpen] = useState(false);
    const [items, setItems] = useState<Partial<LogisticItem>[]>([]);
    const [signerName, setSignerName] = useState('');
    const [signerPersonalId, setSignerPersonalId] = useState(0);
    const [dataURL, setDataURL] = useState('');
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [dialogMode, setDialogMode] = useState<'הזמנה' | 'החתמה'>('החתמה');
    const [customItemInput, setCustomItemInput] = useState('');
    const [clickedPlooga, setClickedPlooga] = useState('');
    
    const defaultItem: Partial<LogisticItem> = {
        פריט: '',
        כמות: 1,
        צורך: 'ניפוק',
        הערה: '',
    };

    // Get unique item names for autocomplete
    const uniqueItemNames = useMemo(() => {
        const names = new Set<string>();
        rowData.forEach(item => {
            if (item.פריט) names.add(item.פריט);
        });
        return Array.from(names).sort((a, b) => a.localeCompare(b, 'he'));
    }, [rowData]);

    // Save signature to state
    const saveSignature = () => {
        if (sigPadRef.current) {
            const dataUrl = sigPadRef.current.toDataURL();
            setDataURL(dataUrl);
        }
    };

    // Helper function to parse Hebrew date
    const parseHebrewDate = (dateStr: string) => {
        if (!dateStr) return null;
        const [datePart] = dateStr.split(', ');
        if (!datePart) return null;
        
        const [day, month, year] = datePart.split('.').map(Number);
        if (!day || !month || !year) return null;
        
        return new Date(year, month - 1, day);
    };

    // Fetch data from Supabase
    const fetchData = async () => {
        try {
            setLoading(true);
            const {data, error} = await supabase
                .from("logistic")
                .select("*")
                .eq("סטטוס", "הזמנה")
                .order("תאריך", {ascending: false});

            if (error) {
                console.error("Error fetching data:", error);
                setStatusMessage({
                    text: `שגיאה בטעינת נתונים: ${error.message}`,
                    type: "error"
                });
            } else {
                const fetchedData = (data || []) as LogisticItem[];
                setAllData(fetchedData);
                
                // Filter items to only show those from the last 7 days for cards view
                const now = new Date();
                const sevenDaysAgo = new Date(now);
                sevenDaysAgo.setDate(now.getDate() - 7);
                sevenDaysAgo.setHours(0, 0, 0, 0);

                const filteredData = fetchedData.filter(item => {
                    const itemDate = parseHebrewDate(item.תאריך || '');
                    if (!itemDate) return false;
                    return itemDate >= sevenDaysAgo;
                });

                setRowData(filteredData);
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

    useEffect(() => {
        fetchData();
    }, []);

    // Handle close modal
    const handleCloseModal = () => {
        setSignatureDialogOpen(false);
        setItems([{...defaultItem}]);
        setSignerName('');
        setSignerPersonalId(0);
        setDataURL('');
        if (sigPadRef.current) {
            sigPadRef.current.clear();
        }
    };

    // Handle sorting
    const handleSort = (key: keyof LogisticItem) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'asc') direction = 'desc';
            else if (sortConfig.direction === 'desc') direction = null;
        }
        setSortConfig({key: direction ? key : null, direction});
    };

    // Filter and sort table data
    const filteredAndSortedTableData = useMemo(() => {
        let filtered = allData.filter(item => {
            return (
                (!columnFilters.תאריך || item.תאריך?.toLowerCase().includes(columnFilters.תאריך.toLowerCase())) &&
                (!columnFilters.פלוגה || item.פלוגה?.toLowerCase().includes(columnFilters.פלוגה.toLowerCase())) &&
                (!columnFilters.משתמש || item.משתמש?.toLowerCase().includes(columnFilters.משתמש.toLowerCase())) &&
                (!columnFilters.פריט || item.פריט?.toLowerCase().includes(columnFilters.פריט.toLowerCase())) &&
                (!columnFilters.צורך || item.צורך?.toLowerCase().includes(columnFilters.צורך.toLowerCase())) &&
                (!columnFilters.הערה || item.הערה?.toLowerCase().includes(columnFilters.הערה.toLowerCase())) &&
                (!columnFilters.נקרא || item.נקרא?.toLowerCase().includes(columnFilters.נקרא.toLowerCase()))
            );
        });

        // Apply sorting
        if (sortConfig.key && sortConfig.direction) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key!];
                const bVal = b[sortConfig.key!];
                
                if (aVal === undefined || aVal === null) return 1;
                if (bVal === undefined || bVal === null) return -1;
                
                const aStr = String(aVal).toLowerCase();
                const bStr = String(bVal).toLowerCase();
                
                if (sortConfig.direction === 'asc') {
                    return aStr.localeCompare(bStr, 'he');
                } else {
                    return bStr.localeCompare(aStr, 'he');
                }
            });
        }

        return filtered;
    }, [allData, columnFilters, sortConfig]);

    // Check if any filter is active
    const hasActiveFilters = Object.values(columnFilters).some(value => value !== '');

    // Export to Excel
    const handleExportToExcel = () => {
        // Prepare data for export
        const exportData = filteredAndSortedTableData.map(item => ({
            'תאריך': item.תאריך || '',
            'פלוגה': item.פלוגה || '',
            'משתמש': item.משתמש || '',
            'פריט': item.פריט || '',
            'כמות': item.כמות || 0,
            'צורך': item.צורך || '',
            'הערה': item.הערה || '',
            'נקרא': item.נקרא || 'לא'
        }));

        // Create worksheet
        const ws = XLSX.utils.json_to_sheet(exportData);
        
        // Set column widths
        ws['!cols'] = [
            {wch: 20}, // תאריך
            {wch: 15}, // פלוגה
            {wch: 15}, // משתמש
            {wch: 30}, // פריט
            {wch: 10}, // כמות
            {wch: 15}, // צורך
            {wch: 30}, // הערה
            {wch: 10}  // נקרא
        ];

        // Create workbook
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'הזמנות');

        // Generate filename with current date
        const date = new Date().toLocaleDateString('he-IL').replace(/\./g, '-');
        const filename = `דרישות_לוגיסטיקה_${date}.xlsx`;

        // Save file
        XLSX.writeFile(wb, filename);

        setStatusMessage({text: 'הקובץ יוצא בהצלחה', type: 'success'});
    };

    // Group data by פלוגה (location) first, then by date
    const groupedByLocationAndDate = useMemo(() => {
        // First group by location
        const byLocation: { [location: string]: { [date: string]: LogisticItem[] } } = {};
        
        rowData.forEach(item => {
            const location = item.פלוגה || 'לא מוגדר';
            const date = item.תאריך || '';
            
            if (!byLocation[location]) {
                byLocation[location] = {};
            }
            if (!byLocation[location][date]) {
                byLocation[location][date] = [];
            }
            byLocation[location][date].push(item);
        });
        
        // Helper function to parse Hebrew date
        const parseHebrewDate = (dateStr: string) => {
            if (!dateStr) return 0;
            const [datePart, timePart] = dateStr.split(', ');
            if (!datePart) return 0;
            
            const [day, month, year] = datePart.split('.').map(Number);
            const [hours = 0, minutes = 0, seconds = 0] = (timePart || '').split(':').map(Number);
            
            return new Date(year, month - 1, day, hours, minutes, seconds).getTime();
        };
        
        // Convert to array and sort locations, then sort dates within each location
        const sortedByLocation = Object.entries(byLocation).map(([location, dates]) => {
            const sortedDates = Object.entries(dates).sort((a, b) => {
                const dateA = parseHebrewDate(a[0]);
                const dateB = parseHebrewDate(b[0]);
                return dateB - dateA; // Newest first
            });
            return [location, sortedDates] as [string, [string, LogisticItem[]][]];
        }).sort((a, b) => a[0].localeCompare(b[0], 'he')); // Sort locations alphabetically
        
        return sortedByLocation;
    }, [rowData]);

    // Handle date header click (same as Logistic component)
    const handleDateClicked = async (data: any) => {
        if (!permissions['logistic']) return;
        
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
            // Store the פלוגה from the clicked date
            setClickedPlooga(matchingRows[0].פלוגה || '');
        }

        // Set the items state to populate the dialog
        setItems(itemsToShow);

        // Set dialog mode to signature
        setDialogMode('החתמה');

        // Open the signature dialog
        setSignatureDialogOpen(true);
    };

    // Handle submit signature form
    const handleAddItem = async () => {
        setStatusMessage({text: "", type: ""});

        // Input validation
        const invalidItems = items.filter(item => !item.פריט || !item.כמות || item.כמות <= 0);
        if (invalidItems.length > 0) {
            setStatusMessage({text: "יש למלא את כל השדות הנדרשים (כולל כמות)", type: "error"});
            setSignatureDialogOpen(false);
            setLoading(false);
            return;
        }

        // Validate personal ID for החתמה mode
        if (dialogMode === 'החתמה' && !signerPersonalId) {
            setStatusMessage({text: "יש למלא את כל השדות הנדרשים", type: "error"});
            setLoading(false);
            setSignatureDialogOpen(false);
            return;
        }

        // Validate צורך for החתמה mode - only allow ניפוק or זיכוי
        if (dialogMode === 'החתמה') {
            const invalidItems = items.filter(item => item.צורך !== 'ניפוק' && item.צורך !== 'זיכוי');
            if (invalidItems.length > 0) {
                setStatusMessage({text: "בהחתמה ניתן לבחור רק ניפוק או זיכוי", type: "error"});
                setLoading(false);
                setSignatureDialogOpen(false);
                return;
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
            פלוגה: clickedPlooga,
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
                const itemsList = formattedItems.filter(item => item.פלוגה===clickedPlooga).map(item => `${item.פריט} (${item.צורך==='ניפוק' ? item.כמות : item.כמות}-)`).join(', ');
                const action = dialogMode === 'הזמנה' ? 'דווחו' : 'הוחתמו/ זוכו';
                setItems([{...defaultItem}]);
                await fetchData();
                setSignatureDialogOpen(false);
                setSignerName('');
                setSignerPersonalId(0);
                setStatusMessage({text: `${action} פריטים בהצלחה: ${itemsList}`, type: "success"});
            }
        } catch (err: any) {
            console.error("Unexpected error:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        } finally {
            setSignatureDialogOpen(false);
            setLoading(false);
        }
    };

    // Handle card click to show details
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

            await fetchData();
            setStatusMessage({
                text: `פריט נמחק בהצלחה - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, כמות: ${selectedCardItem.כמות}`,
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

            await fetchData();
            setStatusMessage({
                text: `סטטוס קריאה עודכן - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, נקרא: ${currentStatus} -> ${newStatus}`,
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

            await fetchData();
            setStatusMessage({
                text: `סטטוס עודכן - תאריך: ${selectedCardItem.תאריך}, פריט: ${selectedCardItem.פריט}, סטטוס: ${currentStatus} -> ${newStatus}`,
                type: "success"
            });
            setCardDetailModalOpen(false);
            setSelectedCardItem(null);
        } catch (err: any) {
            console.error("Unexpected error during status update:", err);
            setStatusMessage({text: `שגיאה לא צפויה: ${err.message}`, type: "error"});
        }
    };

    if (loading) {
        return (
            <div className="container mx-auto p-4">
                <div className="flex flex-col items-center justify-center h-[60vh]">
                    <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-center p-4">טוען נתונים...</p>
                </div>
            </div>
        );
    }

    return (
        <div className="container mx-auto p-4">
            <div className="mb-6 flex justify-between items-center">
                <div>
                    <h2 className="text-2xl font-bold mb-2">דרישות לוגיסטיקה</h2>
                    <p className="text-gray-600">{viewMode === 'cards' ? 'כל הדרישות מכל הפלוגות עד שבוע אחורה' : 'כל הדרישות מכל הפלוגות (כל התאריכים)'}</p>
                </div>
                <div className="flex gap-2">
                    {viewMode === 'table' && (
                        <button
                            onClick={handleExportToExcel}
                            className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors"
                            title="ייצוא ל-Excel"
                        >
                            <Download className="w-4 h-4" />
                            <span className="text-sm font-medium">ייצוא ל-Excel</span>
                        </button>
                    )}
                    <button
                        onClick={() => setViewMode('cards')}
                        className={`p-2 rounded-lg transition-colors ${
                            viewMode === 'cards'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title="תצוגת כרטיסים"
                    >
                        <LayoutGrid className="w-5 h-5" />
                    </button>
                    <button
                        onClick={() => setViewMode('table')}
                        className={`p-2 rounded-lg transition-colors ${
                            viewMode === 'table'
                                ? 'bg-blue-600 text-white'
                                : 'bg-gray-200 text-gray-600 hover:bg-gray-300'
                        }`}
                        title="תצוגת טבלה"
                    >
                        <TableIcon className="w-5 h-5" />
                    </button>
                </div>
            </div>

            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.type === 'success'}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({text: "", type: ""})}
                />
            )}

            {/* Card view grouped by location, then by date */}
            {viewMode === 'cards' && (
            <div className="space-y-6 mb-8">
                {groupedByLocationAndDate.length === 0 ? (
                    <div className="text-center p-8 text-gray-500">
                        אין דרישות להצגה
                    </div>
                ) : (
                    groupedByLocationAndDate.map(([location, dateGroups]) => (
                        <div key={location} className="border-2 rounded-lg shadow-md bg-white overflow-hidden">
                            {/* Location header */}
                            <div className="bg-gradient-to-r from-blue-500 to-blue-600 px-6 py-4">
                                <div className="flex justify-between items-center">
                                    <h3 className="font-bold text-xl text-white">{location}</h3>
                                    <span className="bg-white text-blue-600 px-3 py-1 rounded-full text-sm font-semibold">
                                        {dateGroups.reduce((sum, [, items]) => sum + items.length, 0)} דרישות
                                    </span>
                                </div>
                            </div>

                            {/* Date cards within this location */}
                            <div className="p-4 space-y-4">
                                {dateGroups.map(([date, items]) => (
                                    <div key={date} className="border rounded-lg shadow-sm bg-white overflow-hidden">
                                        {/* Date header */}
                                        <div
                                            className="bg-blue-50 border-b px-4 py-3 flex justify-between items-center cursor-pointer hover:bg-blue-100 transition-colors"
                                            onClick={() => {
                                                if (permissions['logistic']) {
                                                    handleDateClicked({תאריך: date} as LogisticItem);
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
                                ))}
                            </div>
                        </div>
                    ))
                )}
            </div>
            )}

            {/* Table view - all data without date filter */}
            {viewMode === 'table' && (
                <div className="bg-white rounded-lg shadow">
                    {/* Table header with row count */}
                    <div className="px-6 py-4 border-b bg-gray-50">
                        <div className="flex justify-between items-center">
                            <div>
                                <h3 className="text-lg font-semibold text-gray-900">טבלת דרישות</h3>
                                <p className="text-sm text-gray-600 mt-1">
                                    מציג {filteredAndSortedTableData.length} דרישות
                                    {hasActiveFilters && ` (מסונן מתוך ${allData.length} סה"כ)`}
                                </p>
                            </div>
                        </div>
                    </div>
                    <div className="overflow-x-auto">
                        {filteredAndSortedTableData.length === 0 && !hasActiveFilters ? (
                            <div className="text-center p-8 text-gray-500">
                                אין דרישות להצגה
                            </div>
                        ) : (
                            <table className="min-w-full divide-y divide-gray-200">
                                <thead className="bg-gray-50">
                                    <tr>
                                        {[
                                            {key: 'תאריך', label: 'תאריך'},
                                            {key: 'פלוגה', label: 'פלוגה'},
                                            {key: 'משתמש', label: 'משתמש'},
                                            {key: 'פריט', label: 'פריט'},
                                            {key: 'כמות', label: 'כמות'},
                                            {key: 'צורך', label: 'צורך'},
                                            {key: 'הערה', label: 'הערה'},
                                            {key: 'נקרא', label: 'נקרא'}
                                        ].map(({key, label}) => (
                                            <th key={key} className="px-3 py-2 text-right">
                                                <div className="flex items-center justify-end gap-1">
                                                    <div className="relative">
                                                        <button
                                                            onClick={() => setActiveFilterColumn(activeFilterColumn === key ? null : key)}
                                                            className={`p-1 rounded hover:bg-gray-200 transition-colors ${
                                                                columnFilters[key] ? 'text-blue-600' : 'text-gray-400'
                                                            }`}
                                                            title="סינון"
                                                        >
                                                            <Filter className="w-3 h-3" />
                                                        </button>
                                                        {activeFilterColumn === key && (
                                                            <div className="absolute right-0 top-full mt-1 z-10 bg-white border rounded-lg shadow-lg p-2 min-w-[200px]">
                                                                <Input
                                                                    placeholder={`חפש ${label}...`}
                                                                    value={columnFilters[key]}
                                                                    onChange={(e) => setColumnFilters({...columnFilters, [key]: e.target.value})}
                                                                    className="text-right text-sm"
                                                                    autoFocus
                                                                />
                                                                {columnFilters[key] && (
                                                                    <button
                                                                        onClick={() => setColumnFilters({...columnFilters, [key]: ''})}
                                                                        className="text-xs text-red-600 hover:text-red-800 mt-1 w-full text-right"
                                                                    >
                                                                        נקה
                                                                    </button>
                                                                )}
                                                            </div>
                                                        )}
                                                    </div>
                                                    {key !== 'כמות' && (
                                                        <button
                                                            onClick={() => handleSort(key as keyof LogisticItem)}
                                                            className="p-1 rounded hover:bg-gray-200 transition-colors"
                                                            title="מיון"
                                                        >
                                                            {sortConfig.key === key ? (
                                                                sortConfig.direction === 'asc' ? (
                                                                    <ArrowUp className="w-3 h-3 text-blue-600" />
                                                                ) : (
                                                                    <ArrowDown className="w-3 h-3 text-blue-600" />
                                                                )
                                                            ) : (
                                                                <ArrowUpDown className="w-3 h-3 text-gray-400" />
                                                            )}
                                                        </button>
                                                    )}
                                                    <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                                                </div>
                                            </th>
                                        ))}
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {filteredAndSortedTableData.length === 0 ? (
                                        <tr>
                                            <td colSpan={8} className="text-center p-8 text-gray-500">
                                                לא נמצאו תוצאות התואמות לסינון
                                            </td>
                                        </tr>
                                    ) : (
                                        filteredAndSortedTableData.map((item, idx) => (
                                            <tr
                                                key={item.id || idx}
                                                className={`hover:bg-gray-50 cursor-pointer transition-colors ${
                                                    item.נקרא === 'כן' ? 'bg-red-50' : ''
                                                }`}
                                                onClick={() => handleCardClick(item)}
                                            >
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.תאריך}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.פלוגה}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.משתמש}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.פריט}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.כמות}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.צורך}</td>
                                                <td className="px-6 py-4 text-sm text-gray-900">{item.הערה || '-'}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm">
                                                    <span className={`px-2 py-1 rounded-full text-xs font-semibold ${
                                                        item.נקרא === 'כן' ? 'bg-red-100 text-red-800' : 'bg-gray-100 text-gray-800'
                                                    }`}>
                                                        {item.נקרא || 'לא'}
                                                    </span>
                                                </td>
                                            </tr>
                                        ))
                                    )}
                                </tbody>
                            </table>
                        )}
                    </div>
                </div>
            )}

            {/* Date items dialog (when clicking on date header) */}
            <Dialog open={open} onOpenChange={setOpen}>
                <DialogContent className="sm:max-w-4xl max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">פריטים לתאריך</DialogTitle>
                    </DialogHeader>
                    <div className="space-y-2">
                        {matchingDateRows.map((item, index) => (
                            <div key={index} className="border p-3 rounded bg-gray-50">
                                <div className="grid grid-cols-2 gap-2 text-sm">
                                    <div><span className="font-semibold">פריט:</span> {item.פריט}</div>
                                    <div><span className="font-semibold">כמות:</span> {item.כמות}</div>
                                    <div><span className="font-semibold">צורך:</span> {item.צורך}</div>
                                    <div><span className="font-semibold">פלוגה:</span> {item.פלוגה}</div>
                                    {item.הערה && (
                                        <div className="col-span-2"><span className="font-semibold">הערה:</span> {item.הערה}</div>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                </DialogContent>
            </Dialog>

            {/* Card detail modal */}
            <Dialog open={cardDetailModalOpen} onOpenChange={setCardDetailModalOpen}>
                <DialogContent className="sm:max-w-2xl" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">פרטי דרישה</DialogTitle>
                    </DialogHeader>
                    {selectedCardItem && (
                        <div className="space-y-4 py-4">
                            <div className="grid grid-cols-2 gap-4 text-right">
                                <div>
                                    <span className="font-semibold text-gray-600">תאריך:</span>
                                    <p className="text-gray-900">{selectedCardItem.תאריך}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">פלוגה:</span>
                                    <p className="text-gray-900">{selectedCardItem.פלוגה}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">משתמש:</span>
                                    <p className="text-gray-900">{selectedCardItem.משתמש}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">פריט:</span>
                                    <p className="text-gray-900 font-medium">{selectedCardItem.פריט}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">כמות:</span>
                                    <p className="text-gray-900">{selectedCardItem.כמות}</p>
                                </div>
                                <div>
                                    <span className="font-semibold text-gray-600">צורך:</span>
                                    <p className="text-gray-900">{selectedCardItem.צורך}</p>
                                </div>
                                {selectedCardItem.מקט && (
                                    <div>
                                        <span className="font-semibold text-gray-600">מקט:</span>
                                        <p className="text-gray-900">{selectedCardItem.מקט}</p>
                                    </div>
                                )}
                                {selectedCardItem.הערה && (
                                    <div className="col-span-2">
                                        <span className="font-semibold text-gray-600">הערה:</span>
                                        <p className="text-gray-900">{selectedCardItem.הערה}</p>
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                    <DialogFooter className="flex gap-2 justify-center">
                        {permissions['logistic'] && (
                            <>
                                <Button
                                    onClick={handleToggleCardReadStatus}
                                    variant="outline"
                                    className="bg-yellow-500 hover:bg-yellow-600 text-white"
                                >
                                    סמן כ{selectedCardItem?.נקרא === 'כן' ? 'לא נקרא' : 'נקרא'}
                                </Button>
                                <Button
                                    onClick={handleToggleCardStatus}
                                    variant="outline"
                                    className="bg-blue-500 hover:bg-blue-600 text-white"
                                >
                                    העבר ל{selectedCardItem?.סטטוס === 'הזמנה' ? 'התעצמות' : 'הזמנה'}
                                </Button>
                                <Button
                                    onClick={handleDeleteCardItem}
                                    variant="destructive"
                                >
                                    מחק
                                </Button>
                            </>
                        )}
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            {/* Signature dialog (editable form for signing demands) */}
            <Dialog open={signatureDialogOpen} onOpenChange={setSignatureDialogOpen}>
                <DialogContent className="sm:max-w-md max-h-[80vh] overflow-y-auto" dir="rtl">
                    <DialogHeader>
                        <DialogTitle className="text-right">טופס החתמה</DialogTitle>
                    </DialogHeader>

                    <div className="space-y-4 py-4">
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
                                            if (!selectedOption) {
                                                newItems[index].פריט = '';
                                                setItems(newItems);
                                                return;
                                            }
                                            newItems[index].פריט = selectedOption.value;
                                            setItems(newItems);
                                        }}
                                        onCreateOption={(inputValue) => {
                                            const newItems = [...items];
                                            newItems[index].פריט = inputValue;
                                            setItems(newItems);
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
                                                primary: '#3b82f6',
                                                primary25: '#eff6ff'
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
                                onEnd={saveSignature}
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
        </div>
    );
};

export default LogisticDemands;
