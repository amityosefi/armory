import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { TableIcon, ArrowUpDown, ArrowUp, ArrowDown, Filter, Download } from 'lucide-react';
import * as XLSX from '@e965/xlsx';
import { useAuthStore } from '@/stores/useAuthStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface BinuyFormProps {
    activePermission: string | undefined;
}

interface FormData {
    מיקום: string;
    סוג_תקלה: string;
    פירוט_התקלה: string;
    רמת_דחיפות: string;
    הערה?: string;
}

interface BinuyData {
    id: number;
    מיקום: string;
    סוג_תקלה: string;
    פירוט_התקלה: string;
    רמת_דחיפות: string;
    הערה?: string | null;
    פלוגה: string;
    סטטוס?: string | null;
    משתמש?: string | null;
    created_at: string;
}

const Binuy: React.FC<BinuyFormProps> = ({ activePermission }) => {
    const permissions = useAuthStore((state) => state.permissions);
    const isA15Admin = permissions['a15'];
    
    const [formData, setFormData] = useState<FormData>({
        מיקום: '',
        סוג_תקלה: '',
        פירוט_התקלה: '',
        רמת_דחיפות: '',
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
    const [binuyData, setBinuyData] = useState<BinuyData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
    const [sortConfig, setSortConfig] = useState<{key: keyof BinuyData | null, direction: 'asc' | 'desc' | null}>({key: null, direction: null});
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({
        מיקום: '',
        סוג_תקלה: '',
        פירוט_התקלה: '',
        רמת_דחיפות: '',
        הערה: '',
        פלוגה: '',
        סטטוס: '',
        משתמש: '',
        created_at: ''
    });
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const [editingCell, setEditingCell] = useState<{rowId: number, field: string} | null>(null);
    const [editValue, setEditValue] = useState<string>('');
    const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({
        מיקום: 120,
        סוג_תקלה: 200,
        פירוט_התקלה: 200,
        רמת_דחיפות: 120,
        פלוגה: 120,
        סטטוס: 120,
        הערה: 150,
        משתמש: 120,
        created_at: 180
    });
    const [resizingColumn, setResizingColumn] = useState<string | null>(null);
    const [startX, setStartX] = useState<number>(0);
    const [startWidth, setStartWidth] = useState<number>(0);
    const [showForm, setShowForm] = useState<boolean>(!isA15Admin);

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '';
        // Parse ISO string directly: "2024-02-10T20:48:00.000Z"
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-');
        const [hours, minutes, seconds] = timePart.split(':');
        const sec = seconds.split('.')[0]; // Remove milliseconds
        return `${day}-${month}-${year} ${hours}:${minutes}:${sec}`;
    };

    const formatTimeWithoutSeconds = (timeString: string) => {
        if (!timeString) return '';
        // If time includes seconds (HH:MM:SS), remove them
        const parts = timeString.split(':');
        if (parts.length >= 2) {
            return `${parts[0]}:${parts[1]}`;
        }
        return timeString;
    };

    const handleSort = (key: keyof BinuyData) => {
        let direction: 'asc' | 'desc' | null = 'asc';
        if (sortConfig.key === key) {
            if (sortConfig.direction === 'asc') {
                direction = 'desc';
            } else if (sortConfig.direction === 'desc') {
                direction = null;
            }
        }
        setSortConfig({ key: direction ? key : null, direction });
    };

    const filteredAndSortedData = useMemo(() => {
        let filtered = [...binuyData];

        // Apply filters
        Object.keys(columnFilters).forEach(key => {
            const filterValue = columnFilters[key].toLowerCase();
            if (filterValue) {
                filtered = filtered.filter(item => {
                    const value = key === 'created_at' 
                        ? formatDateTime(item[key as keyof BinuyData] as string)
                        : String(item[key as keyof BinuyData] || '');
                    return value.toLowerCase().includes(filterValue);
                });
            }
        });

        // Apply sorting
        if (sortConfig.key && sortConfig.direction) {
            filtered.sort((a, b) => {
                const aVal = a[sortConfig.key!];
                const bVal = b[sortConfig.key!];
                
                if (aVal === null || aVal === undefined) return 1;
                if (bVal === null || bVal === undefined) return -1;
                
                if (typeof aVal === 'number' && typeof bVal === 'number') {
                    return sortConfig.direction === 'asc' ? aVal - bVal : bVal - aVal;
                }
                
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
    }, [binuyData, columnFilters, sortConfig]);

    const handleCellEdit = (rowId: number, field: string, currentValue: any) => {
        if (!isA15Admin || field === 'created_at') return;
        setEditingCell({ rowId, field });
        setEditValue(String(currentValue || ''));
    };

    const handleCellSave = async (rowId: number, field: string) => {
        try {
            const currentItem = binuyData.find(item => item.id === rowId);
            if (!currentItem) return;

            const updateData: any = {};
            updateData[field] = editValue;

            // Check if value has actually changed
            const oldValue = String(currentItem[field as keyof BinuyData] || '');
            const newValue = String(updateData[field]);
            

            if (oldValue === newValue) {
                setEditingCell(null);
                setEditValue('');
                return;
            }

            const { error } = await supabase
                .from('a15_binuy')
                .update(updateData)
                .eq('id', rowId);

            if (error) throw error;

            // Update local state
            setBinuyData(prev => prev.map(item => 
                item.id === rowId ? { ...item, [field]: updateData[field] } : item
            ));

            setEditingCell(null);
            setEditValue('');
            setStatusMessage({ text: 'עודכן בהצלחה', isSuccess: true });
        } catch (error: any) {
            console.error('Error updating cell:', error);
            setStatusMessage({ text: `שגיאה בעדכון: ${error.message}`, isSuccess: false });
        }
    };

    const handleCellCancel = () => {
        setEditingCell(null);
        setEditValue('');
    };

    const handleMouseDown = (e: React.MouseEvent, columnKey: string) => {
        setResizingColumn(columnKey);
        setStartX(e.clientX);
        setStartWidth(columnWidths[columnKey]);
    };

    useEffect(() => {
        const handleMouseMove = (e: MouseEvent) => {
            if (resizingColumn) {
                const diff = e.clientX - startX;
                const newWidth = Math.max(80, startWidth + diff);
                setColumnWidths(prev => ({
                    ...prev,
                    [resizingColumn]: newWidth
                }));
            }
        };

        const handleMouseUp = () => {
            setResizingColumn(null);
        };

        if (resizingColumn) {
            document.addEventListener('mousemove', handleMouseMove);
            document.addEventListener('mouseup', handleMouseUp);
        }

        return () => {
            document.removeEventListener('mousemove', handleMouseMove);
            document.removeEventListener('mouseup', handleMouseUp);
        };
    }, [resizingColumn, startX, startWidth]);

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const handleExportToExcel = () => {
        const exportData = filteredAndSortedData.map(item => ({
            'מיקום': item.מיקום,
            'סוג תקלה': item.סוג_תקלה,
            'פירוט התקלה': item.פירוט_התקלה,
            'רמת דחיפות': item.רמת_דחיפות,
            'פלוגה': item.פלוגה,
            'סטטוס': item.סטטוס || '',
            'הערה': item.הערה || '',
            'משתמש': item.משתמש || '',
            'תאריך יצירה': formatDateTime(item.created_at)
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'פערי בינוי');
        XLSX.writeFile(wb, `פערי_בינוי_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    const מיקוםOptions = ['מטאור 3', 'נגב 88', 'נחל עוז', 'פגה'];
    const סוגתקלהOptions = ['חשמל', 'אינסטלציה', 'מיזוג אוויר', 'שיפוץ כללי', 'תשתיות'];
    const רמתדחיפותOptions = ['נמוכה', 'בינונית', 'גבוהה'];

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            let query = supabase
                .from('a15_binuy')
                .select('*');
            
            // If user has a15 permission, fetch all data. Otherwise filter by activePermission
            if (!isA15Admin && activePermission) {
                query = query.eq('פלוגה', activePermission);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setBinuyData((data as unknown as BinuyData[]) || []);
        } catch (error) {
            console.error('Error fetching data:', error);
        } finally {
            setIsLoadingData(false);
        }
    };

    useEffect(() => {
        fetchData();
    }, [activePermission]);

    const clearForm = () => {
        setFormData({
            מיקום: '',
            סוג_תקלה: '',
            פירוט_התקלה: '',
            רמת_דחיפות: '',
            הערה: ''
        });
    };

    const isFormValid = () => {
        return (
            formData.מיקום &&
            formData.סוג_תקלה &&
            formData.פירוט_התקלה &&
            formData.רמת_דחיפות
        );
    };

    const handleSubmit = async () => {
        if (!isFormValid()) {
            setStatusMessage({ text: 'נא למלא את כל השדות החובה', isSuccess: false });
            return;
        }

        setIsSubmitting(true);
        setStatusMessage({ text: '', isSuccess: false });

        try {
            const { data, error } = await supabase.from('a15_binuy').insert({
                מיקום: formData.מיקום,
                סוג_תקלה: formData.סוג_תקלה,
                פירוט_התקלה: formData.פירוט_התקלה,
                רמת_דחיפות: formData.רמת_דחיפות,
                הערה: '',
                פלוגה: activePermission || '',
                created_at: new Date().toISOString(),
                משתמש: permissions['name']
            });

            if (error) {
                throw error;
            }

            setStatusMessage({ text: 'הטופס נשלח בהצלחה!', isSuccess: true });
            clearForm();
            fetchData();
        } catch (error: any) {
            console.error('Error:', error);
            setStatusMessage({ text: `שגיאה בשליחת הטופס: ${error.message}`, isSuccess: false });
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <div className="bg-white p-10 rounded-lg shadow-lg space-y-4" dir="rtl">
            <h3 className="text-xl font-bold text-right mb-4 text-blue-700">פערי בינוי</h3>

            {/* Status Message */}
            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.isSuccess}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ text: '', isSuccess: false })}
                />
            )}

            {/* Toggle Form Button for A15 Admins */}
            {isA15Admin && (
                <div className="flex justify-center mb-4">
                    <Button
                        onClick={() => setShowForm(!showForm)}
                        variant="outline"
                        className="flex items-center gap-2"
                    >
                        {showForm ? 'הסתר טופס' : 'הצג טופס'}
                    </Button>
                </div>
            )}

            {/* Form */}
            {showForm && (
            <div className="max-w-sm mx-auto space-y-4">
            {/* מיקום */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    מיקום <span className="text-red-500">*</span>
                </label>
                <Select value={formData.מיקום} onValueChange={(value) => handleInputChange('מיקום', value)}>
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר מיקום" />
                    </SelectTrigger>
                    <SelectContent>
                        {מיקוםOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* סוג תקלה */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    סוג תקלה <span className="text-red-500">*</span>
                </label>
                <Select 
                    value={סוגתקלהOptions.includes(formData.סוג_תקלה) ? formData.סוג_תקלה : 'other'} 
                    onValueChange={(value) => {
                        if (value === 'other') {
                            handleInputChange('סוג_תקלה', '');
                        } else {
                            handleInputChange('סוג_תקלה', value);
                        }
                    }}
                >
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר סוג תקלה" />
                    </SelectTrigger>
                    <SelectContent>
                        {סוגתקלהOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                        <SelectItem value="other">אחר (טקסט חופשי)</SelectItem>
                    </SelectContent>
                </Select>
                {!סוגתקלהOptions.includes(formData.סוג_תקלה) && (
                    <Input
                        type="text"
                        placeholder="הכנס סוג תקלה"
                        value={formData.סוג_תקלה}
                        onChange={(e) => handleInputChange('סוג_תקלה', e.target.value)}
                        className="text-right mt-2"
                        dir="rtl"
                    />
                )}
            </div>

            {/* פירוט התקלה */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    פירוט התקלה <span className="text-red-500">*</span>
                </label>
                <Input
                    type="text"
                    placeholder="פרט את התקלה"
                    value={formData.פירוט_התקלה}
                    onChange={(e) => handleInputChange('פירוט_התקלה', e.target.value)}
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* רמת דחיפות */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    רמת דחיפות <span className="text-red-500">*</span>
                </label>
                <Select value={formData.רמת_דחיפות} onValueChange={(value) => handleInputChange('רמת_דחיפות', value)}>
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר רמת דחיפות" />
                    </SelectTrigger>
                    <SelectContent>
                        {רמתדחיפותOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

            {/* Action Buttons */}
            <div className="flex gap-4 justify-center pt-4">
                <Button
                    onClick={handleSubmit}
                    disabled={isSubmitting || !isFormValid()}
                    className="bg-blue-600 hover:bg-blue-700 text-white px-8 py-3 disabled:opacity-50 disabled:cursor-not-allowed"
                >
                    {isSubmitting ? 'שולח...' : '📤 שלח'}
                </Button>
                <Button
                    onClick={clearForm}
                    disabled={isSubmitting}
                    className="bg-gray-600 hover:bg-gray-700 text-white px-8 py-3"
                >
                    🗑️ נקה טופס
                </Button>
            </div>
            </div>
            )}

            {/* Data Display Section */}
            <div className="mt-8 pt-8 border-t">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        {isA15Admin && (
                            <Button
                                onClick={handleExportToExcel}
                                variant="outline"
                                size="sm"
                                className="flex items-center gap-2"
                            >
                                <Download className="w-4 h-4" />
                                ייצוא ל-Excel
                            </Button>
                        )}
                    </div>
                </div>

                {isLoadingData ? (
                    <div className="text-center py-8 text-gray-500">טוען נתונים...</div>
                ) : binuyData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">אין נתונים להצגה</div>
                ) : (isA15Admin || viewMode === 'table') ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        {key: 'מיקום', label: 'מיקום'},
                                        {key: 'סוג_תקלה', label: 'סוג תקלה'},
                                        {key: 'פירוט_התקלה', label: 'פירוט התקלה'},
                                        {key: 'רמת_דחיפות', label: 'רמת דחיפות'},
                                        {key: 'פלוגה', label: 'פלוגה'},
                                        {key: 'סטטוס', label: 'סטטוס'},
                                        {key: 'הערה', label: 'הערה'},
                                        {key: 'משתמש', label: 'משתמש'},
                                        {key: 'created_at', label: 'תאריך יצירה'}
                                    ].map(({key, label}) => (
                                        <th key={key} className="px-3 py-2 relative" style={{width: columnWidths[key], minWidth: columnWidths[key]}}>
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                                                <button
                                                    onClick={() => handleSort(key as keyof BinuyData)}
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
                                            </div>
                                            <div
                                                className="absolute right-0 top-0 bottom-0 w-1 cursor-col-resize hover:bg-blue-500 active:bg-blue-600"
                                                onMouseDown={(e) => handleMouseDown(e, key)}
                                                style={{userSelect: 'none'}}
                                            />
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedData.map((item, index) => {
                                    const getRowBackgroundColor = () => {
                                        if (item.סטטוס === 'טופל') return 'bg-green-100 hover:bg-green-200';
                                        if (item.סטטוס === 'בטיפול') return 'bg-yellow-100 hover:bg-green-200';
                                        if (item.סטטוס === 'בוטל') return 'bg-red-100 hover:bg-red-200';
                                        return index % 2 === 1 ? 'bg-blue-50 hover:bg-gray-50' : 'hover:bg-gray-50';
                                    };
                                    
                                    return (
                                    <tr key={item.id} className={getRowBackgroundColor()}>
                                        {/* מיקום */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'מיקום' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'מיקום')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'מיקום');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'מיקום', item.מיקום)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.מיקום}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* סוג תקלה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'סוג_תקלה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'סוג_תקלה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'סוג_תקלה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'סוג_תקלה', item.סוג_תקלה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.סוג_תקלה}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* פירוט התקלה */}
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'פירוט_התקלה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'פירוט_התקלה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'פירוט_התקלה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'פירוט_התקלה', item.פירוט_התקלה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.פירוט_התקלה}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* רמת דחיפות */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'רמת_דחיפות' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'רמת_דחיפות')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'רמת_דחיפות');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'רמת_דחיפות', item.רמת_דחיפות)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.רמת_דחיפות}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* פלוגה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'פלוגה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'פלוגה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'פלוגה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'פלוגה', item.פלוגה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.פלוגה}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* סטטוס */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin ? (
                                                <Select
                                                    value={item.סטטוס || 'none'}
                                                    onValueChange={async (value) => {
                                                        try {
                                                            const statusValue = value === 'none' ? null : value;
                                                            const { error } = await supabase
                                                                .from('a15_binuy')
                                                                .update({ סטטוס: statusValue })
                                                                .eq('id', item.id);

                                                            if (error) throw error;

                                                            setBinuyData(prev => prev.map(i => 
                                                                i.id === item.id ? { ...i, סטטוס: statusValue } : i
                                                            ));
                                                            setStatusMessage({ text: 'סטטוס עודכן בהצלחה', isSuccess: true });
                                                        } catch (error: any) {
                                                            setStatusMessage({ text: `שגיאה בעדכון סטטוס: ${error.message}`, isSuccess: false });
                                                        }
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue placeholder="בחר סטטוס" />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        <SelectItem value="none">ללא סטטוס</SelectItem>
                                                        <SelectItem value="טופל">טופל</SelectItem>
                                                        <SelectItem value="בטיפול">בטיפול</SelectItem>
                                                        <SelectItem value="בוטל">בוטל</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span>{item.סטטוס || '-'}</span>
                                            )}
                                        </td>
                                        
                                        {/* הערה */}
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'הערה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'הערה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'הערה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'הערה', item.הערה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.הערה || '-'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* משתמש */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'משתמש' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'משתמש')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'משתמש');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'משתמש', item.משתמש)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.משתמש || '-'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* תאריך יצירה - not editable */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(item.created_at)}
                                        </td>
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {binuyData.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">מיקום:</span>
                                        <div className="mt-1">{item.מיקום}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">סוג תקלה:</span>
                                        <div className="mt-1">{item.סוג_תקלה}</div>
                                    </div>
                                    <div className="text-right col-span-2">
                                        <span className="font-semibold text-blue-700">פירוט התקלה:</span>
                                        <div className="mt-1">{item.פירוט_התקלה}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">רמת דחיפות:</span>
                                        <div className="mt-1">{item.רמת_דחיפות}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">פלוגה:</span>
                                        <div className="mt-1">{item.פלוגה}</div>
                                    </div>
                                    {item.הערה && (
                                        <div className="text-right col-span-2">
                                            <span className="font-semibold text-blue-700">הערה:</span>
                                            <div className="mt-1">{item.הערה}</div>
                                        </div>
                                    )}
                                    <div className="text-right col-span-2 pt-2 border-t mt-2">
                                        <span className="font-semibold text-gray-600">תאריך יצירה:</span>
                                        <div className="mt-1 text-gray-600">{formatDateTime(item.created_at)}</div>
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
};

export default Binuy;
