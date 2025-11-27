import React, { useState, useEffect } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
    DialogDescription,
} from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { Plus, Hash, Tag, CheckCircle2, MapPin } from "lucide-react";

interface AddItemIdModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

const AddItemIdModal: React.FC<AddItemIdModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    onError,
}) => {
    const [loading, setLoading] = useState(false);
    const [kinds, setKinds] = useState<string[]>([]);
    const [names, setNames] = useState<string[]>([]);
    const [selectedKind, setSelectedKind] = useState("");
    const [selectedName, setSelectedName] = useState("");
    const [newId, setNewId] = useState("");
    const [isRangeMode, setIsRangeMode] = useState(false);
    const [startId, setStartId] = useState("");
    const [endId, setEndId] = useState("");
    const [selectedLocation, setSelectedLocation] = useState("גדוד");
    const [selectedItemDetails, setSelectedItemDetails] = useState<{
        location: string;
    } | null>(null);

    // Fetch all unique kinds on mount
    useEffect(() => {
        if (isOpen) {
            fetchKinds();
        }
    }, [isOpen]);

    // Fetch names when kind is selected
    useEffect(() => {
        if (selectedKind) {
            fetchNames();
        } else {
            setNames([]);
            setSelectedName("");
        }
    }, [selectedKind]);

    // Fetch item details when name is selected
    useEffect(() => {
        if (selectedKind && selectedName) {
            fetchItemDetails();
        } else {
            setSelectedItemDetails(null);
        }
    }, [selectedKind, selectedName]);

    const fetchKinds = async () => {
        try {
            const { data, error } = await supabase
                .from("armory_items")
                .select("kind");

            if (error) throw error;

            const uniqueKinds = [...new Set((data as any[]).map((item) => item.kind as string))].sort();
            setKinds(uniqueKinds);
        } catch (err: any) {
            console.error("Error fetching kinds:", err);
            onError(`שגיאה בטעינת סוגים: ${err.message}`);
        }
    };

    const fetchNames = async () => {
        try {
            const { data, error } = await supabase
                .from("armory_items")
                .select("name")
                .eq("kind", selectedKind);

            if (error) throw error;

            const uniqueNames = [...new Set((data as any[]).map((item) => item.name as string))].sort();
            setNames(uniqueNames);
        } catch (err: any) {
            console.error("Error fetching names:", err);
            onError(`שגיאה בטעינת שמות: ${err.message}`);
        }
    };

    const fetchItemDetails = async () => {
        try {
            const { data, error } = await supabase
                .from("armory_items")
                .select("location")
                .eq("kind", selectedKind)
                .eq("name", selectedName)
                .limit(1)
                .single();

            if (error) throw error;

            setSelectedItemDetails(data as { location: string; });
        } catch (err: any) {
            console.error("Error fetching item details:", err);
        }
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Only allow digits
        if (value === "" || /^\d+$/.test(value)) {
            setNewId(value);
        }
    };

    const handleStartIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === "" || /^\d+$/.test(value)) {
            setStartId(value);
        }
    };

    const handleEndIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        if (value === "" || /^\d+$/.test(value)) {
            setEndId(value);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        // Validation
        if (!selectedKind || !selectedName || !selectedLocation) {
            onError("אנא מלא את כל השדות");
            return;
        }

        if (isRangeMode) {
            if (!startId || !endId) {
                onError("אנא הזן מספר התחלה וסוף");
                return;
            }
            const start = parseInt(startId);
            const end = parseInt(endId);
            if (start >= end) {
                onError("מספר התחלה חייב להיות קטן ממספר הסוף");
                return;
            }
        } else {
            if (!newId) {
                onError("אנא הזן מספר פריט");
                return;
            }
        }

        try {
            setLoading(true);

            if (isRangeMode) {
                // Range mode - add multiple items
                const start = parseInt(startId);
                const end = parseInt(endId);
                const itemsToAdd = [];
                const existingIds = [];

                // Check which IDs already exist
                for (let id = start; id <= end; id++) {
                    const { data: existingItem } = await supabase
                        .from("armory_items")
                        .select("id")
                        .eq("id", id)
                        .single();

                    if (existingItem) {
                        existingIds.push(id);
                    } else {
                        itemsToAdd.push({
                            id: id,
                            name: selectedName,
                            kind: selectedKind,
                            location: selectedLocation,
                        });
                    }
                }

                if (itemsToAdd.length === 0) {
                    onError(`כל המספרים בטווח כבר קיימים במערכת`);
                    setLoading(false);
                    return;
                }

                // Insert all items
                const { error } = await supabase
                    .from("armory_items")
                    .insert(itemsToAdd);

                if (error) throw error;

                const message = existingIds.length > 0
                    ? `נוספו ${itemsToAdd.length} פריטים בהצלחה. מספרים קיימים שדולגו: ${existingIds.join(', ')}`
                    : `נוספו ${itemsToAdd.length} פריטים (${start}-${end}) בהצלחה`;

                onSuccess(message);
            } else {
                // Single item mode
                const { data: existingNewItem } = await supabase
                    .from("armory_items")
                    .select("id")
                    .eq("id", parseInt(newId))
                    .single();

                if (existingNewItem) {
                    onError(`מספר ${newId} כבר קיים במערכת`);
                    setLoading(false);
                    return;
                }

                const { error } = await supabase
                    .from("armory_items")
                    .insert([
                        {
                            id: parseInt(newId),
                            name: selectedName,
                            kind: selectedKind,
                            location: selectedLocation,
                        },
                    ]);

                if (error) throw error;

                onSuccess(`פריט ${newId} - ${selectedName} נוסף בהצלחה | מיקום: ${selectedLocation}`);
            }

            onClose();
            handleReset();
        } catch (err: any) {
            console.error("Error adding item:", err);
            onError(`שגיאה בהוספת פריט: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setSelectedKind("");
        setSelectedName("");
        setNewId("");
        setIsRangeMode(false);
        setStartId("");
        setEndId("");
        setSelectedLocation("גדוד");
        setSelectedItemDetails(null);
    };

    const isStepComplete = (step: number) => {
        if (step === 1) return !!selectedKind;
        if (step === 2) return !!selectedName;
        if (step === 3) return isRangeMode ? (!!startId && !!endId) : !!newId;
        if (step === 4) return !!selectedLocation;
        return false;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2 justify-end">
                                <span>הוספת פריט חדש</span>
                                <Plus className="w-6 h-6 text-green-600" />
                            </DialogTitle>
                            <DialogDescription className="text-right mt-1">
                                בחר סוג, שם והזן מספר לפריט החדש
                            </DialogDescription>
                        </div>
                    </div>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-6">
                    {/* Step 1: Kind Selection */}
                    <div className="space-y-2">
                        <div className="flex items-center gap-2 justify-end">
                            <Label className="text-right font-semibold text-base flex items-center gap-2">
                                <span>שלב 1: בחר סוג</span>
                                {isStepComplete(1) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                            </Label>
                            <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                1
                            </div>
                        </div>
                        <select
                            value={selectedKind}
                            onChange={(e) => setSelectedKind(e.target.value)}
                            className="w-full p-3 border-2 rounded-lg text-right text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                            dir="rtl"
                            disabled={loading}
                            required
                        >
                            <option value="">-- בחר סוג --</option>
                            {kinds.map((kind) => (
                                <option key={kind} value={kind}>
                                    {kind}
                                </option>
                            ))}
                        </select>
                    </div>

                    {/* Step 2: Name Selection */}
                    {selectedKind && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end">
                                <Label className="text-right font-semibold text-base flex items-center gap-2">
                                    <span>שלב 2: בחר שם</span>
                                    {isStepComplete(2) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                </Label>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    2
                                </div>
                            </div>
                            <select
                                value={selectedName}
                                onChange={(e) => setSelectedName(e.target.value)}
                                className="w-full p-3 border-2 rounded-lg text-right text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                dir="rtl"
                                disabled={loading || !names.length}
                                required
                            >
                                <option value="">-- בחר שם --</option>
                                {names.map((name) => (
                                    <option key={name} value={name}>
                                        {name}
                                    </option>
                                ))}
                            </select>
                        </div>
                    )}

                    {/* Step 3: ID Input */}
                    {selectedKind && selectedName && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end">
                                <Label className="text-right font-semibold text-base flex items-center gap-2">
                                    <span>שלב 3: הזן מספר פריט</span>
                                    {isStepComplete(3) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                </Label>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    3
                                </div>
                            </div>
                            
                            {/* Range Mode Toggle */}
                            <div className="flex items-center gap-2 justify-end mb-2">
                                <label className="text-sm font-medium">הוספת טווח</label>
                                <input
                                    type="checkbox"
                                    checked={isRangeMode}
                                    onChange={(e) => setIsRangeMode(e.target.checked)}
                                    className="w-4 h-4"
                                    disabled={loading}
                                />
                            </div>

                            {isRangeMode ? (
                                <div className="space-y-3">
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            value={startId}
                                            onChange={handleStartIdChange}
                                            className="text-right pr-10 text-lg font-semibold border-2 focus:ring-2 focus:ring-blue-500"
                                            dir="rtl"
                                            disabled={loading}
                                            required
                                            placeholder="מספר התחלה"
                                        />
                                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                    <div className="relative">
                                        <Input
                                            type="text"
                                            inputMode="numeric"
                                            pattern="\d*"
                                            value={endId}
                                            onChange={handleEndIdChange}
                                            className="text-right pr-10 text-lg font-semibold border-2 focus:ring-2 focus:ring-blue-500"
                                            dir="rtl"
                                            disabled={loading}
                                            required
                                            placeholder="מספר סוף"
                                        />
                                        <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                    </div>
                                    {startId && endId && parseInt(startId) < parseInt(endId) && (
                                        <p className="text-sm text-green-600 text-right">
                                            יתווספו {parseInt(endId) - parseInt(startId) + 1} פריטים
                                        </p>
                                    )}
                                </div>
                            ) : (
                                <div className="relative">
                                    <Input
                                        type="text"
                                        inputMode="numeric"
                                        pattern="\d*"
                                        value={newId}
                                        onChange={handleIdChange}
                                        className="text-right pr-10 text-lg font-semibold border-2 focus:ring-2 focus:ring-blue-500"
                                        dir="rtl"
                                        disabled={loading}
                                        required
                                        placeholder="הזן מספר (ספרות בלבד)"
                                    />
                                    <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                                </div>
                            )}
                        </div>
                    )}

                    {/* Step 4: Location Selection */}
                    {selectedKind && selectedName && (isRangeMode ? (startId && endId) : newId) && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end">
                                <Label className="text-right font-semibold text-base flex items-center gap-2">
                                    <span>שלב 4: בחר מיקום</span>
                                    {isStepComplete(4) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                </Label>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    4
                                </div>
                            </div>
                            <select
                                value={selectedLocation}
                                onChange={(e) => setSelectedLocation(e.target.value)}
                                className="w-full p-3 border-2 rounded-lg text-right text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                dir="rtl"
                                disabled={loading}
                                required
                            >
                                <option value="גדוד">גדוד</option>
                                <option value="מחסן">מחסן</option>
                                <option value="סדנא">סדנא</option>
                            </select>
                        </div>
                    )}

                    {/* Summary Card */}
                    {selectedKind && selectedName && (isRangeMode ? (startId && endId) : newId) && selectedLocation && (
                        <div className="bg-gradient-to-br from-blue-50 to-green-50 p-4 rounded-lg border-2 border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end mb-3">
                                <p className="font-bold text-lg">סיכום הפריט החדש:</p>
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">
                                        {isRangeMode ? `${startId} - ${endId} (${parseInt(endId) - parseInt(startId) + 1} פריטים)` : newId}
                                    </span>
                                    <span className="text-gray-600">מספר:</span>
                                    <Hash className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{selectedName}</span>
                                    <span className="text-gray-600">שם:</span>
                                    <Tag className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{selectedKind}</span>
                                    <span className="text-gray-600">סוג:</span>
                                    <Tag className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{selectedLocation}</span>
                                    <span className="text-gray-600">מיקום:</span>
                                    <MapPin className="w-4 h-4 text-red-600" />
                                </div>
                            </div>
                        </div>
                    )}

                    <DialogFooter className="flex gap-3 justify-start pt-6 border-t">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={() => {
                                handleReset();
                                onClose();
                            }}
                            disabled={loading}
                            className="flex items-center gap-2"
                        >
                            ביטול
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading || !selectedKind || !selectedName || (!isRangeMode && !newId) || (isRangeMode && (!startId || !endId)) || !selectedLocation}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="w-4 h-4" />
                            {loading ? "מוסיף..." : (isRangeMode ? "הוסף פריטים" : "הוסף פריט")}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddItemIdModal;
