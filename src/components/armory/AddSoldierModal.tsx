import React, { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabaseClient";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
    Dialog,
    DialogContent,
    DialogHeader,
    DialogTitle,
    DialogFooter,
} from "@/components/ui/dialog";
import { Combobox } from "@/components/ui/combobox";
import { X } from "lucide-react";
import SignatureCanvas from "react-signature-canvas";
import { sheetGroups } from "@/constants";
import { usePermissions } from "@/contexts/PermissionsContext";

interface AddSoldierModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: (message: string, isSuccess: boolean) => void;
    currentLocation: string;
}

interface ArmoryItem {
    id: number;
    kind: string;
    name: string;
}

interface SelectedItem {
    id: number;
    kind: string;
    name: string;
}

interface HRRecord {
    id: string;
    first: string;
    last: string;
    location: string;
}

const AddSoldierModal: React.FC<AddSoldierModalProps> = ({
    isOpen,
    onClose,
    onSuccess,
    currentLocation,
}) => {
    const { permissions } = usePermissions();
    const [formData, setFormData] = useState({
        id: "",
        name: "",
        phone: "",
        location: currentLocation,
        signature: "",
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState("");
    
    // Equipment selection states
    const [availableItems, setAvailableItems] = useState<ArmoryItem[]>([]);
    const [kinds, setKinds] = useState<string[]>([]);
    const [names, setNames] = useState<string[]>([]);
    const [ids, setIds] = useState<number[]>([]);
    const [selectedKind, setSelectedKind] = useState<string>("");
    const [selectedName, setSelectedName] = useState<string>("");
    const [selectedId, setSelectedId] = useState<number | null>(null);
    const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([]);
    const [loadingItems, setLoadingItems] = useState(false);
    
    // HR data states
    const [hrData, setHrData] = useState<HRRecord[]>([]);
    const [loadingHR, setLoadingHR] = useState(false);
    const [showWarningModal, setShowWarningModal] = useState(false);
    const [pendingSubmit, setPendingSubmit] = useState(false);
    const [showIdDropdown, setShowIdDropdown] = useState(false);
    const [filteredHRIds, setFilteredHRIds] = useState<HRRecord[]>([]);
    
    // Signature ref
    const sigPadRef = useRef<SignatureCanvas>(null);
    
    // Available locations from constants (excluding גדוד, סיכום, תיעוד)
    const availableLocations = sheetGroups
        .find(group => group.pathName === 'armory')
        ?.sheets.map(sheet => sheet.name)
        .filter(name => !['גדוד', 'סיכום', 'תיעוד'].includes(name)) || [];

    // Fetch available items and HR data when modal opens
    useEffect(() => {
        if (isOpen) {
            fetchAvailableItems();
            fetchHRData();
            setFormData(prev => ({ ...prev, location: currentLocation }));
        }
    }, [isOpen, currentLocation]);
    
    // Update names when kind changes
    useEffect(() => {
        if (selectedKind) {
            const filteredNames = [...new Set(availableItems.filter(item => item.kind === selectedKind).map(item => item.name))];
            setNames(filteredNames);
            setSelectedName("");
            setSelectedId(null);
        }
    }, [selectedKind, availableItems]);
    
    // Update IDs when name changes
    useEffect(() => {
        if (selectedKind && selectedName) {
            const filteredIds = availableItems.filter(item => item.kind === selectedKind && item.name === selectedName).map(item => item.id);
            setIds(filteredIds);
            setSelectedId(null);
        }
    }, [selectedName, selectedKind, availableItems]);
    
    // Auto-add item when ID is selected
    useEffect(() => {
        if (selectedId) {
            // Check if item already selected
            if (selectedItems.some(item => item.id === selectedId)) {
                alert('פריט זה כבר נבחר');
                setSelectedId(null);
                return;
            }
            
            const item = availableItems.find(i => i.id === selectedId);
            if (item) {
                setSelectedItems(prev => [...prev, item]);
                // Reset the ID selection to allow adding more items of same kind/name
                setSelectedId(null);
            }
        }
    }, [selectedId, availableItems, selectedItems]);

    const fetchAvailableItems = async () => {
        setLoadingItems(true);
        try {
            const { data, error } = await supabase
                .from('armory_items')
                .select('id, kind, name')
                .eq('location', 'גדוד');

            if (error) throw error;
            
            setAvailableItems((data as ArmoryItem[]) || []);
            const uniqueKinds = [...new Set((data as ArmoryItem[])?.map(item => item.kind) || [])];
            setKinds(uniqueKinds);
        } catch (error) {
            console.error('Error fetching available items:', error);
        } finally {
            setLoadingItems(false);
        }
    };
    
    const fetchHRData = async () => {
        setLoadingHR(true);
        try {
            const { data, error } = await supabase
                .from('hr')
                .select('id, first, last, location');

            if (error) throw error;
            setHrData((data as HRRecord[]) || []);
        } catch (error) {
            console.error('Error fetching HR data:', error);
        } finally {
            setLoadingHR(false);
        }
    };
    
    const mapHRLocationToSystem = (hrLocation: string): string => {
        if (!hrLocation) return '';
        
        const locationMap: { [key: string]: string } = {
            'מפקדת הגדוד': 'פלוגת מכלול',
            "פלוגה מבצעית א'": 'פלוגה א',
            "פלוגה מבצעית ב'": 'פלוגה ב',
            "פלוגה מבצעית ג'": 'פלוגה ג',
            'פלוגה מסייעת': 'פלוגת מסייעת',
            'פלס״ם': 'פלוגת פלסם',
            'פלס"ם': 'פלוגת פלסם',
            'פלסם': 'פלוגת פלסם',
            'פלוגת ניוד רק״ם': 'פלוגת אלון',
            'פלוגת ניוד רק"ם': 'פלוגת אלון'
        };
        
        // Try exact match first
        if (locationMap[hrLocation]) {
            return locationMap[hrLocation];
        }
        
        // Try trimmed version
        const trimmed = hrLocation.trim();
        if (locationMap[trimmed]) {
            return locationMap[trimmed];
        }
        
        // If no match found, log it for debugging and return original
        console.log('Unmapped HR location:', hrLocation);
        return hrLocation;
    };

    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const { name, value } = e.target;
        
        // For ID field, check if it matches HR data
        if (name === 'id') {
            // Only allow digits (0-9)
            if (value !== '' && !/^\d+$/.test(value)) {
                return; // Don't update if not a number
            }
            
            // Filter HR data based on input
            if (value) {
                const filtered = hrData.filter(record => String(record.id).startsWith(value));
                setFilteredHRIds(filtered);
                setShowIdDropdown(filtered.length > 0);
            } else {
                setFilteredHRIds([]);
                setShowIdDropdown(false);
            }
            
            // Check if ID exists in HR data (exact match)
            const hrRecord = hrData.find(record => String(record.id) === value);
            if (hrRecord) {
                // Auto-fill name and location
                const fullName = `${hrRecord.first} ${hrRecord.last}`;
                const mappedLocation = mapHRLocationToSystem(hrRecord.location);
                
                // Check if mapped location exists in available locations, otherwise use current location
                const finalLocation = availableLocations.includes(mappedLocation) ? mappedLocation : currentLocation;
                
                setFormData(prev => ({
                    ...prev,
                    id: value,
                    name: fullName,
                    location: finalLocation
                }));
                setShowIdDropdown(false);
                return;
            }
        }
        
        // For phone field, only allow numbers
        if (name === 'phone') {
            // Only allow digits (0-9)
            if (value !== '' && !/^\d+$/.test(value)) {
                return; // Don't update if not a number
            }
        }
        
        setFormData(prev => ({
            ...prev,
            [name]: value
        }));
    };
    
    const handleSelectHRId = (hrRecord: HRRecord) => {
        const fullName = `${hrRecord.first} ${hrRecord.last}`;
        const mappedLocation = mapHRLocationToSystem(hrRecord.location);
        
        // Check if mapped location exists in available locations, otherwise use current location
        const finalLocation = availableLocations.includes(mappedLocation) ? mappedLocation : currentLocation;
        
        setFormData(prev => ({
            ...prev,
            id: String(hrRecord.id),
            name: fullName,
            location: finalLocation
        }));
        setShowIdDropdown(false);
        setFilteredHRIds([]);
    };
    
    const handleLocationChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
        const fullLocation = e.target.value;
        
        setFormData(prev => ({
            ...prev,
            location: fullLocation
        }));
    };
    
    const handleAddItem = () => {
        if (!selectedId) {
            alert('אנא בחר פריט');
            return;
        }
        
        // Check if item already selected
        if (selectedItems.some(item => item.id === selectedId)) {
            alert('פריט זה כבר נבחר');
            return;
        }
        
        const item = availableItems.find(i => i.id === selectedId);
        if (item) {
            setSelectedItems(prev => [...prev, item]);
            // Only reset the ID selection to allow adding more items of same kind/name
            setSelectedId(null);
        }
    };
    
    const handleRemoveItem = (itemId: number) => {
        setSelectedItems(prev => prev.filter(item => item.id !== itemId));
    };
    
    const handleClearSelection = () => {
        setSelectedKind("");
        setSelectedName("");
        setSelectedId(null);
    };
    
    const saveSignature = () => {
        if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
            const dataURL = sigPadRef.current.getCanvas().toDataURL("image/png");
            setFormData((prev) => ({...prev, signature: dataURL}));
        }
    };
    
    const clearSignature = () => {
        if (sigPadRef.current) {
            sigPadRef.current.clear();
            setFormData((prev) => ({...prev, signature: ""}));
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setError("");

        // Ensure all fields are strings and validate
        const idStr = String(formData.id).trim();
        const nameStr = String(formData.name).trim();
        const phoneStr = String(formData.phone).trim();
        
        if (!idStr || !nameStr || !phoneStr) {
            setError("מספר אישי, שם ופלאפון הם שדות חובה");
            return;
        }
        
        // Check if soldier exists in HR data
        const hrRecord = hrData.find(record => String(record.id) === idStr);
        if (!hrRecord && !pendingSubmit) {
            // Show warning modal
            setShowWarningModal(true);
            return;
        }

        setLoading(true);
        setPendingSubmit(false);

        try {
            // Extract only the range letter from location (e.g., "ג" from "פלוגה ג")
            const match = formData.location.match(/\s+(\S+)$/);
            const locationRange = match ? match[1] : formData.location;
            
            // Insert new person into the database
            const { data: personData, error: insertError } = await supabase
                .from("people")
                .insert([
                    {
                        id: idStr,
                        name: nameStr,
                        phone: phoneStr,
                        location: locationRange,
                    }
                ])
                .select();

            if (insertError) {
                console.error("Error adding soldier:", insertError);
                const errorMsg = `שגיאה בהוספת חייל: ${insertError.message}`;
                setError(errorMsg);
                setLoading(false);
                return;
            }
            
            // Assign selected items to the soldier
            if (selectedItems.length > 0) {
                const currentTime = new Date().toLocaleString('he-IL');
                const soldierID = idStr;
                
                console.log('Assigning items to soldier:', soldierID);
                console.log('Selected items:', selectedItems.map(item => item.id));
                
                const { error: assignError } = await supabase
                    .from('armory_items')
                    .update({ 
                        location: soldierID,
                        logistic_name: permissions['name'] || '',
                        logistic_sign: permissions['signature'] || '',
                        logistic_id: permissions['id'] || '',
                        people_sign: formData.signature || '',
                        sign_time: currentTime
                    })
                    .in('id', selectedItems.map(item => item.id));
                    
                if (assignError) {
                    console.error("Error assigning items:", assignError);
                    const errorMsg = `חייל נוסף אך שגיאה בהקצאת ציוד: ${assignError.message}`;
                    setError(errorMsg);
                    setLoading(false);
                    onSuccess(errorMsg, false);
                    return;
                }
                
                console.log('Items assigned successfully to soldier:', soldierID);
            }

            // Success - reset form and notify parent
            const successMsg = `חייל ${nameStr} נוסף בהצלחה${selectedItems.length > 0 ? ` עם ${selectedItems.length} פריטי ציוד` : ''}`;
            setFormData({ id: "", name: "", phone: "", location: currentLocation, signature: "" });
            setSelectedItems([]);
            if (sigPadRef.current) {
                sigPadRef.current.clear();
            }
            setLoading(false);
            onSuccess(successMsg, true);
        } catch (err: any) {
            console.error("Unexpected error:", err);
            const errorMsg = `שגיאה לא צפויה: ${err.message}`;
            setError(errorMsg);
            setLoading(false);
        }
    };

    const handleClose = () => {
        if (!loading) {
            setFormData({ id: "", name: "", phone: "", location: currentLocation, signature: "" });
            setSelectedItems([]);
            setSelectedKind("");
            setSelectedName("");
            setSelectedId(null);
            setError("");
            setPendingSubmit(false);
            if (sigPadRef.current) {
                sigPadRef.current.clear();
            }
            onClose();
        }
    };
    
    const handleWarningConfirm = () => {
        setShowWarningModal(false);
        setPendingSubmit(true);
        // Trigger form submission
        const form = document.querySelector('form');
        if (form) {
            form.requestSubmit();
        }
    };
    
    const handleWarningCancel = () => {
        setShowWarningModal(false);
        setFormData({ id: "", name: "", phone: "", location: currentLocation, signature: "" });
        setSelectedItems([]);
        if (sigPadRef.current) {
            sigPadRef.current.clear();
        }
    };

    return (
        <>
        <Dialog open={isOpen} onOpenChange={handleClose}>
            <DialogContent className="sm:max-w-[500px] max-h-[90vh] overflow-y-auto" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right text-xl font-bold">
                        הוספת חייל חדש
                    </DialogTitle>
                </DialogHeader>

                <form onSubmit={handleSubmit} className="space-y-4">

                    <div className="space-y-2 relative">
                        <label htmlFor="id" className="text-right block font-semibold">
                            מספר אישי <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="id"
                            name="id"
                            type="text"
                            inputMode="numeric"
                            pattern="\d*"
                            value={formData.id}
                            onChange={handleInputChange}
                            onFocus={() => {
                                if (formData.id && filteredHRIds.length > 0) {
                                    setShowIdDropdown(true);
                                }
                            }}
                            onBlur={() => {
                                // Delay to allow click on dropdown item
                                setTimeout(() => setShowIdDropdown(false), 200);
                            }}
                            placeholder="הזן מספר אישי"
                            className="text-right"
                            dir="rtl"
                            disabled={loading}
                            required
                            autoComplete="off"
                        />
                        {showIdDropdown && filteredHRIds.length > 0 && (
                            <div className="absolute z-50 w-full mt-1 bg-white border border-gray-300 rounded-md shadow-lg max-h-60 overflow-y-auto">
                                {filteredHRIds.slice(0, 10).map((record) => (
                                    <div
                                        key={record.id}
                                        onClick={() => handleSelectHRId(record)}
                                        className="px-4 py-2 hover:bg-blue-50 cursor-pointer text-right border-b border-gray-100 last:border-b-0"
                                    >
                                        <div className="font-semibold">{record.id}</div>
                                        <div className="text-sm text-gray-600">{record.first} {record.last}</div>
                                        <div className="text-xs text-gray-500">{record.location}</div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="name" className="text-right block font-semibold">
                            שם <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="name"
                            name="name"
                            type="text"
                            value={formData.name}
                            onChange={handleInputChange}
                            placeholder="הזן שם מלא"
                            className="text-right"
                            dir="rtl"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="phone" className="text-right block font-semibold">
                            פלאפון <span className="text-red-500">*</span>
                        </label>
                        <Input
                            id="phone"
                            name="phone"
                            type="text"
                            inputMode="numeric"
                            pattern="\d*"
                            value={formData.phone}
                            onChange={handleInputChange}
                            placeholder="הזן מספר פלאפון"
                            className="text-right"
                            dir="rtl"
                            disabled={loading}
                            required
                        />
                    </div>

                    <div className="space-y-2">
                        <label htmlFor="location" className="text-right block font-semibold">
                            מיקום <span className="text-red-500">*</span>
                        </label>
                        <select
                            id="location"
                            name="location"
                            value={formData.location}
                            onChange={handleLocationChange}
                            className="w-full border rounded px-3 py-2 text-right"
                            dir="rtl"
                            disabled={loading}
                            required
                        >
                            {availableLocations.map((location) => (
                                <option key={location} value={location}>
                                    {location}
                                </option>
                            ))}
                        </select>
                    </div>
                    
                    {/* Equipment Selection */}
                    <div className="space-y-2">
                        <label className="text-right block font-semibold">
                            הקצאת ציוד (אופציונלי)
                        </label>
                        
                        {loadingItems ? (
                            <div className="flex justify-center py-2">
                                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-blue-500"></div>
                            </div>
                        ) : (
                            <div className="space-y-3">
                                <div className="flex items-end gap-2">
                                    <div className="flex-1">
                                        <label className="block mb-1 text-sm">סוג:</label>
                                        <select 
                                            className="w-full border rounded px-3 py-2 text-right" 
                                            value={selectedKind} 
                                            onChange={(e) => setSelectedKind(e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">-- בחר סוג --</option>
                                            {kinds.map((kind) => (
                                                <option key={kind} value={kind}>{kind}</option>
                                            ))}
                                        </select>
                                    </div>
                                    {selectedKind && (
                                        <Button
                                            type="button"
                                            variant="outline"
                                            onClick={handleClearSelection}
                                            disabled={loading}
                                            className="text-sm"
                                        >
                                            נקה בחירה
                                        </Button>
                                    )}
                                </div>

                                {selectedKind && (
                                    <div>
                                        <label className="block mb-1 text-sm">שם:</label>
                                        <select 
                                            className="w-full border rounded px-3 py-2 text-right" 
                                            value={selectedName} 
                                            onChange={(e) => setSelectedName(e.target.value)}
                                            disabled={loading}
                                        >
                                            <option value="">-- בחר שם --</option>
                                            {names.map((name) => (
                                                <option key={name} value={name}>{name}</option>
                                            ))}
                                        </select>
                                    </div>
                                )}

                                {selectedName && (
                                    <div>
                                        <label className="block mb-1 text-sm">מספר סידורי:</label>
                                        <Combobox
                                            value={selectedId}
                                            onValueChange={(value) => setSelectedId(Number(value))}
                                            options={ids.map((id) => ({ value: id, label: String(id) }))}
                                            placeholder="-- בחר מספר --"
                                            searchPlaceholder="חפש מספר..."
                                            emptyText="לא נמצאו תוצאות"
                                            disabled={loading}
                                        />
                                    </div>
                                )}
                                
                                {/* Selected Items List */}
                                {selectedItems.length > 0 && (
                                    <div className="mt-3">
                                        <label className="block mb-2 text-sm font-semibold">פריטים נבחרים:</label>
                                        <div className="space-y-2">
                                            {selectedItems.map((item) => (
                                                <div 
                                                    key={item.id} 
                                                    className="flex items-center justify-between p-2 bg-gray-50 rounded border"
                                                >
                                                    <button
                                                        type="button"
                                                        onClick={() => handleRemoveItem(item.id)}
                                                        className="text-red-500 hover:text-red-700"
                                                        disabled={loading}
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                    <span className="text-sm">
                                                        {item.kind} - {item.name} (#{item.id})
                                                    </span>
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                    
                    {/* Signature */}
                    <div className="space-y-2">
                        <label className="text-right block font-semibold">חתימה</label>
                        <SignatureCanvas
                            ref={sigPadRef}
                            penColor="black"
                            onEnd={saveSignature}
                            canvasProps={{
                                width: 450,
                                height: 150,
                                className: "border border-gray-300 rounded w-full",
                                style: {direction: "ltr"},
                            }}
                            clearOnResize={false}
                            backgroundColor="white"
                        />
                        <div className="flex justify-end">
                            <button
                                type="button"
                                onClick={clearSignature}
                                className="text-sm text-red-600 hover:underline"
                                disabled={loading}
                            >
                                נקה חתימה
                            </button>
                        </div>
                    </div>

                    {error && (
                        <div className="p-3 bg-red-100 border border-red-400 text-red-700 rounded text-right">
                            {error}
                        </div>
                    )}

                    <DialogFooter className="flex gap-2 justify-start">
                        <Button
                            type="button"
                            variant="outline"
                            onClick={handleClose}
                            disabled={loading}
                        >
                            ביטול
                        </Button>
                        <Button
                            type="submit"
                            disabled={loading}
                            className="bg-blue-600 hover:bg-blue-700"
                        >
                            {loading ? "מוסיף..." : "הוסף חייל"}
                        </Button>
                    </DialogFooter>
                </form>
            </DialogContent>
        </Dialog>
        
        {/* Warning Modal */}
        <Dialog open={showWarningModal} onOpenChange={() => setShowWarningModal(false)}>
            <DialogContent className="sm:max-w-[400px]" dir="rtl">
                <DialogHeader>
                    <DialogTitle className="text-right text-xl font-bold text-red-600">
                        אזהרה
                    </DialogTitle>
                </DialogHeader>
                <div className="py-4 text-right">
                    <p className="text-lg">חייל זה לא נמצא בדוח 1, האם אתה בטוח שתרצה לאשר את ההחתמה?</p>
                </div>
                <DialogFooter className="flex gap-2 justify-start">
                    <Button
                        type="button"
                        variant="outline"
                        onClick={handleWarningCancel}
                    >
                        ביטול
                    </Button>
                    <Button
                        type="button"
                        onClick={handleWarningConfirm}
                        className="bg-red-600 hover:bg-red-700"
                    >
                        אישור
                    </Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
        </>
    );
};

export default AddSoldierModal;
