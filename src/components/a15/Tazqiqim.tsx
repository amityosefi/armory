import React, { useState, useMemo, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { supabase } from '@/lib/supabaseClient';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { TableIcon, ArrowUpDown, ArrowUp, ArrowDown, Filter, Download, BarChart3 } from 'lucide-react';
import * as XLSX from '@e965/xlsx';
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
    const isA15Admin = permissions['a15'];
    
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
    const [viewMode, setViewMode] = useState<'summary' | 'table'>('summary');
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
    const [columnWidths, setColumnWidths] = useState<{[key: string]: number}>({
        מסגרת: 120,
        מיקום: 120,
        אמצעי: 150,
        צ: 80,
        תקן: 100,
        רמת_מלאי: 120,
        הערה: 150,
        פלוגה: 120,
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
        setFormData(prev => {
            const updated = { ...prev, [field]: value };
            // Reset אמצעי when מיקום changes
            if (field === 'מיקום') {
                updated.אמצעי = '';
            }
            return updated;
        });
    };

    const handleExportToExcel = () => {
        const exportData = filteredAndSortedData.map(item => ({
            'מסגרת': item.מסגרת,
            'מיקום': item.מיקום,
            'אמצעי': item.אמצעי,
            'צ': item.צ,
            'תקן': item.תקן,
            'רמת מלאי (%)': item.רמת_מלאי,
            'הערה': item.הערה || '',
            'פלוגה': item.פלוגה,
            'משתמש': item.משתמש || '',
            'תאריך יצירה': formatDateTime(item.created_at)
        }));

        const ws = XLSX.utils.json_to_sheet(exportData);
        const wb = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(wb, ws, 'דוח תזקיקים');
        XLSX.writeFile(wb, `דוח_תזקיקים_${new Date().toISOString().split('T')[0]}.xlsx`);
    };

    // Get summary data - latest entry for each location/resource combination
    const summaryData = useMemo(() => {
        const grouped = new Map<string, TazqiqimData>();
        
        // Sort by created_at descending to get latest first
        const sorted = [...tazqiqimData].sort((a, b) => 
            new Date(b.created_at).getTime() - new Date(a.created_at).getTime()
        );
        
        sorted.forEach(item => {
            const key = `${item.מיקום}_${item.אמצעי}`;
            if (!grouped.has(key)) {
                grouped.set(key, item);
            }
        });
        
        // Sort by מיקום
        return Array.from(grouped.values()).sort((a, b) => 
            a.מיקום.localeCompare(b.מיקום, 'he')
        );
    }, [tazqiqimData]);

    const מסגרתOptions = ['צק"פ א', 'צק"פ ב', 'צק"פ ג','מרגמות', 'מכלול', 'עורף', 'אלון', 'שיריון'];
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
        // צ is only required for אכזרית
        const צRequired = formData.אמצעי === 'אכזרית' ? formData.צ : true;
        
        return (
            formData.מסגרת &&
            formData.מיקום &&
            formData.אמצעי &&
            צRequired &&
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
            // צ is only relevant for אכזרית
            const צ = formData.אמצעי === 'אכזרית' ? parseInt(formData.צ) : null;
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
                created_at: new Date().toISOString()
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
                    צ {formData.אמצעי === 'אכזרית' && <span className="text-red-500">*</span>}
                </label>
                {formData.אמצעי === 'אכזרית' ? (
                    <Select value={formData.צ} onValueChange={(value) => handleInputChange('צ', value)}>
                        <SelectTrigger className="text-right" dir="rtl">
                            <SelectValue placeholder="בחר צ" />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="812169">812169</SelectItem>
                            <SelectItem value="812378">812378</SelectItem>
                            <SelectItem value="812167">812167</SelectItem>
                            <SelectItem value="812130">812130</SelectItem>
                            <SelectItem value="812302">812302</SelectItem>
                            <SelectItem value="812128">812128</SelectItem>
                            <SelectItem value="812355">812355</SelectItem>
                        </SelectContent>
                    </Select>
                ) : (
                    <Input
                        type="number"
                        placeholder="רלוונטי רק לאכזרית"
                        value={formData.צ}
                        onChange={(e) => handleInputChange('צ', e.target.value)}
                        className="text-right"
                        dir="rtl"
                        disabled={true}
                    />
                )}
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
                    {formData.אמצעי === 'בלון גז 48 ק"ג' ? 'רמת מלאי (מספר)' : 'רמת מלאי (%)'} <span className="text-red-500">*</span>
                </label>
                {formData.אמצעי === 'בלון גז 48 ק"ג' ? (
                    <>
                        <Input
                            type="number"
                            placeholder="הכנס מספר (0-18)"
                            value={formData.רמת_מלאי}
                            onChange={(e) => {
                                const value = e.target.value;
                                const numValue = parseInt(value);
                                if (value === '' || (numValue >= 0 && numValue <= 18)) {
                                    handleInputChange('רמת_מלאי', value);
                                }
                            }}
                            className="text-right"
                            dir="rtl"
                            min="0"
                            max="18"
                        />
                        {formData.רמת_מלאי && (
                            <div className="mt-2 text-sm text-gray-600 text-right">
                                אחוז מלאי: {Math.round((parseInt(formData.רמת_מלאי) / 18) * 100)}%
                            </div>
                        )}
                    </>
                ) : (
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
                )}
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
                        <Button
                            onClick={() => setViewMode('summary')}
                            variant={viewMode === 'summary' ? 'default' : 'outline'}
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <BarChart3 className="w-4 h-4" />
                            טבלה מרכזת
                        </Button>
                        <Button
                            onClick={() => setViewMode('table')}
                            variant={viewMode === 'table' ? 'default' : 'outline'}
                            size="sm"
                            className="flex items-center gap-2"
                        >
                            <TableIcon className="w-4 h-4" />
                            טבלה מלאה
                        </Button>
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
                ) : tazqiqimData.length === 0 ? (
                    <div className="text-center py-8 text-gray-500">אין נתונים להצגה</div>
                ) : viewMode === 'summary' ? (
                    <div className="space-y-6">
                        {/* Bar Chart Visualization */}
                        <div className="bg-white rounded-lg shadow p-6">
                            <h4 className="text-lg font-bold mb-4 text-blue-900">תרשים ויזואלי - רמת מלאי</h4>
                            <div className="flex items-end justify-around gap-4 px-4" style={{height: '400px'}}>
                                {summaryData.map((item) => {
                                    const isGasBalloon = item.אמצעי === 'בלון גז 48 ק"ג';
                                    const fillPercentage = isGasBalloon ? Math.round((item.רמת_מלאי / 18) * 100) : item.רמת_מלאי;
                                    const displayValue = isGasBalloon ? `${fillPercentage}%` : `${fillPercentage}%`;
                                    const barHeightPx = Math.max((fillPercentage / 100) * 400, 30);
                                    return (
                                        <div key={`chart_${item.מיקום}_${item.אמצעי}`} className="flex flex-col items-center gap-2">
                                            <div 
                                                className={`w-20 rounded-lg transition-all duration-500 flex items-start justify-center pt-2 ${
                                                    fillPercentage >= 70 ? 'bg-green-500' :
                                                    fillPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                }`}
                                                style={{height: `${barHeightPx}px`}}
                                            >
                                                <span className="text-xs font-bold text-white drop-shadow-md">{displayValue}</span>
                                            </div>
                                            <div className="text-xs font-medium text-gray-600 text-center break-words w-20">
                                                {item.מיקום}
                                            </div>
                                            <div className="text-xs text-gray-500 text-center break-words w-20">
                                                {item.אמצעי}
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Summary Table */}
                        <div className="bg-white rounded-lg shadow overflow-x-auto">
                            <h4 className="text-lg font-bold p-4 bg-blue-50 text-blue-900">טבלה מרכזת - נתונים אחרונים</h4>
                            <table className="min-w-full divide-y divide-gray-200" dir="rtl">
                                <thead className="bg-gray-50">
                                    <tr>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">מיקום</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">אמצעי</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">צ</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תקן</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">רמת מלאי (%)</th>
                                        <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">תאריך עדכון</th>
                                    </tr>
                                </thead>
                                <tbody className="bg-white divide-y divide-gray-200">
                                    {summaryData.map((item) => {
                                        const fillPercentage = item.רמת_מלאי;
                                        const isGasBalloon = item.אמצעי === 'בלון גז 48 ק"ג';
                                        const getColorClass = () => {
                                            if (fillPercentage >= 70) return 'bg-green-100';
                                            if (fillPercentage >= 40) return 'bg-yellow-100';
                                            return 'bg-red-100';
                                        };
                                        
                                        return (
                                            <tr key={`${item.מיקום}_${item.אמצעי}`} className={getColorClass()}>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm font-medium text-gray-900">{item.מיקום}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.אמצעי}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.צ}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">{item.תקן}</td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-900">
                                                    <div className="flex items-center gap-2">
                                                        {!isGasBalloon && (
                                                            <div className="flex-1 bg-gray-200 rounded-full h-4 overflow-hidden">
                                                                <div 
                                                                    className={`h-full ${
                                                                        fillPercentage >= 70 ? 'bg-green-500' :
                                                                        fillPercentage >= 40 ? 'bg-yellow-500' : 'bg-red-500'
                                                                    }`}
                                                                    style={{width: `${fillPercentage}%`}}
                                                                />
                                                            </div>
                                                        )}
                                                        <span className="font-semibold">{fillPercentage}{!isGasBalloon && '%'}</span>
                                                    </div>
                                                </td>
                                                <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-600">{formatDateTime(item.created_at)}</td>
                                            </tr>
                                        );
                                    })}
                                </tbody>
                            </table>
                        </div>
                    </div>
                ) : viewMode === 'table' ? (
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
                                        <th key={key} className="px-3 py-2 relative" style={{width: columnWidths[key], minWidth: columnWidths[key]}}>
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
