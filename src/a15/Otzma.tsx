import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { TableIcon, LayoutGrid, ArrowUpDown, ArrowUp, ArrowDown, Filter, Trash2 } from 'lucide-react';
import { useAuthStore } from '@/stores/useAuthStore';
import {
    Select,
    SelectContent,
    SelectItem,
    SelectTrigger,
    SelectValue,
} from '@/components/ui/select';

interface OtzmaFormProps {
    activePermission: string | undefined;
}

interface FormData {
    צ: string;
    אמצעי: string;
    סטטוס: string;
    הערות: string;
    פלוגה: string;
    מחלקה: string;
    סוג: string;
    מיקום: string;
    בעלות: string;
    סוג_דלק: string;
}

interface OtzmaData {
    id: number;
    צ: number;
    אמצעי: string;
    סטטוס: string;
    הערות?: string | null;
    פלוגה: string;
    מחלקה: string;
    סוג: string;
    מיקום: string;
    בעלות: string;
    סוג_דלק: string;
    משתמש?: string | null;
    created_at: string;
}

const Otzma: React.FC<OtzmaFormProps> = ({ activePermission }) => {
    const permissions = useAuthStore((state) => state.permissions);
    const isA15Admin = permissions['a15'] === true;
    
    const [formData, setFormData] = useState<FormData>({
        צ: '',
        אמצעי: '',
        סטטוס: '',
        הערות: '',
        פלוגה: '',
        מחלקה: '',
        סוג: '',
        מיקום: '',
        בעלות: '',
        סוג_דלק: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
    const [otzmaData, setOtzmaData] = useState<OtzmaData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
    const [sortConfig, setSortConfig] = useState<{key: keyof OtzmaData | null, direction: 'asc' | 'desc' | null}>({key: null, direction: null});
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({
        צ: '',
        אמצעי: '',
        סטטוס: '',
        הערות: '',
        פלוגה: '',
        מחלקה: '',
        סוג: '',
        מיקום: '',
        בעלות: '',
        סוג_דלק: '',
        משתמש: '',
        created_at: ''
    });
    const [activeFilterColumn, setActiveFilterColumn] = useState<string | null>(null);
    const [editingCell, setEditingCell] = useState<{rowId: number, field: string} | null>(null);
    const [editValue, setEditValue] = useState<string>('');

    const formatDateTime = (dateString: string) => {
        if (!dateString) return '';
        const [datePart, timePart] = dateString.split('T');
        const [year, month, day] = datePart.split('-');
        const [hours, minutes, seconds] = timePart.split(':');
        const sec = seconds.split('.')[0];
        return `${day}-${month}-${year} ${hours}:${minutes}:${sec}`;
    };

    const handleSort = (key: keyof OtzmaData) => {
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
        let filtered = [...otzmaData];

        Object.keys(columnFilters).forEach(key => {
            const filterValue = columnFilters[key].toLowerCase();
            if (filterValue) {
                filtered = filtered.filter(item => {
                    const value = key === 'created_at' 
                        ? formatDateTime(item[key as keyof OtzmaData] as string)
                        : String(item[key as keyof OtzmaData] || '');
                    return value.toLowerCase().includes(filterValue);
                });
            }
        });

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
    }, [otzmaData, columnFilters, sortConfig]);

    const handleCellEdit = (rowId: number, field: string, currentValue: any) => {
        if (!isA15Admin || field === 'created_at') return;
        setEditingCell({ rowId, field });
        setEditValue(String(currentValue || ''));
    };

    const handleCellSave = async (rowId: number, field: string) => {
        try {
            const currentItem = otzmaData.find(item => item.id === rowId);
            if (!currentItem) return;

            const updateData: any = {};
            updateData[field] = editValue;

            const oldValue = String(currentItem[field as keyof OtzmaData] || '');
            const newValue = String(updateData[field]);

            if (oldValue === newValue) {
                setEditingCell(null);
                setEditValue('');
                return;
            }

            const { error } = await supabase
                .from('a15_otzma')
                .update(updateData)
                .eq('id', rowId);

            if (error) throw error;

            setOtzmaData(prev => prev.map(item => 
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

    const פלוגהOptions = ['צק"פ א\'', 'צק"פ ב\'', 'צק"פ ג\'', 'אלון', 'מסייעת', 'מכלול', 'פלס"מ', 'חטיבה', 'חפ"ק סמג"ד', 'שיריון'];
    const סוגOptions = ['רק"מ', 'רכב חום', 'יר"ם', 'שכור', 'אושקוש', 'ריו משא קצרה', 'אמצעי'];
    const מיקוםOptions = ['נחל עוז', 'מטאור 3', 'נגב 88', 'פגה', 'עין זיתים', 'מוסך', 'דימה 2', 'מעבר קרני'];
    const סטטוסOptions = ['תקין', 'לא תקין'];
    const סוגדלקOptions = ['סולר', 'בנזין'];

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            let query = supabase
                .from('a15_otzma')
                .select('*');
            
            if (!isA15Admin && activePermission) {
                query = query.eq('פלוגה', activePermission);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setOtzmaData((data as unknown as OtzmaData[]) || []);
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
            צ: '',
            אמצעי: '',
            סטטוס: '',
            הערות: '',
            פלוגה: '',
            מחלקה: '',
            סוג: '',
            מיקום: '',
            בעלות: '',
            סוג_דלק: ''
        });
    };

    const isFormValid = () => {
        return (
            formData.צ &&
            formData.אמצעי &&
            formData.סטטוס &&
            formData.פלוגה &&
            formData.מחלקה &&
            formData.סוג &&
            formData.מיקום &&
            formData.בעלות &&
            formData.סוג_דלק
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
            const צ = parseInt(formData.צ);

            const { data, error } = await supabase.from('a15_otzma').insert({
                צ: צ,
                אמצעי: formData.אמצעי,
                סטטוס: formData.סטטוס,
                הערות: formData.הערות || null,
                פלוגה: formData.פלוגה,
                מחלקה: formData.מחלקה,
                סוג: formData.סוג,
                מיקום: formData.מיקום,
                בעלות: formData.בעלות,
                סוג_דלק: formData.סוג_דלק,
                משתמש: permissions['name'],
                created_at: new Date().toLocaleString('he-IL')
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

    const handleDelete = async (id: number) => {
        if (!isA15Admin) return;
        
        if (!confirm('האם אתה בטוח שברצונך למחוק שורה זו?')) return;

        try {
            const { error } = await supabase
                .from('a15_otzma')
                .delete()
                .eq('id', id);

            if (error) throw error;

            setOtzmaData(prev => prev.filter(item => item.id !== id));
            setStatusMessage({ text: 'השורה נמחקה בהצלחה', isSuccess: true });
        } catch (error: any) {
            console.error('Error deleting row:', error);
            setStatusMessage({ text: `שגיאה במחיקה: ${error.message}`, isSuccess: false });
        }
    };

    return (
        <div className="bg-white p-10 rounded-lg shadow-lg space-y-4" dir="rtl">
            <h3 className="text-xl font-bold text-right mb-4 text-blue-700">דוח עוצמה</h3>

            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.isSuccess}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ text: '', isSuccess: false })}
                />
            )}

            {/* Form */}
            <div className="max-w-4xl mx-auto space-y-4 grid grid-cols-2 gap-4">
                {/* צ */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        צ <span className="text-red-500">*</span>
                    </label>
                    <Input
                        type="number"
                        placeholder="הכנס מספר"
                        value={formData.צ}
                        onChange={(e) => handleInputChange('צ', e.target.value)}
                        className="text-right"
                        dir="rtl"
                        min="0"
                    />
                </div>

                {/* אמצעי */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        אמצעי <span className="text-red-500">*</span>
                    </label>
                    <Input
                        type="text"
                        placeholder="הכנס אמצעי"
                        value={formData.אמצעי}
                        onChange={(e) => handleInputChange('אמצעי', e.target.value)}
                        className="text-right"
                        dir="rtl"
                    />
                </div>

                {/* סטטוס */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        סטטוס <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.סטטוס} onValueChange={(value) => handleInputChange('סטטוס', value)}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="בחר סטטוס" />
                        </SelectTrigger>
                        <SelectContent>
                            {סטטוסOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* פלוגה */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        פלוגה <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.פלוגה} onValueChange={(value) => handleInputChange('פלוגה', value)}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="בחר פלוגה" />
                        </SelectTrigger>
                        <SelectContent>
                            {פלוגהOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* מחלקה */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        מחלקה <span className="text-red-500">*</span>
                    </label>
                    <Input
                        type="text"
                        placeholder="הכנס מחלקה"
                        value={formData.מחלקה}
                        onChange={(e) => handleInputChange('מחלקה', e.target.value)}
                        className="text-right"
                        dir="rtl"
                    />
                </div>

                {/* סוג */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        סוג <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.סוג} onValueChange={(value) => handleInputChange('סוג', value)}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="בחר סוג" />
                        </SelectTrigger>
                        <SelectContent>
                            {סוגOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

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

                {/* בעלות */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        בעלות <span className="text-red-500">*</span>
                    </label>
                    <Input
                        type="text"
                        placeholder="הכנס בעלות"
                        value={formData.בעלות}
                        onChange={(e) => handleInputChange('בעלות', e.target.value)}
                        className="text-right"
                        dir="rtl"
                    />
                </div>

                {/* סוג דלק */}
                <div>
                    <label className="block text-right font-semibold mb-2">
                        סוג דלק <span className="text-red-500">*</span>
                    </label>
                    <Select value={formData.סוג_דלק} onValueChange={(value) => handleInputChange('סוג_דלק', value)}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="בחר סוג דלק" />
                        </SelectTrigger>
                        <SelectContent>
                            {סוגדלקOptions.map((option) => (
                                <SelectItem key={option} value={option}>{option}</SelectItem>
                            ))}
                        </SelectContent>
                    </Select>
                </div>

                {/* הערות */}
                <div className="col-span-2">
                    <label className="block text-right font-semibold mb-2">
                        הערות
                    </label>
                    <Input
                        type="text"
                        placeholder="הוסף הערות (אופציונלי)"
                        value={formData.הערות}
                        onChange={(e) => handleInputChange('הערות', e.target.value)}
                        className="text-right"
                        dir="rtl"
                    />
                </div>

                {/* Action Buttons */}
                <div className="col-span-2 flex gap-4 justify-center pt-4">
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
                ) : otzmaData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">אין נתונים להצגה</div>
                ) : (isA15Admin || viewMode === 'table') ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        {key: 'צ', label: 'צ'},
                                        {key: 'אמצעי', label: 'אמצעי'},
                                        {key: 'סטטוס', label: 'סטטוס'},
                                        {key: 'הערות', label: 'הערות'},
                                        {key: 'פלוגה', label: 'פלוגה'},
                                        {key: 'מחלקה', label: 'מחלקה'},
                                        {key: 'סוג', label: 'סוג'},
                                        {key: 'מיקום', label: 'מיקום'},
                                        {key: 'בעלות', label: 'בעלות'},
                                        {key: 'סוג_דלק', label: 'סוג דלק'},
                                        {key: 'משתמש', label: 'משתמש'},
                                        {key: 'created_at', label: 'תאריך יצירה'},
                                        ...(isA15Admin ? [{key: 'actions', label: 'פעולות'}] : [])
                                    ].map(({key, label}) => (
                                        <th key={key} className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                                                {key !== 'actions' && (
                                                    <>
                                                        <button
                                                            onClick={() => handleSort(key as keyof OtzmaData)}
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
                                                    </>
                                                )}
                                            </div>
                                        </th>
                                    ))}
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredAndSortedData.map((item, index) => {
                                    const getRowBackgroundColor = () => {
                                        if (item.סטטוס === 'תקין') return 'bg-green-100 hover:bg-green-200';
                                        if (item.סטטוס === 'לא תקין') return 'bg-red-100 hover:bg-red-200';
                                        return index % 2 === 1 ? 'bg-blue-50 hover:bg-gray-50' : 'hover:bg-gray-50';
                                    };
                                    
                                    return (
                                    <tr key={item.id} className={getRowBackgroundColor()}>
                                        {/* צ */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'צ' ? (
                                                <Input
                                                    type="number"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'צ')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'צ');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'צ', item.צ)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.צ}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* אמצעי */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'אמצעי' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'אמצעי')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'אמצעי');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'אמצעי', item.אמצעי)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.אמצעי}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* סטטוס */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'סטטוס' ? (
                                                <Select
                                                    value={editValue}
                                                    onValueChange={(value) => {
                                                        setEditValue(value);
                                                        handleCellSave(item.id, 'סטטוס');
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {סטטוסOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'סטטוס', item.סטטוס)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.סטטוס}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* הערות */}
                                        <td className="px-6 py-4 text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'הערות' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'הערות')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'הערות');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'הערות', item.הערות)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.הערות || '-'}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* פלוגה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'פלוגה' ? (
                                                <Select
                                                    value={editValue}
                                                    onValueChange={(value) => {
                                                        setEditValue(value);
                                                        handleCellSave(item.id, 'פלוגה');
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {פלוגהOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'פלוגה', item.פלוגה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.פלוגה}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* מחלקה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'מחלקה' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'מחלקה')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'מחלקה');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'מחלקה', item.מחלקה)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.מחלקה}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* סוג */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'סוג' ? (
                                                <Select
                                                    value={editValue}
                                                    onValueChange={(value) => {
                                                        setEditValue(value);
                                                        handleCellSave(item.id, 'סוג');
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {סוגOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'סוג', item.סוג)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.סוג}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* מיקום */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'מיקום' ? (
                                                <Select
                                                    value={editValue}
                                                    onValueChange={(value) => {
                                                        setEditValue(value);
                                                        handleCellSave(item.id, 'מיקום');
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {מיקוםOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'מיקום', item.מיקום)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.מיקום}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* בעלות */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'בעלות' ? (
                                                <Input
                                                    type="text"
                                                    value={editValue}
                                                    onChange={(e) => setEditValue(e.target.value)}
                                                    onBlur={() => handleCellSave(item.id, 'בעלות')}
                                                    onKeyDown={(e) => {
                                                        if (e.key === 'Enter') handleCellSave(item.id, 'בעלות');
                                                        if (e.key === 'Escape') handleCellCancel();
                                                    }}
                                                    className="w-full text-sm"
                                                    autoFocus
                                                />
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'בעלות', item.בעלות)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.בעלות}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* סוג דלק */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            {isA15Admin && editingCell?.rowId === item.id && editingCell?.field === 'סוג_דלק' ? (
                                                <Select
                                                    value={editValue}
                                                    onValueChange={(value) => {
                                                        setEditValue(value);
                                                        handleCellSave(item.id, 'סוג_דלק');
                                                    }}
                                                >
                                                    <SelectTrigger className="w-full">
                                                        <SelectValue />
                                                    </SelectTrigger>
                                                    <SelectContent>
                                                        {סוגדלקOptions.map((option) => (
                                                            <SelectItem key={option} value={option}>{option}</SelectItem>
                                                        ))}
                                                    </SelectContent>
                                                </Select>
                                            ) : (
                                                <span 
                                                    onClick={() => handleCellEdit(item.id, 'סוג_דלק', item.סוג_דלק)}
                                                    className={isA15Admin ? 'cursor-pointer hover:bg-gray-100 px-2 py-1 rounded' : ''}
                                                >
                                                    {item.סוג_דלק}
                                                </span>
                                            )}
                                        </td>
                                        
                                        {/* משתמש */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.משתמש || '-'}</span>
                                        </td>
                                        
                                        {/* תאריך יצירה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">
                                            {formatDateTime(item.created_at)}
                                        </td>
                                        
                                        {/* Actions */}
                                        {isA15Admin && (
                                            <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                <button
                                                    onClick={() => handleDelete(item.id)}
                                                    className="text-red-600 hover:text-red-800 p-1 rounded hover:bg-red-100"
                                                    title="מחק"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </td>
                                        )}
                                    </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                ) : (
                    <div className="grid gap-4">
                        {otzmaData.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">צ:</span>
                                        <div className="mt-1">{item.צ}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">אמצעי:</span>
                                        <div className="mt-1">{item.אמצעי}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">סטטוס:</span>
                                        <div className="mt-1">{item.סטטוס}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">פלוגה:</span>
                                        <div className="mt-1">{item.פלוגה}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">מחלקה:</span>
                                        <div className="mt-1">{item.מחלקה}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">סוג:</span>
                                        <div className="mt-1">{item.סוג}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">מיקום:</span>
                                        <div className="mt-1">{item.מיקום}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">בעלות:</span>
                                        <div className="mt-1">{item.בעלות}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">סוג דלק:</span>
                                        <div className="mt-1">{item.סוג_דלק}</div>
                                    </div>
                                    {item.הערות && (
                                        <div className="text-right col-span-2">
                                            <span className="font-semibold text-blue-700">הערות:</span>
                                            <div className="mt-1">{item.הערות}</div>
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

export default Otzma;
