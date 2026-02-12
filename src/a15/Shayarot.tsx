import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { TableIcon, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Filter } from 'lucide-react';
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
    תאריך_חילוף: string;
    שעת_התייצבות: string;
    כמות_חיילים_נכנסים: string;
    כמות_חיילים_יוצאים: string;
    שם_מפקד_אחראי: string;
    מספר_טלפון_מפקד: string;
    מסלול_נסיעה: string;
}

interface ShayarotData {
    id: number;
    תאריך_חילוף: string;
    שעת_התייצבות: string;
    כמות_חיילים_נכנסים: number;
    כמות_חיילים_יוצאים: number;
    שם_מפקד_אחראי: string;
    מספר_טלפון_מפקד: string;
    פלוגה: string;
    סטטוס?: string | null;
    משתמש?: string | null;
    מסלול_נסיעה?: string | null;
    created_at: string;
}

const Shayarot: React.FC<BinuyFormProps> = ({ activePermission }) => {
    const permissions = useAuthStore((state) => state.permissions);
    const isA15Admin = permissions['a15'] === true;
    
    const [formData, setFormData] = useState<FormData>({
        תאריך_חילוף: '',
        שעת_התייצבות: '08:00',
        כמות_חיילים_נכנסים: '',
        כמות_חיילים_יוצאים: '',
        שם_מפקד_אחראי: '',
        מספר_טלפון_מפקד: '',
        מסלול_נסיעה: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
    const [shayarotData, setShayarotData] = useState<ShayarotData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
    const [sortConfig, setSortConfig] = useState<{key: keyof ShayarotData | null, direction: 'asc' | 'desc' | null}>({key: null, direction: null});
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({
        תאריך_חילוף: '',
        שעת_התייצבות: '',
        כמות_חיילים_נכנסים: '',
        כמות_חיילים_יוצאים: '',
        שם_מפקד_אחראי: '',
        מספר_טלפון_מפקד: '',
        פלוגה: '',
        סטטוס: '',
        משתמש: '',
        מסלול_נסיעה: '',
        created_at: ''
    });
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const [editingCell, setEditingCell] = useState<{rowId: number, field: string} | null>(null);
    const [editValue, setEditValue] = useState<string>('');

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

    const handleSort = (key: keyof ShayarotData) => {
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
        let filtered = [...shayarotData];

        // Apply filters
        Object.keys(columnFilters).forEach(key => {
            const filterValue = columnFilters[key].toLowerCase();
            if (filterValue) {
                filtered = filtered.filter(item => {
                    const value = key === 'created_at' 
                        ? formatDateTime(item[key as keyof ShayarotData] as string)
                        : String(item[key as keyof ShayarotData] || '');
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
    }, [shayarotData, columnFilters, sortConfig]);

    const handleCellEdit = (rowId: number, field: string, currentValue: any) => {
        if (!isA15Admin || field === 'created_at') return;
        setEditingCell({ rowId, field });
        setEditValue(String(currentValue || ''));
    };

    const handleCellSave = async (rowId: number, field: string) => {
        try {
            const currentItem = shayarotData.find(item => item.id === rowId);
            if (!currentItem) return;

            const updateData: any = {};
            
            // Convert value based on field type
            if (field === 'כמות_חיילים_נכנסים' || field === 'כמות_חיילים_יוצאים') {
                updateData[field] = parseInt(editValue) || 0;
            } else {
                updateData[field] = editValue;
            }

            // Check if value has actually changed
            const oldValue = String(currentItem[field as keyof ShayarotData] || '');
            const newValue = String(updateData[field]);
            

            if (oldValue === newValue) {
                setEditingCell(null);
                setEditValue('');
                return;
            }

            const { error } = await supabase
                .from('a15_shayarot')
                .update(updateData)
                .eq('id', rowId);

            if (error) throw error;

            // Update local state
            setShayarotData(prev => prev.map(item => 
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

    const handleInputChange = (field: keyof FormData, value: string) => {
        setFormData(prev => ({ ...prev, [field]: value }));
    };

    const getTodayDateISO = () => {
        return new Date().toISOString().split('T')[0];
    };

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            let query = supabase
                .from('a15_shayarot')
                .select('*');
            
            // If user has a15 permission, fetch all data. Otherwise filter by activePermission
            if (!isA15Admin && activePermission) {
                query = query.eq('פלוגה', activePermission);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setShayarotData((data as unknown as ShayarotData[]) || []);
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
            תאריך_חילוף: '',
            שעת_התייצבות: '08:00',
            כמות_חיילים_נכנסים: '',
            כמות_חיילים_יוצאים: '',
            שם_מפקד_אחראי: '',
            מספר_טלפון_מפקד: '',
            מסלול_נסיעה: ''
        });
    };

    const isFormValid = () => {
        return (
            formData.תאריך_חילוף &&
            formData.שעת_התייצבות &&
            formData.כמות_חיילים_נכנסים &&
            formData.כמות_חיילים_יוצאים &&
            formData.שם_מפקד_אחראי &&
            formData.מספר_טלפון_מפקד &&
            formData.מסלול_נסיעה
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
            const { data, error } = await supabase.from('a15_shayarot').insert({
                תאריך_חילוף: formData.תאריך_חילוף,
                שעת_התייצבות: formData.שעת_התייצבות,
                כמות_חיילים_נכנסים: parseInt(formData.כמות_חיילים_נכנסים),
                כמות_חיילים_יוצאים: parseInt(formData.כמות_חיילים_יוצאים),
                שם_מפקד_אחראי: formData.שם_מפקד_אחראי,
                מספר_טלפון_מפקד: formData.מספר_טלפון_מפקד,
                מסלול_נסיעה: formData.מסלול_נסיעה,
                פלוגה: activePermission || '',
                created_at: new Date().toLocaleString('he-IL'),
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
            <h3 className="text-xl font-bold text-right mb-4 text-blue-700">שיירות כ״א</h3>

            {/* Status Message */}
            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.isSuccess}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ text: '', isSuccess: false })}
                />
            )}

            {/* Form */}
            <div className="max-w-sm mx-auto">
            {/* תאריך חילוף */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    תאריך חילוף <span className="text-red-500">*</span>
                </label>
                <Input
                    type="date"
                    value={formData.תאריך_חילוף}
                    onChange={(e) => handleInputChange('תאריך_חילוף', e.target.value)}
                    min={getTodayDateISO()}
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* שעת התייצבות - כוח נכנס */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    שעת התייצבות - כוח נכנס <span className="text-red-500">*</span>
                </label>
                <Input
                    type="time"
                    value={formData.שעת_התייצבות}
                    onChange={(e) => handleInputChange('שעת_התייצבות', e.target.value)}
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* כמות חיילים נכנסים למוצב */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    כמות חיילים נכנסים למוצב <span className="text-red-500">*</span>
                </label>
                <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="הכנס מספר"
                    value={formData.כמות_חיילים_נכנסים}
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleInputChange('כמות_חיילים_נכנסים', value);
                    }}
                    min="0"
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* כמות חיילים שיוצאים הביתה */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    כמות חיילים שיוצאים הביתה <span className="text-red-500">*</span>
                </label>
                <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="הכנס מספר"
                    value={formData.כמות_חיילים_יוצאים}
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleInputChange('כמות_חיילים_יוצאים', value);
                    }}
                    min="0"
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* שם מפקד אחראי - כוח נכנס */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    שם מפקד אחראי - כוח נכנס <span className="text-red-500">*</span>
                </label>
                <Input
                    type="text"
                    placeholder="שם מפקד"
                    value={formData.שם_מפקד_אחראי}
                    onChange={(e) => handleInputChange('שם_מפקד_אחראי', e.target.value)}
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* מס' טלפון- מפקד אחראי */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    מס' טלפון - מפקד אחראי <span className="text-red-500">*</span>
                </label>
                <Input
                    type="tel"
                    inputMode="numeric"
                    placeholder="מספר פלפון"
                    value={formData.מספר_טלפון_מפקד}
                    onChange={(e) => {
                        const value = e.target.value.replace(/[^0-9]/g, '');
                        handleInputChange('מספר_טלפון_מפקד', value);
                    }}
                    className="text-right"
                    dir="rtl"
                />
            </div>

            {/* מסלול נסיעה */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    מסלול נסיעה <span className="text-red-500">*</span>
                </label>
                <Input
                    type="text"
                    placeholder="מסלול נסיעה"
                    value={formData.מסלול_נסיעה}
                    onChange={(e) => handleInputChange('מסלול_נסיעה', e.target.value)}
                    className="text-right"
                    dir="rtl"
                />
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

            {/* Data Display Section */}
            <div className="mt-8 pt-8 border-t">
                <div className="flex justify-between items-center mb-4">
                    <div className="flex gap-2">
                        <Button
                            onClick={() => setViewMode('card')}
                            variant={viewMode === 'card' ? 'default' : 'outline'}
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <LayoutGrid className="w-4 h-4" />
                        </Button>
                        <Button
                            onClick={() => setViewMode('table')}
                            variant={viewMode === 'table' ? 'default' : 'outline'}
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <TableIcon className="w-4 h-4" />
                        </Button>
                    </div>
                </div>

                {isLoadingData ? (
                    <div className="text-center py-8 text-gray-500">טוען נתונים...</div>
                ) : shayarotData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">אין נתונים להצגה</div>
                ) : (isA15Admin || viewMode === 'table') ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        {key: 'תאריך_חילוף', label: 'תאריך חילוף'},
                                        {key: 'שעת_התייצבות', label: 'שעת התייצבות'},
                                        {key: 'כמות_חיילים_נכנסים', label: 'חיילים נכנסים'},
                                        {key: 'כמות_חיילים_יוצאים', label: 'חיילים יוצאים'},
                                        {key: 'שם_מפקד_אחראי', label: 'מפקד אחראי'},
                                        {key: 'מספר_טלפון_מפקד', label: 'טלפון'},
                                        {key: 'מסלול_נסיעה', label: 'מסלול נסיעה'},
                                        {key: 'פלוגה', label: 'פלוגה'},
                                        {key: 'סטטוס', label: 'סטטוס'},
                                        {key: 'משתמש', label: 'משתמש'},
                                        {key: 'created_at', label: 'תאריך יצירה'}
                                    ].map(({key, label}) => (
                                        <th key={key} className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                                                <button
                                                    onClick={() => handleSort(key as keyof ShayarotData)}
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
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedData.map((item, index) => {
                                    const getRowBackgroundColor = () => {
                                        if (item.סטטוס === 'בוצע') return 'bg-green-100 hover:bg-green-200';
                                        if (item.סטטוס === 'מאושר') return 'bg-yellow-100 hover:bg-yellow-200';
                                        if (item.סטטוס === 'בוטל') return 'bg-red-100 hover:bg-red-200';
                                        return index % 2 === 1 ? 'bg-blue-50 hover:bg-gray-50' : 'hover:bg-gray-50';
                                    };
                                    
                                    return (
                                    <tr key={item.id} className={getRowBackgroundColor()}>
                                        {/* תאריך חילוף */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'תאריך_חילוף' ? (
                                                <Input
                                                    type="date"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'תאריך_חילוף')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'תאריך_חילוף');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'תאריך_חילוף', item.תאריך_חילוף)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.תאריך_חילוף}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* שעת התייצבות */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'שעת_התייצבות' ? (
                                                <Input
                                                    type="time"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'שעת_התייצבות')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'שעת_התייצבות');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'שעת_התייצבות', item.שעת_התייצבות)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {formatTimeWithoutSeconds(item.שעת_התייצבות)}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* כמות חיילים נכנסים */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'כמות_חיילים_נכנסים' ? (
                                                <Input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'כמות_חיילים_נכנסים')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'כמות_חיילים_נכנסים');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'כמות_חיילים_נכנסים', item.כמות_חיילים_נכנסים)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.כמות_חיילים_נכנסים}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* כמות חיילים יוצאים */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'כמות_חיילים_יוצאים' ? (
                                                <Input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'כמות_חיילים_יוצאים')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'כמות_חיילים_יוצאים');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'כמות_חיילים_יוצאים', item.כמות_חיילים_יוצאים)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.כמות_חיילים_יוצאים}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* שם מפקד אחראי */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'שם_מפקד_אחראי' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'שם_מפקד_אחראי')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'שם_מפקד_אחראי');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'שם_מפקד_אחראי', item.שם_מפקד_אחראי)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.שם_מפקד_אחראי}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* מספר טלפון מפקד */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'מספר_טלפון_מפקד' ? (
                                                <Input
                                                    type="tel"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'מספר_טלפון_מפקד')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'מספר_טלפון_מפקד');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'מספר_טלפון_מפקד', item.מספר_טלפון_מפקד)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.מספר_טלפון_מפקד}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* מסלול נסיעה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'מסלול_נסיעה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'מסלול_נסיעה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'מסלול_נסיעה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'מסלול_נסיעה', item.מסלול_נסיעה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.מסלול_נסיעה || '-'}
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
                                                                .from('a15_shayarot')
                                                                .update({ סטטוס: statusValue })
                                                                .eq('id', item.id);

                                                            if (error) throw error;

                                                            setShayarotData(prev => prev.map(i => 
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
                                                        <SelectItem value="בוצע">בוצע</SelectItem>
                                                        <SelectItem value="מאושר">מאושר</SelectItem>
                                                        <SelectItem value="בוטל">בוטל</SelectItem>
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span>{item.סטטוס || '-'}</span>
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
                        {shayarotData.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">תאריך חילוף:</span>
                                        <div className="mt-1">{item.תאריך_חילוף}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">שעת התייצבות:</span>
                                        <div className="mt-1">{formatTimeWithoutSeconds(item.שעת_התייצבות)}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">חיילים נכנסים:</span>
                                        <div className="mt-1">{item.כמות_חיילים_נכנסים}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">חיילים יוצאים:</span>
                                        <div className="mt-1">{item.כמות_חיילים_יוצאים}</div>
                                    </div>
                                    <div className="text-right col-span-2">
                                        <span className="font-semibold text-blue-700">מפקד אחראי:</span>
                                        <div className="mt-1">{item.שם_מפקד_אחראי}</div>
                                    </div>
                                    <div className="text-right col-span-2">
                                        <span className="font-semibold text-blue-700">טלפון:</span>
                                        <div className="mt-1">{item.מספר_טלפון_מפקד}</div>
                                    </div>
                                    <div className="text-right col-span-2">
                                        <span className="font-semibold text-blue-700">מסלול נסיעה:</span>
                                        <div className="mt-1">{item.מסלול_נסיעה || '-'}</div>
                                    </div>
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

export default Shayarot;
