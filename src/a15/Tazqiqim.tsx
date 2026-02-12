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

interface TazqiqimFormProps {
    activePermission: string | undefined;
}

interface FormData {
    מסגרת: string;
    מיקום: string;
    אמצעי: string;
    צ: string;
    רמת_מלאי: string;
}

interface TazqiqimData {
    id: number;
    מסגרת: string;
    מיקום: string;
    אמצעי: string;
    צ: number;
    תקן: number;
    רמת_מלאי: number;
    הערה?: string | null;
    פלוגה: string;
    משתמש?: string | null;
    created_at: string;
}

const Tazqiqim: React.FC<TazqiqimFormProps> = ({ activePermission }) => {
    const permissions = useAuthStore((state) => state.permissions);
    const isA15Admin = permissions['a15'] === true;
    
    const [formData, setFormData] = useState<FormData>({
        מסגרת: '',
        מיקום: '',
        אמצעי: '',
        צ: '',
        רמת_מלאי: ''
    });
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
    const [tazqiqimData, setTazqiqimData] = useState<TazqiqimData[]>([]);
    const [isLoadingData, setIsLoadingData] = useState(false);
    const [viewMode, setViewMode] = useState<'table' | 'card'>('table');
    const [sortConfig, setSortConfig] = useState<{key: keyof TazqiqimData | null, direction: 'asc' | 'desc' | null}>({key: null, direction: null});
    const [columnFilters, setColumnFilters] = useState<{[key: string]: string}>({
        מסגרת: '',
        מיקום: '',
        אמצעי: '',
        צ: '',
        תקן: '',
        רמת_מלאי: '',
        הערה: '',
        פלוגה: '',
        משתמש: '',
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

    // תקן values based on אמצעי
    const getתקן = (אמצעי: string): number => {
        const תקןMap: {[key: string]: number} = {
            'מיכל מים': 10000,
            'מיכל סולר': 5000,
            'בלון גז 48 ק"ג': 18,
            'אכזרית': 1050
        };
        return תקןMap[אמצעי] || 0;
    };

    const handleSort = (key: keyof TazqiqimData) => {
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
        let filtered = [...tazqiqimData];

        // Apply filters
        Object.keys(columnFilters).forEach(key => {
            const filterValue = columnFilters[key].toLowerCase();
            if (filterValue) {
                filtered = filtered.filter(item => {
                    const value = key === 'created_at' 
                        ? formatDateTime(item[key as keyof TazqiqimData] as string)
                        : String(item[key as keyof TazqiqimData] || '');
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
    }, [tazqiqimData, columnFilters, sortConfig]);

    const handleCellEdit = (rowId: number, field: string, currentValue: any) => {
        if (!isA15Admin || field === 'created_at') return;
        setEditingCell({ rowId, field });
        setEditValue(String(currentValue || ''));
    };

    const handleCellSave = async (rowId: number, field: string) => {
        try {
            const currentItem = tazqiqimData.find(item => item.id === rowId);
            if (!currentItem) return;

            const updateData: any = {};
            updateData[field] = editValue;

            // Check if value has actually changed
            const oldValue = String(currentItem[field as keyof TazqiqimData] || '');
            const newValue = String(updateData[field]);
            

            if (oldValue === newValue) {
                setEditingCell(null);
                setEditValue('');
                return;
            }

            const { error } = await supabase
                .from('a15_tazqiqim')
                .update(updateData)
                .eq('id', rowId);

            if (error) throw error;

            // Update local state
            setTazqiqimData(prev => prev.map(item => 
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
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            // Reset אמצעי when מיקום changes
            if (field === 'מיקום') {
                updated.אמצעי = '';
            }
            return updated;
        });
    };

    const מסגרתOptions = ['עורף', 'צק"פ ג', 'מרגמות', 'מכלול', 'צק"פ א', 'ל"א', 'צק"פ ב', 'אלון'];
    const מיקוםOptions = ['מטאור 3', 'נגב 88', 'נחל עוז', 'פגה'];
    
    // Mapping of מיקום to available אמצעי based on the image
    const מיקוםToאמצעיMap: {[key: string]: string[]} = {
        'נגב 88': ['מיכל מים', 'מיכל סולר', 'בלון גז 48 ק"ג', 'אכזרית'],
        'מטאור 3': ['מיכל מים', 'מיכל סולר', 'בלון גז 48 ק"ג']
    };
    
    // Get available אמצעי options based on selected מיקום
    const getAvailableאמצעיOptions = (): string[] => {
        if (!formData.מיקום) return [];
        return מיקוםToאמצעיMap[formData.מיקום] || [];
    };
    
    const רמתמלאיOptions = ['0', '10', '20', '30', '40', '50', '60', '70', '80', '90', '100'];

    const fetchData = async () => {
        setIsLoadingData(true);
        try {
            let query = supabase
                .from('a15_tazqiqim')
                .select('*');
            
            // If user has a15 permission, fetch all data. Otherwise filter by activePermission
            if (!isA15Admin && activePermission) {
                query = query.eq('פלוגה', activePermission);
            }
            
            const { data, error } = await query.order('created_at', { ascending: false });

            if (error) throw error;
            setTazqiqimData((data as unknown as TazqiqimData[]) || []);
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
            מסגרת: '',
            מיקום: '',
            אמצעי: '',
            צ: '',
            רמת_מלאי: ''
        });
    };

    const isFormValid = () => {
        return (
            formData.מסגרת &&
            formData.מיקום &&
            formData.אמצעי &&
            formData.צ &&
            formData.רמת_מלאי
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
            const תקן = getתקן(formData.אמצעי);
            const רמת_מלאי = parseInt(formData.רמת_מלאי);

            const { data, error } = await supabase.from('a15_tazqiqim').insert({
                מסגרת: formData.מסגרת,
                מיקום: formData.מיקום,
                אמצעי: formData.אמצעי,
                צ: צ,
                תקן: תקן,
                רמת_מלאי: רמת_מלאי,
                פלוגה: activePermission || '',
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

    return (
        <div className="bg-white p-10 rounded-lg shadow-lg space-y-4" dir="rtl">
            <h3 className="text-xl font-bold text-right mb-4 text-blue-700">דוח תזקיקים</h3>

            {/* Status Message */}
            {statusMessage.text && (
                <StatusMessage
                    isSuccess={statusMessage.isSuccess}
                    message={statusMessage.text}
                    onClose={() => setStatusMessage({ text: '', isSuccess: false })}
                />
            )}

            {/* Form */}
            <div className="max-w-sm mx-auto space-y-4">
            {/* מסגרת */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    מסגרת <span className="text-red-500">*</span>
                </label>
                <Select value={formData.מסגרת} onValueChange={(value) => handleInputChange('מסגרת', value)}>
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר מסגרת" />
                    </SelectTrigger>
                    <SelectContent>
                        {מסגרתOptions.map((option) => (
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

            {/* אמצעי */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    אמצעי <span className="text-red-500">*</span>
                </label>
                <Select 
                    value={formData.אמצעי} 
                    onValueChange={(value) => handleInputChange('אמצעי', value)}
                    disabled={!formData.מיקום}
                >
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder={formData.מיקום ? "בחר אמצעי" : "בחר מיקום תחילה"} />
                    </SelectTrigger>
                    <SelectContent>
                        {getAvailableאמצעיOptions().map((option) => (
                            <SelectItem key={option} value={option}>{option}</SelectItem>
                        ))}
                    </SelectContent>
                </Select>
            </div>

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

            {/* תקן - display only */}
            {formData.אמצעי && (
                <div>
                    <label className="block text-right font-semibold mb-2">
                        תקן
                    </label>
                    <div className="p-2 bg-gray-100 rounded text-right font-medium">
                        {getתקן(formData.אמצעי) || '-'}
                    </div>
                </div>
            )}

            {/* רמת מלאי */}
            <div>
                <label className="block text-right font-semibold mb-2">
                    רמת מלאי (%) <span className="text-red-500">*</span>
                </label>
                <Select value={formData.רמת_מלאי} onValueChange={(value) => handleInputChange('רמת_מלאי', value)}>
                    <SelectTrigger className="text-right" dir="rtl">
                        <SelectValue placeholder="בחר אחוז מלאי" />
                    </SelectTrigger>
                    <SelectContent>
                        {רמתמלאיOptions.map((option) => (
                            <SelectItem key={option} value={option}>{option}%</SelectItem>
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
                ) : tazqiqimData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">אין נתונים להצגה</div>
                ) : (isA15Admin || viewMode === 'table') ? (
                    <div className="bg-white rounded-lg shadow overflow-x-auto">
                        <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                            <thead className="bg-gray-50">
                                <tr>
                                    {[
                                        {key: 'מסגרת', label: 'מסגרת'},
                                        {key: 'מיקום', label: 'מיקום'},
                                        {key: 'אמצעי', label: 'אמצעי'},
                                        {key: 'צ', label: 'צ'},
                                        {key: 'תקן', label: 'תקן'},
                                        {key: 'רמת_מלאי', label: 'רמת מלאי (%)'},
                                        {key: 'הערה', label: 'הערה'},
                                        {key: 'פלוגה', label: 'פלוגה'},
                                        {key: 'משתמש', label: 'משתמש'},
                                        {key: 'created_at', label: 'תאריך יצירה'}
                                    ].map(({key, label}) => (
                                        <th key={key} className="px-3 py-2">
                                            <div className="flex items-center gap-1">
                                                <span className="text-xs font-medium text-gray-500 uppercase tracking-wider">{label}</span>
                                                <button
                                                    onClick={() => handleSort(key as keyof TazqiqimData)}
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
                                        return index % 2 === 1 ? 'bg-blue-50 hover:bg-gray-50' : 'hover:bg-gray-50';
                                    };
                                    
                                    return (
                                    <tr key={item.id} className={getRowBackgroundColor()}>
                                        {/* מסגרת */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.מסגרת}</span>
                                        </td>
                                        
                                        {/* מיקום */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.מיקום}</span>
                                        </td>
                                        
                                        {/* אמצעי */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.אמצעי}</span>
                                        </td>
                                        
                                        {/* צ */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.צ}</span>
                                        </td>
                                        
                                        {/* תקן */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.תקן}</span>
                                        </td>
                                        
                                        {/* רמת מלאי */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.רמת_מלאי}%</span>
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
                                        
                                        {/* פלוגה */}
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                            <span>{item.פלוגה}</span>
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
                        {tazqiqimData.map((item) => (
                            <div key={item.id} className="border rounded-lg p-4 bg-gray-50 shadow-sm">
                                <div className="grid grid-cols-2 gap-3 text-sm">
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">מסגרת:</span>
                                        <div className="mt-1">{item.מסגרת}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">מיקום:</span>
                                        <div className="mt-1">{item.מיקום}</div>
                                    </div>
                                    <div className="text-right col-span-2">
                                        <span className="font-semibold text-blue-700">אמצעי:</span>
                                        <div className="mt-1">{item.אמצעי}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">צ:</span>
                                        <div className="mt-1">{item.צ}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">תקן:</span>
                                        <div className="mt-1">{item.תקן}</div>
                                    </div>
                                    <div className="text-right">
                                        <span className="font-semibold text-blue-700">רמת מלאי:</span>
                                        <div className="mt-1">{item.רמת_מלאי}%</div>
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

export default Tazqiqim;
