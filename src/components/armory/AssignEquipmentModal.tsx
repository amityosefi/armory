import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Combobox } from '@/components/ui/combobox';
import { X, Plus, Trash } from 'lucide-react';
import SignatureCanvas from 'react-signature-canvas';
import { usePermissions } from '@/contexts/PermissionsContext';

interface ArmoryItem {
  id: number;
  kind: string;
  name: string;
}

interface SelectedItem {
  kind: string;
  name: string;
  id: number | null;
}

interface AssignEquipmentModalProps {
  soldierName: string;
  soldierID: number;
  onClose: () => void;
  onAssignComplete: (message: string, isSuccess: boolean) => void;
}

const AssignEquipmentModal: React.FC<AssignEquipmentModalProps> = ({ soldierName, soldierID, onClose, onAssignComplete }) => {
  const { permissions } = usePermissions();
  const [availableItems, setAvailableItems] = useState<ArmoryItem[]>([]);
  const [kinds, setKinds] = useState<string[]>([]);
  const [signature, setSignature] = useState<string>('');

  const [selectedItems, setSelectedItems] = useState<SelectedItem[]>([{ kind: '', name: '', id: null }]);

  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const sigPadRef = useRef<SignatureCanvas>(null);

  // IDs already picked in other rows (to prevent duplicates)
  const pickedIds = selectedItems.map(item => item.id).filter(Boolean) as number[];

  useEffect(() => {
    fetchAvailableItems();
  }, []);

  const fetchAvailableItems = async () => {
    try {
      const { data, error } = await supabase
        .from('armory_items')
        .select('id, kind, name')
        .eq('location', 'גדוד');

      if (error) throw error;

      const items = (data as ArmoryItem[]) || [];
      setAvailableItems(items);
      const uniqueKinds = [...new Set(items.map(item => item.kind))];
      setKinds(uniqueKinds);
    } catch (error) {
      console.error('Error fetching available items:', error);
      onAssignComplete('שגיאה בטעינת הציוד הזמין', false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const getNamesForKind = (kind: string) => {
    return [...new Set(availableItems.filter(item => item.kind === kind).map(item => item.name))];
  };

  const getIdsForKindAndName = (kind: string, name: string, rowIndex: number) => {
    return availableItems
      .filter(item => item.kind === kind && item.name === name)
      .map(item => item.id)
      .filter(id => !pickedIds.includes(id) || selectedItems[rowIndex].id === id);
  };

  const updateItem = (index: number, updates: Partial<SelectedItem>) => {
    const newItems = [...selectedItems];
    newItems[index] = { ...newItems[index], ...updates };
    // Reset dependent fields
    if ('kind' in updates) {
      newItems[index].name = '';
      newItems[index].id = null;
    }
    if ('name' in updates) {
      newItems[index].id = null;
    }
    setSelectedItems(newItems);
  };

  const addItem = () => {
    setSelectedItems([...selectedItems, { kind: '', name: '', id: null }]);
  };

  const removeItem = (index: number) => {
    setSelectedItems(selectedItems.filter((_, i) => i !== index));
  };

  const saveSignature = () => {
    if (sigPadRef.current && !sigPadRef.current.isEmpty()) {
      setSignature(sigPadRef.current.getCanvas().toDataURL('image/png'));
    }
  };

  const clearSignature = () => {
    if (sigPadRef.current) {
      sigPadRef.current.clear();
      setSignature('');
    }
  };

  const validItems = selectedItems.filter(item => item.id !== null);
  const hasWeapon = selectedItems.some(item => item.kind === 'נשק' && item.id);
  const canSubmit = validItems.length > 0 && (!hasWeapon || signature);

  const handleAssign = async () => {
    if (validItems.length === 0) {
      onAssignComplete('אנא בחר לפחות פריט אחד', false);
      return;
    }

    if (hasWeapon && !signature) {
      onAssignComplete('נדרשת חתימה עבור נשק', false);
      return;
    }

    setSubmitting(true);
    try {
      const currentTime = new Date().toLocaleString('he-IL');
      const messages: string[] = [];

      for (const item of validItems) {
        const updateData: any = { location: soldierID };

        if (item.kind === 'נשק') {
          updateData.logistic_name = permissions['name'] ? String(permissions['name']) : '';
          updateData.logistic_sign = permissions['signature'] ? String(permissions['signature']) : '';
          updateData.people_sign = signature;
          updateData.sign_time = currentTime;
          updateData.logistic_id = permissions['id'] ? String(permissions['id']) : '';
        }

        const { error } = await supabase
          .from('armory_items')
          .update(updateData)
          .eq('id', item.id!)
          .eq('kind', item.kind)
          .eq('name', item.name);

        if (error) throw error;

        messages.push(`${item.name} מסד ${item.id}`);
      }

      const message = `החייל ${soldierName} מספר אישי ${soldierID} חתם על: ${messages.join(', ')}`;

      // Log to armory_document
      await supabase.from('armory_document').insert({
        'משתמש': permissions['name'] ? String(permissions['name']) : 'Unknown',
        'תאריך': currentTime,
        'הודעה': message
      });

      onAssignComplete(message, true);
    } catch (error) {
      console.error('Error assigning items:', error);
      onAssignComplete('שגיאה בהקצאת פריטים', false);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4" dir="rtl">
      <div className="bg-white rounded-2xl shadow-2xl max-w-lg w-full max-h-[90vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-l from-green-600 to-green-700 px-5 py-4 flex justify-between items-center shrink-0">
          <h2 className="text-lg font-bold text-white">החתמת אמצעי - {soldierName}</h2>
          <button onClick={onClose} className="text-white hover:bg-green-800 rounded-full p-1 transition-colors">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto px-5 py-4">
          {loading ? (
            <div className="flex justify-center py-8">
              <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-green-500"></div>
            </div>
          ) : (
            <div className="space-y-3">
              {selectedItems.map((item, index) => (
                <div key={index} className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-3 relative">
                  {selectedItems.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeItem(index)}
                      className="absolute top-2 left-2 p-1.5 text-red-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                    >
                      <Trash className="h-4 w-4" />
                    </button>
                  )}

                  <div>
                    <label className="block mb-1.5 text-sm font-medium text-gray-700">סוג:</label>
                    <select
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                      value={item.kind}
                      onChange={(e) => updateItem(index, { kind: e.target.value })}
                    >
                      <option value="">-- בחר סוג --</option>
                      {kinds.map((kind) => (
                        <option key={kind} value={kind}>{kind}</option>
                      ))}
                    </select>
                  </div>

                  {item.kind && (
                    <div>
                      <label className="block mb-1.5 text-sm font-medium text-gray-700">שם:</label>
                      <select
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right focus:ring-2 focus:ring-green-500 focus:border-transparent outline-none"
                        value={item.name}
                        onChange={(e) => updateItem(index, { name: e.target.value })}
                      >
                        <option value="">-- בחר שם --</option>
                        {getNamesForKind(item.kind).map((name) => (
                          <option key={name} value={name}>{name}</option>
                        ))}
                      </select>
                    </div>
                  )}

                  {item.kind && item.name && (
                    <div>
                      <label className="block mb-1.5 text-sm font-medium text-gray-700">מספר סידורי:</label>
                      <Combobox
                        value={item.id}
                        onValueChange={(value) => updateItem(index, { id: Number(value) })}
                        options={getIdsForKindAndName(item.kind, item.name, index).map((id) => ({ value: id, label: String(id) }))}
                        placeholder="-- בחר מספר --"
                        searchPlaceholder="חפש מספר..."
                        emptyText="לא נמצאו תוצאות"
                      />
                    </div>
                  )}
                </div>
              ))}

              {/* Add another item */}
              <Button
                type="button"
                variant="outline"
                onClick={addItem}
                className="w-full border-dashed border-2 hover:border-green-400 hover:bg-green-50 transition-colors h-11"
              >
                <Plus className="h-4 w-4 ml-2" />
                הוסף פריט נוסף
              </Button>

              {/* Signature for weapons */}
              {hasWeapon && (
                <div className="bg-gray-50 border border-gray-200 rounded-xl p-4 space-y-2">
                  <label className="block text-sm font-medium text-gray-700">חתימה <span className="text-red-500">*</span></label>
                  <div className="border-2 border-gray-300 rounded-xl overflow-hidden bg-white">
                    <SignatureCanvas
                      ref={sigPadRef}
                      penColor="black"
                      onEnd={saveSignature}
                      canvasProps={{
                        className: "w-full",
                        style: { direction: "ltr", height: '150px', width: '100%', touchAction: 'none' },
                      }}
                      clearOnResize={false}
                      backgroundColor="white"
                    />
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={clearSignature}
                    className="text-gray-500 hover:text-red-500"
                  >
                    נקה חתימה
                  </Button>
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        {!loading && (
          <div className="border-t bg-gray-50 px-5 py-3 flex gap-3 justify-end shrink-0">
            <Button variant="outline" onClick={onClose} disabled={submitting}>ביטול</Button>
            <Button
              onClick={handleAssign}
              className="bg-green-600 hover:bg-green-700 text-white flex items-center gap-2 min-w-[100px]"
              disabled={submitting || !canSubmit}
            >
              {submitting && <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>}
              {submitting ? 'מקצה...' : `הקצה (${validItems.length})`}
            </Button>
          </div>
        )}
      </div>
    </div>
  );
};

export default AssignEquipmentModal;
