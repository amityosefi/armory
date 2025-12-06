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
import { Trash2, Save, X, Edit3, Hash, MapPin } from "lucide-react";

interface EditItemModalProps {
    isOpen: boolean;
    onClose: () => void;
    itemId: number;
    currentLocation: string;
    onSuccess: (message: string) => void;
    onError: (message: string) => void;
}

const EditItemModal: React.FC<EditItemModalProps> = ({
    isOpen,
    onClose,
    itemId,
    onSuccess,
    onError,
}) => {
    const [itemData, setItemData] = useState<{
        id: number;
        name: string;
        kind: string;
        location: string;
    } | null>(null);
    const [loading, setLoading] = useState(false);
    const [formData, setFormData] = useState({
        id: itemId,
        name: "",
        kind: "",
        location: "",
    });

    // Fetch item data when modal opens
    useEffect(() => {
        if (isOpen && itemId) {
            fetchItemData();
        }
    }, [isOpen, itemId]);

    const fetchItemData = async () => {
        try {
            setLoading(true);
            const { data, error } = await supabase
                .from("armory_items")
                .select("id, name, kind, location")
                .eq("id", itemId)
                .single();

            if (error) throw error;

            if (data) {
                const typedData = data as { id: number; name: string; kind: string; location: string; };
                setItemData(typedData);
                setFormData({
                    id: typedData.id,
                    name: typedData.name || "",
                    kind: typedData.kind || "",
                    location: typedData.location || "",
                });
            }
        } catch (err: any) {
            console.error("Error fetching item:", err);
            onError(`שגיאה בטעינת פריט: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        
        // Check if any field has changed
        if (itemData && 
            formData.name === itemData.name && 
            formData.id === itemData.id && 
            formData.kind === itemData.kind && 
            formData.location === itemData.location) {
            onError("לא בוצעו שינויים");
            return;
        }
        
        try {
            setLoading(true);

            const { error } = await supabase
                .from("armory_items")
                .update({
                    id: formData.id,
                    name: formData.name,
                    kind: formData.kind,
                    location: formData.location,
                })
                .eq("id", itemId);

            if (error) throw error;

            // Build detailed success message
            let changes = [];
            if (itemData) {
                if (formData.id !== itemData.id) changes.push(`מסד: ${formData.id} ← ${itemData.id}`);
                if (formData.name !== itemData.name) changes.push(`שם: ${formData.name} ← ${itemData.name}`);
                if (formData.kind !== itemData.kind) changes.push(`סוג: ${formData.kind} ← ${itemData.kind}`);
                if (formData.location !== itemData.location) changes.push(`מיקום: ${formData.location} ← ${itemData.location}`);
            }
            
            const changeDetails = changes.length > 0 ? ` | שינויים: ${changes.join(', ')}` : '';
            onSuccess(`פריט ${formData.id} - ${formData.name} עודכן בהצלחה${changeDetails}`);
            onClose();
        } catch (err: any) {
            console.error("Error updating item:", err);
            onError(`שגיאה בעדכון פריט: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async () => {
        const itemName = itemData?.name || '';
        const itemLocation = itemData?.location || '';
        try {
            setLoading(true);

            const { error } = await supabase
                .from("armory_items")
                .delete()
                .eq("id", itemId);

            if (error) throw error;

            onSuccess(`פריט ${itemId} - ${itemName} נמחק בהצלחה | מיקום קודם: ${itemLocation}`);
            onClose();
        } catch (err: any) {
            console.error("Error deleting item:", err);
            onError(`שגיאה במחיקת פריט: ${err.message}`);
        } finally {
            setLoading(false);
        }
    };


    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="sm:max-w-[550px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <div className="flex items-center gap-3 justify-end">
                        <div className="text-right">
                            <DialogTitle className="text-2xl font-bold flex items-center gap-2 justify-end">
                                <span>{itemData?.name || "טוען..."}</span>
                                <Edit3 className="w-6 h-6 text-blue-600" />
                            </DialogTitle>
                            {itemData && (
                                <DialogDescription className="text-right mt-1 text-gray-600">
                                    מספר פריט: {itemId}
                                </DialogDescription>
                            )}
                        </div>
                    </div>
                </DialogHeader>

                {loading && !itemData ? (
                    <div className="text-center py-12">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mx-auto"></div>
                        <p className="mt-4 text-gray-600">טוען נתוני פריט...</p>
                    </div>
                ) : (
                    <form onSubmit={handleSubmit} className="space-y-6">
                        {/* ID Field with Icon */}
                        <div className="space-y-2">
                            <Label htmlFor="id" className="text-right flex items-center gap-2 justify-end font-semibold text-base">
                                <span>מספר פריט</span>
                                <Hash className="w-4 h-4 text-blue-600" />
                            </Label>
                            <div className="relative">
                                <Input
                                    id="id"
                                    name="id"
                                    type="number"
                                    value={formData.id}
                                    onChange={(e) => setFormData({ ...formData, id: parseInt(e.target.value) || itemId })}
                                    className="text-right pr-10 text-lg font-semibold"
                                    dir="rtl"
                                    disabled={loading}
                                    required
                                />
                                <Hash className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                            </div>
                            {itemData && formData.id !== itemData.id && (
                                <p className="text-xs text-orange-600 text-right">
                                    ⚠️ שימו לב: שינוי מספר הפריט מ-{itemData.id} ל-{formData.id}
                                </p>
                            )}
                        </div>

                        {/* Location Field with Icon */}
                        <div className="space-y-2">
                            <Label htmlFor="location" className="text-right flex items-center gap-2 justify-end font-semibold text-base">
                                <span>מיקום</span>
                                <MapPin className="w-4 h-4 text-red-600" />
                            </Label>
                            <select
                                id="location"
                                name="location"
                                value={formData.location}
                                onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                className="w-full p-3 border rounded-md text-right text-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                                dir="rtl"
                                disabled={loading}
                                required
                            >
                                <option value="">בחר מיקום</option>
                                <option value="גדוד">גדוד</option>
                                <option value="מחסן">מחסן</option>
                                <option value="סדנא">סדנא</option>
                            </select>
                        </div>

                        <DialogFooter className="flex gap-3 justify-start pt-6 border-t">
                            <Button
                                type="button"
                                variant="outline"
                                onClick={onClose}
                                disabled={loading}
                                className="flex items-center gap-2"
                            >
                                <X className="w-4 h-4" />
                                ביטול
                            </Button>
                            <Button
                                type="button"
                                variant="destructive"
                                onClick={handleDelete}
                                disabled={loading}
                                className="flex items-center gap-2 bg-red-600 hover:bg-red-700"
                            >
                                <Trash2 className="w-4 h-4" />
                                מחק פריט
                            </Button>
                            <Button
                                type="submit"
                                disabled={loading}
                                className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700"
                            >
                                <Save className="w-4 h-4" />
                                {loading ? "שומר..." : "שמור שינויים"}
                            </Button>
                        </DialogFooter>
                    </form>
                )}
            </DialogContent>
        </Dialog>
    );
};

export default EditItemModal;
