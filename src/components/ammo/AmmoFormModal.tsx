import React, {useRef, useState} from "react";
import {Button} from '@/components/ui/button';
import {Input} from '@/components/ui/input';
import {Select, SelectContent, SelectItem, SelectTrigger, SelectValue} from '@/components/ui/select';
import {Trash, Plus, ChevronLeft, ChevronRight, Package, FileSignature} from "lucide-react";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from '@/components/ui/dialog';
import CreatableSelect from 'react-select/creatable';
import SignatureCanvas from "react-signature-canvas";
import {Label} from "@/components/ui/label";

type AmmoItem = {
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

interface AmmoFormModalProps {
    isOpen: boolean;
    onClose: () => void;
    mode: 'דיווח' | 'החתמה';
    items: Partial<AmmoItem>[];
    setItems: (items: Partial<AmmoItem>[]) => void;
    defaultItem: Partial<AmmoItem>;
    uniqueBallItemNames: string[];
    uniqueExplosionItemNames: string[];
    uniqueBallItemNamesFromHahatama: string[];
    uniqueExplosionItemNamesFromHahatama: string[];
    signerName: string;
    setSignerName: (name: string) => void;
    signerPersonalId: number;
    setSignerPersonalId: (id: number) => void;
    divuchUserGroups: { משתמש: string; מספר_אישי_מחתים: number }[];
    dataURL: string;
    setDataURL: (url: string) => void;
    onSubmit: () => void;
    loading: boolean;
    permissions: Record<string, any>;
}

const rtlSelectStyles = {
    control: (provided: any) => ({
        ...provided,
        textAlign: 'right' as const,
        direction: 'rtl' as const,
        borderColor: '#d1d5db',
        '&:hover': {borderColor: '#9ca3af'},
        boxShadow: 'none',
        minHeight: '40px',
    }),
    menu: (provided: any) => ({
        ...provided,
        textAlign: 'right' as const,
        direction: 'rtl' as const,
        zIndex: 50,
    }),
    option: (provided: any) => ({
        ...provided,
        textAlign: 'right' as const,
        direction: 'rtl' as const,
    }),
    placeholder: (provided: any) => ({
        ...provided,
        textAlign: 'right' as const,
        color: '#9ca3af',
    }),
    singleValue: (provided: any) => ({
        ...provided,
        textAlign: 'right' as const,
    }),
};

const rtlSelectTheme = (theme: any) => ({
    ...theme,
    colors: {
        ...theme.colors,
        primary: '#3b82f6',
        primary25: '#eff6ff',
    },
});

const AmmoFormModal: React.FC<AmmoFormModalProps> = ({
    isOpen,
    onClose,
    mode,
    items,
    setItems,
    defaultItem,
    uniqueBallItemNames,
    uniqueExplosionItemNames,
    uniqueBallItemNamesFromHahatama,
    uniqueExplosionItemNamesFromHahatama,
    signerName,
    setSignerName,
    signerPersonalId,
    setSignerPersonalId,
    divuchUserGroups,
    dataURL,
    setDataURL,
    onSubmit,
    loading,
    permissions,
}) => {
    const sigPadRef = useRef<SignatureCanvas>(null);
    const [step, setStep] = useState<'items' | 'signature'>('items');
    const [showSuggestions, setShowSuggestions] = useState<{[key: string]: boolean}>({});

    const isSignatureMode = mode === 'החתמה';
    const hasShatzalItems = items.some(item => item.צורך === 'שצל');

    const getItemSuggestions = (item: Partial<AmmoItem>) => {
        if (mode === 'דיווח') {
            return item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNamesFromHahatama : uniqueBallItemNamesFromHahatama;
        }
        return item.סוג_תחמושת === 'נפיצה' ? uniqueExplosionItemNames : uniqueBallItemNames;
    };

    const handleClose = () => {
        setStep('items');
        setShowSuggestions({});
        onClose();
    };

    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            setDataURL(sigPadRef.current.getCanvas().toDataURL("image/png"));
        }
    };

    const handleNext = () => {
        setStep('signature');
    };

    const handleBack = () => {
        setStep('items');
    };

    const handleSubmit = () => {
        if (isSignatureMode && step === 'items') {
            handleNext();
            return;
        }
        onSubmit();
    };

    const canProceed = items.some(item => item.פריט && item.כמות && item.כמות > 0);

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && handleClose()}>
            <DialogContent
                className="sm:max-w-lg w-[calc(100%-2rem)] max-h-[90vh] overflow-hidden flex flex-col p-0 gap-0"
                dir="rtl"
            >
                {/* Header */}
                <DialogHeader className="bg-gradient-to-l from-orange-600 to-orange-700 px-5 py-4 rounded-t-lg shrink-0">
                    <DialogTitle className="text-right text-white text-lg font-bold">
                        {mode === 'דיווח' ? 'דיווח שצל' : 'טופס החתמה - תחמושת'}
                    </DialogTitle>
                    {isSignatureMode && (
                        <div className="flex items-center gap-3 mt-3">
                            <button
                                onClick={() => setStep('items')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                    step === 'items'
                                        ? 'bg-white text-orange-700 shadow-sm'
                                        : 'text-orange-200 hover:text-white'
                                }`}
                            >
                                <Package className="h-3.5 w-3.5"/>
                                פריטים
                            </button>
                            <ChevronLeft className="h-4 w-4 text-orange-300"/>
                            <button
                                onClick={() => canProceed && setStep('signature')}
                                className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium transition-all ${
                                    step === 'signature'
                                        ? 'bg-white text-orange-700 shadow-sm'
                                        : 'text-orange-200 hover:text-white'
                                } ${!canProceed ? 'opacity-50 cursor-not-allowed' : ''}`}
                            >
                                <FileSignature className="h-3.5 w-3.5"/>
                                חתימה
                            </button>
                        </div>
                    )}
                </DialogHeader>

                {/* Scrollable content */}
                <div className="flex-1 overflow-y-auto px-5 py-4">
                    {/* Step 1: Items */}
                    {step === 'items' && (
                        <div className="space-y-3">
                            {items.map((item, index) => (
                                <div
                                    key={index}
                                    className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 relative"
                                >
                                    {index > 0 && (
                                        <button
                                            type="button"
                                            onClick={() => setItems(items.filter((_, i) => i !== index))}
                                            className="absolute top-2 left-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                        >
                                            <Trash className="h-4 w-4"/>
                                        </button>
                                    )}

                                    {/* Ammo type selector */}
                                    <div>
                                        <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">סוג תחמושת</Label>
                                        <Select
                                            value={item.סוג_תחמושת || 'קליעית'}
                                            onValueChange={(value) => {
                                                const newItems = [...items];
                                                newItems[index].סוג_תחמושת = value;
                                                newItems[index].פריט = '';
                                                setItems(newItems);
                                            }}
                                        >
                                            <SelectTrigger className="text-right h-10" dir="rtl">
                                                <SelectValue placeholder="בחר סוג"/>
                                            </SelectTrigger>
                                            <SelectContent className="text-right" dir="rtl">
                                                <SelectItem value="קליעית">קליעית</SelectItem>
                                                <SelectItem value="נפיצה">נפיצה</SelectItem>
                                            </SelectContent>
                                        </Select>
                                    </div>

                                    {/* Item name with suggestions */}
                                    <div>
                                        <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">פריט</Label>
                                        <div className="relative">
                                            <Input
                                                type="text"
                                                value={item.פריט || ''}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    newItems[index].פריט = e.target.value;
                                                    setItems(newItems);
                                                }}
                                                onFocus={() => setShowSuggestions(prev => ({...prev, [index]: true}))}
                                                onClick={() => setShowSuggestions(prev => ({...prev, [index]: true}))}
                                                onBlur={() => setTimeout(() => setShowSuggestions(prev => ({...prev, [index]: false})), 200)}
                                                placeholder="הקלד או בחר פריט"
                                                className="text-right pr-8 h-10"
                                                dir="rtl"
                                            />
                                            <svg
                                                className="absolute left-2 top-1/2 transform -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none"
                                                fill="none" stroke="currentColor" viewBox="0 0 24 24"
                                            >
                                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 9l-7 7-7-7"/>
                                            </svg>
                                            {showSuggestions[index] && (
                                                <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                                    {getItemSuggestions(item)
                                                        .filter(name => name.toLowerCase().includes((item.פריט || '').toLowerCase()))
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

                                    <div className="grid grid-cols-2 gap-3">
                                        <div>
                                            <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">כמות</Label>
                                            <Input
                                                type="number"
                                                value={item.כמות || ''}
                                                onChange={(e) => {
                                                    const newItems = [...items];
                                                    const parsed = parseInt(e.target.value, 10);
                                                    const safe = Number.isNaN(parsed) ? 1 : Math.max(1, parsed);
                                                    newItems[index].כמות = safe;
                                                    setItems(newItems);
                                                }}
                                                className="text-right h-10"
                                                min={1}
                                                step={1}
                                                inputMode="numeric"
                                                pattern="[0-9]*"
                                            />
                                        </div>

                                        <div>
                                            <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">צורך</Label>
                                            <Select
                                                value={mode === 'דיווח' && !permissions['ammo'] ? 'שצל' : (item.צורך || 'ניפוק')}
                                                onValueChange={(value) => {
                                                    const newItems = [...items];
                                                    newItems[index].צורך = value;
                                                    setItems(newItems);
                                                }}
                                                disabled={mode === 'דיווח' && !permissions['ammo']}
                                            >
                                                <SelectTrigger className="text-right h-10" dir="rtl">
                                                    <SelectValue placeholder="בחר צורך"/>
                                                </SelectTrigger>
                                                <SelectContent className="text-right" dir="rtl">
                                                    {mode === 'דיווח' ? (
                                                        <SelectItem value="שצל">שצל</SelectItem>
                                                    ) : (
                                                        <>
                                                            <SelectItem value="ניפוק">ניפוק</SelectItem>
                                                            <SelectItem value="שצל">שצל</SelectItem>
                                                            <SelectItem value="זיכוי">זיכוי</SelectItem>
                                                        </>
                                                    )}
                                                </SelectContent>
                                            </Select>
                                        </div>
                                    </div>
                                </div>
                            ))}

                            <Button
                                type="button"
                                variant="outline"
                                onClick={() => setItems([...items, {...defaultItem}])}
                                className="w-full border-dashed border-2 hover:border-orange-400 hover:bg-orange-50 transition-colors h-11"
                            >
                                <Plus className="h-4 w-4 ml-2"/>
                                הוסף פריט נוסף
                            </Button>
                        </div>
                    )}

                    {/* Step 2: Signature (only for החתמה mode) */}
                    {step === 'signature' && isSignatureMode && (
                        <div className="space-y-4">
                            {/* Summary of items */}
                            <div className="bg-orange-50 border border-orange-200 rounded-xl p-3">
                                <h4 className="text-sm font-semibold text-orange-800 mb-2">פריטים שנבחרו:</h4>
                                <div className="space-y-1">
                                    {items.filter(i => i.פריט).map((item, idx) => (
                                        <div key={idx} className="flex justify-between text-sm text-orange-700">
                                            <span>{item.פריט} ({item.סוג_תחמושת})</span>
                                            <span className="font-medium">{item.כמות} × {item.צורך}</span>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {!hasShatzalItems && (
                                <>
                                    <div>
                                        <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">שם החותם</Label>
                                        <CreatableSelect
                                            options={divuchUserGroups.map(user => ({
                                                value: user.משתמש,
                                                label: user.משתמש,
                                                personalId: user.מספר_אישי_מחתים
                                            }))}
                                            value={signerName ? {value: signerName, label: signerName} : null}
                                            onChange={(selectedOption: any) => {
                                                if (!selectedOption) {
                                                    setSignerName('');
                                                    setSignerPersonalId(0);
                                                    return;
                                                }
                                                setSignerName(selectedOption.value);
                                                if (selectedOption.personalId) {
                                                    setSignerPersonalId(selectedOption.personalId);
                                                }
                                            }}
                                            onCreateOption={(inputValue) => setSignerName(inputValue)}
                                            placeholder="בחר או הכנס שם"
                                            noOptionsMessage={() => "לא נמצאו משתמשים"}
                                            formatCreateLabel={(inputValue) => `הוסף "${inputValue}"`}
                                            isClearable
                                            isSearchable
                                            styles={rtlSelectStyles}
                                            theme={rtlSelectTheme}
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">מספר אישי של החותם</Label>
                                        <CreatableSelect
                                            options={divuchUserGroups.map(user => ({
                                                value: user.מספר_אישי_מחתים,
                                                label: String(user.מספר_אישי_מחתים),
                                                name: user.משתמש
                                            }))}
                                            value={signerPersonalId ? {
                                                value: signerPersonalId,
                                                label: String(signerPersonalId)
                                            } : null}
                                            onChange={(selectedOption: any) => {
                                                if (!selectedOption) {
                                                    setSignerPersonalId(0);
                                                    setSignerName('');
                                                    return;
                                                }
                                                setSignerPersonalId(selectedOption.value);
                                                if (selectedOption.name) {
                                                    setSignerName(selectedOption.name);
                                                }
                                            }}
                                            onCreateOption={(inputValue) => {
                                                const parsed = parseInt(inputValue, 10);
                                                if (!isNaN(parsed)) setSignerPersonalId(parsed);
                                            }}
                                            placeholder="בחר או הכנס מספר אישי"
                                            noOptionsMessage={() => "לא נמצאו משתמשים"}
                                            formatCreateLabel={(inputValue) => `הוסף "${inputValue}"`}
                                            isClearable
                                            isSearchable
                                            styles={rtlSelectStyles}
                                            theme={rtlSelectTheme}
                                        />
                                    </div>

                                    <div>
                                        <Label className="text-right block mb-1.5 text-sm font-medium text-gray-700">חתימה</Label>
                                        <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white">
                                            <SignatureCanvas
                                                ref={sigPadRef}
                                                penColor="black"
                                                onEnd={saveSignature}
                                                canvasProps={{
                                                    className: "w-full",
                                                    style: {direction: "ltr", height: '150px', width: '100%', touchAction: 'none'},
                                                }}
                                                clearOnResize={false}
                                                backgroundColor="white"
                                            />
                                        </div>
                                        <Button
                                            type="button"
                                            variant="ghost"
                                            size="sm"
                                            onClick={() => {
                                                sigPadRef.current?.clear();
                                                setDataURL('');
                                            }}
                                            className="mt-1 text-gray-500 hover:text-red-500"
                                        >
                                            נקה חתימה
                                        </Button>
                                    </div>
                                </>
                            )}

                            {hasShatzalItems && (
                                <div className="bg-yellow-50 border border-yellow-200 rounded-xl p-4 text-center text-yellow-800">
                                    <p className="font-medium">פריטי שצל אינם דורשים חתימה</p>
                                    <p className="text-sm mt-1">לחץ על "שלח" לשליחת הטופס</p>
                                </div>
                            )}
                        </div>
                    )}
                </div>

                {/* Footer */}
                <DialogFooter className="border-t bg-gray-50 px-5 py-3 rounded-b-lg shrink-0">
                    <div className="flex w-full gap-2 justify-between">
                        <div>
                            {isSignatureMode && step === 'signature' && (
                                <Button type="button" onClick={handleBack} variant="ghost" className="flex items-center gap-1">
                                    <ChevronRight className="h-4 w-4"/>
                                    חזור
                                </Button>
                            )}
                        </div>
                        <div className="flex gap-2">
                            <Button type="button" onClick={handleClose} variant="outline">
                                ביטול
                            </Button>
                            <Button
                                type="button"
                                onClick={handleSubmit}
                                disabled={loading || !canProceed}
                                className="bg-orange-600 hover:bg-orange-700 flex items-center gap-2 min-w-[100px]"
                            >
                                {loading && <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>}
                                {loading
                                    ? 'שולח...'
                                    : isSignatureMode && step === 'items'
                                        ? 'המשך לחתימה'
                                        : mode === 'דיווח'
                                            ? 'שלח דרישות'
                                            : 'החתם על פריטים'
                                }
                            </Button>
                        </div>
                    </div>
                </DialogFooter>
            </DialogContent>
        </Dialog>
    );
};

export default AmmoFormModal;
