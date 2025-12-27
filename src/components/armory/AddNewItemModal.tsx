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
import { Plus, Hash, Tag, CheckCircle2, MapPin, PackagePlus } from "lucide-react";

interface AddNewItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

const AddNewItemModal: React.FC<AddNewItemModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    onError,
}) => {
    const [loading, setLoading] = useState(false);
    const [kinds, setKinds] = useState<string[]>([]);
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        kind: "",
        location: "",
    });

    // Fetch unique kinds on mount
    useEffect(() => {
        if (isOpen) {
            fetchKinds();
        }
    }, [isOpen]);

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
        }
    };

    const handleIdChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const value = e.target.value;
        // Only allow digits
        if (value === "" || /^\d+$/.test(value)) {
            setFormData({ ...formData, id: value });
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        if (!formData.kind || !formData.name || !formData.id || !formData.location) {
            onError("אנא מלא את כל השדות");
            return;
        }

        try {
            setLoading(true);

            // Check if ID already exists
            const { data: existingItem } = await supabase
                .from("armory_items")
                .select("id")
                .eq("id", parseInt(formData.id))
                .eq("kind", parseInt(formData.kind))
                .eq("name", parseInt(formData.kind))
                .single();

            if (existingItem) {
                onError(`מסד ${formData.id} כבר קיים במערכת  עבור ${formData.kind} | ${formData.name}`);
                setLoading(false);
                return;
            }

            // Insert new item
            const { error } = await supabase
                .from("armory_items")
                .insert([
                    {
                        id: parseInt(formData.id),
                        name: formData.name,
                        kind: formData.kind,
                        location: formData.location,
                    },
                ]);

            if (error) throw error;

            onSuccess(`פריט חדש נוסף בהצלחה | סוג: ${formData.kind} | שם: ${formData.name} | צ: ${formData.id} | מיקום: ${formData.location}`);
            handleReset();
            onClose();
        } catch (err: any) {
            console.error("Error adding item:", err);
            
            // Check for duplicate key error
            if (err.code === '23505') {
                onError(`שגיאה: מסד ${formData.id} כבר קיים במערכת | שם: ${formData.name} | סוג: ${formData.kind}`);
            } else {
                onError(`שגיאה בהוספת פריט: ${formData.name}`);
                console.log(`שגיאה בהוספת פריט: ${err.message}`);
            }
            
            onClose();
        } finally {
            setLoading(false);
        }
    };

    const handleReset = () => {
        setFormData({ id: "", name: "", kind: "", location: "" });
    };

    const isStepComplete = (step: number) => {
        if (step === 1) return !!formData.kind;
        if (step === 2) return !!formData.name;
        if (step === 3) return !!formData.id;
        if (step === 4) return !!formData.location;
        return false;
    };

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[600px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2 justify-end">
                                <span>הוספת פריט חדש למערכת</span>
                                <PackagePlus className="w-6 h-6 text-green-600" />
                            </DialogTitle>
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
                            value={formData.kind}
                            onChange={(e) => setFormData({ ...formData, kind: e.target.value })}
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
                            <option value="ציוד">ציוד</option>
                        </select>
                    </div>

                    {/* Step 2: Name Input */}
                    {formData.kind && (
                        <div className="space-y-2 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end">
                                <Label className="text-right font-semibold text-base flex items-center gap-2">
                                    <span>שלב 2: הזן שם</span>
                                    {isStepComplete(2) && <CheckCircle2 className="w-5 h-5 text-green-600" />}
                                </Label>
                                <div className="flex items-center justify-center w-8 h-8 rounded-full bg-blue-100 text-blue-700 font-bold">
                                    2
                                </div>
                            </div>
                            <div className="relative">
                                <Input
                                    type="text"
                                    value={formData.name}
                                    onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                    className="text-right pr-10 text-lg border-2 focus:ring-2 focus:ring-blue-500"
                                    dir="rtl"
                                    disabled={loading}
                                    required
                                    placeholder="הזן שם הפריט"
                                />
                                <Tag className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                    )}

                    {/* Step 3: ID Input */}
                    {formData.kind && formData.name && (
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
                            <div className="relative">
                                <Input
                                    type="text"
                                    inputMode="numeric"
                                    pattern="\d*"
                                    value={formData.id}
                                    onChange={handleIdChange}
                                    className="text-right pr-10 text-lg font-semibold border-2 focus:ring-2 focus:ring-blue-500"
                                    dir="rtl"
                                    disabled={loading}
                                    required
                                    placeholder="הזן מספר (ספרות בלבד)"
                                />
                                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                        </div>
                    )}

                    {/* Step 4: Location Selection */}
                    {formData.kind && formData.name && formData.id && (
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
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full p-3 border-2 rounded-lg text-right text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all"
                                dir="rtl"
                                disabled={loading}
                                required
                            >
                                <option value="">-- בחר מיקום --</option>
                                <option value="גדוד">גדוד</option>
                                <option value="מחסן">מחסן</option>
                                <option value="סדנא">סדנא</option>
                            </select>
                        </div>
                    )}

                    {/* Summary Card */}
                    {formData.kind && formData.name && formData.id && formData.location && (
                        <div className="bg-gradient-to-br from-blue-50 to-green-50 p-4 rounded-lg border-2 border-blue-200 animate-in fade-in slide-in-from-top-2 duration-300">
                            <div className="flex items-center gap-2 justify-end mb-3">
                                <p className="font-bold text-lg">סיכום הפריט החדש:</p>
                                <CheckCircle2 className="w-6 h-6 text-green-600" />
                            </div>
                            <div className="space-y-2 text-right">
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{formData.id}</span>
                                    <span className="text-gray-600">מספר:</span>
                                    <Hash className="w-4 h-4 text-blue-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{formData.name}</span>
                                    <span className="text-gray-600">שם:</span>
                                    <Tag className="w-4 h-4 text-green-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{formData.kind}</span>
                                    <span className="text-gray-600">סוג:</span>
                                    <Tag className="w-4 h-4 text-purple-600" />
                                </div>
                                <div className="flex items-center gap-2 justify-end">
                                    <span className="font-semibold">{formData.location}</span>
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
                            disabled={loading || !formData.kind || !formData.name || !formData.id || !formData.location}
                            className="flex items-center gap-2 bg-green-600 hover:bg-green-700"
                        >
                            <Plus className="w-4 h-4" />
                            {loading ? "מוסיף..." : "הוסף פריט"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
    );
};

export default AddNewItemModal;
