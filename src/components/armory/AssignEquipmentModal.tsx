import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { X } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { usePermissions } from '@/contexts/PermissionsContext';

interface ArmoryItem {
  id: number;
  kind: string;
  name: string;
}

interface AssignEquipmentModalProps {
  soldierID: number;
  onClose: () => void;
  onAssignComplete: () => void;
}

const AssignEquipmentModal: React.FC<AssignEquipmentModalProps> = ({ soldierID, onClose, onAssignComplete }) => {
  const { permissions } = usePermissions();
  const [availableItems, setAvailableItems] = useState<ArmoryItem[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [names, setNames] = useState<string[]>([]);
  const [ids, setIds] = useState<number[]>([]);
  
  const [selectedKind, setSelectedKind] = useState<string>('');
  const [selectedName, setSelectedName] = useState<string>('');
  const [selectedId, setSelectedId] = useState<number | null>(null);
  const [signature, setSignature] = useState<string>('');
  
  const [loading, setLoading] = useState(true);
  const sigPadRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    fetchAvailableItems();
  }, []);

  useEffect(() => {
    if (selectedKind) {
      const filteredNames = [...new Set(availableItems.filter(item => item.kind === selectedKind).map(item => item.name))];
      setNames(filteredNames);
      setSelectedName('');
      setSelectedId(null);
    }
  }, [selectedKind, availableItems]);

  useEffect(() => {
    if (selectedKind && selectedName) {
      const filteredIds = availableItems.filter(item => item.kind === selectedKind && item.name === selectedName).map(item => item.id);
      setIds(filteredIds);
      setSelectedId(null);
    }
  }, [selectedName, selectedKind, availableItems]);

  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from('armory_items')
        .select('*')
        .eq('location', 'גדוד');

      if (error) throw error;
      
      setAvailableItems((data as any[]) || []);
      const uniqueKinds = [...new Set((data as any[])?.map(item => item.kind as string) || [])];
      setKinds(uniqueKinds);
    } catch (error) {
      console.error('Error fetching available items:', error);
      alert('שגיאה בטעינת הציוד הזמין');
    } finally {
      setLoading(false);
    }
  };

  const saveSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      const dataURL = sigPadRef.current.getCanvas().toDataURL('image/png');
      setSignature(dataURL);
    }
  };

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setSignature('');
    }
  };

  const handleAssign = async () => {
    if (!selectedId) {
      alert('אנא בחר פריט');
      return;
    }

    // Check if weapon requires signature
    if (selectedKind === 'נשק' && !signature) {
      alert('נדרשת חתימה עבור נשק');
      return;
    }

    try {
      const currentTime = new Date().toLocaleString('he-IL');
      
      const updateData: any = { location: soldierID };
      
      // Add signature fields for weapons
      if (selectedKind === 'נשק') {
        updateData.logistic_name = permissions['name'] || '';
        updateData.logistic_sign = permissions['signature'] || '';
        updateData.people_sign = signature;
        updateData.sign_time = currentTime;
        updateData.logistic_id = permissions['id'] || '';
      }

      const { error } = await supabase
        .from('armory_items')
        .update(updateData)
        .eq('id', selectedId);

      if (error) throw error;

      alert('הפריט הוקצה בהצלחה');
      onAssignComplete();
    } catch (error) {
      console.error('Error assigning item:', error);
      alert('שגיאה בהקצאת הפריט');
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">התממת אמצעי</h2>
          <X className="w-6 h-6 cursor-pointer" onClick={onClose} />
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="space-y-4 mb-4">
              <div>
                <label className="block mb-2 font-semibold">סוג:</label>
                <select className="w-full border rounded px-3 py-2" value={selectedKind} onChange={(e) => setSelectedKind(e.target.value)}>
                  <option value="">-- בחר סוג --</option>
                  {kinds.map((kind) => (
                    <option key={kind} value={kind}>{kind}</option>
                  ))}
                </select>
              </div>

              {selectedKind && (
                <div>
                  <label className="block mb-2 font-semibold">שם:</label>
                  <select className="w-full border rounded px-3 py-2" value={selectedName} onChange={(e) => setSelectedName(e.target.value)}>
                    <option value="">-- בחר שם --</option>
                    {names.map((name) => (
                      <option key={name} value={name}>{name}</option>
                    ))}
                  </select>
                </div>
              )}

              {selectedName && (
                <div>
                  <label className="block mb-2 font-semibold">מספר סידורי:</label>
                  <Combobox
                    value={selectedId}
                    onValueChange={(value) => setSelectedId(Number(value))}
                    options={ids.map((id) => ({ value: id, label: String(id) }))}
                    placeholder="-- בחר מספר --"
                    searchPlaceholder="חפש מספר..."
                    emptyText="לא נמצאו תוצאות"
                  />
                </div>
              )}

              {/* Signature for weapons */}
              {selectedKind === 'נשק' && selectedId && (
                <div className="space-y-2">
                  <label className="block font-semibold">חתימה <span className="text-red-500">*</span></label>
                  <SignatureCanvas
                    ref={sigPadRef}
                    penColor="black"
                    onEnd={saveSignature}
                    canvasProps={{
                      width: 400,
                      height: 150,
                      className: "border border-gray-300 rounded w-full",
                      style: { direction: "ltr" },
                    }}
                    clearOnResize={false}
                    backgroundColor="white"
                  />
                  <div className="flex justify-end">
                    <button
                      type="button"
                      onClick={clearSignature}
                      className="text-sm text-red-600 hover:underline"
                    >
                      נקה חתימה
                    </button>
                  </div>
                </div>
              )}
            </div>

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>ביטול</Button>
              <Button onClick={handleAssign} className="bg-green-500 hover:bg-green-600 text-white">הקצה</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default AssignEquipmentModal;
