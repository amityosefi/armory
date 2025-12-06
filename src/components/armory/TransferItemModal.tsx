import React, { useEffect, useState, useRef } from 'react';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';
import SignatureCanvas from 'react-signature-canvas';

interface ArmoryItem {
  id: number;
  kind: string;
  location: string | number;
  is_save: boolean;
  name: string;
}

interface Person {
  id: number;
  name: string;
  location: string;
}

interface TransferItemModalProps {
  item: ArmoryItem;
  currentLocation: string;
  onClose: () => void;
  onTransferComplete: (message: string, isSuccess: boolean) => void;
}

const TransferItemModal: React.FC<TransferItemModalProps> = ({ item, currentLocation, onClose, onTransferComplete }) => {
  const { permissions } = usePermissions();
  const [people, setPeople] = useState<Person[]>([]);
  const [selectedPersonId, setSelectedPersonId] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const sigPadRef = useRef<SignatureCanvas>(null);

  useEffect(() => {
    fetchPeopleInLocation();
  }, [currentLocation]);

  const fetchPeopleInLocation = async () => {
    try {
      const { data, error } = await supabase
        .from('people')
        .select('id, name, location')
        .eq('location', currentLocation);

      if (error) throw error;
      
      // Sort people by name
      const sortedPeople = (data || []) as Person[];
      setPeople(sortedPeople.sort((a, b) => a.name.localeCompare(b.name, 'he')));
    } catch (error) {
      console.error('Error fetching people:', error);
      onTransferComplete('שגיאה בטעינת רשימת החיילים', false);
      onClose();
    } finally {
      setLoading(false);
    }
  };

  const handleClearSignature = () => {
    sigPadRef.current?.clear();
    setError('');
  };

  const handleTransfer = async () => {
    if (!selectedPersonId) {
      onTransferComplete('אנא בחר חייל', false);
      return;
    }

    // Check signature for weapons
    if (item.kind === 'נשק' && sigPadRef.current?.isEmpty()) {
      setError('נא לחתום לפני ההעברה');
      return;
    }
    
    try {
      const selectedPerson = people.find(p => p.id === selectedPersonId);
      const currentTime = new Date().toLocaleString('he-IL');
      
      // Prepare update data
      const updateData: any = {
        location: selectedPersonId,
        sign_time: currentTime
      };

      // Add signature data for weapons
      if (item.kind === 'נשק') {
        const signature = sigPadRef.current?.toDataURL();
        updateData.people_sign = signature || '';
      }

        updateData.logistic_sign = permissions['signature'] ? String(permissions['signature']) : '';
        updateData.logistic_name = permissions['name'] ? String(permissions['name']) : '';
        updateData.logistic_id = permissions['id'] ? String(permissions['id']) : '';
      
      const { error: updateError } = await supabase
        .from('armory_items')
        .update(updateData)
        .eq('id', item.id)
        .eq('kind', item.kind)
        .eq('name', item.name);

      if (updateError) throw updateError;

      const message = `הועבר ${item.name} (מסד: ${item.id}) לחייל ${selectedPerson?.name} (מספר אישי ${selectedPersonId})`;
      
      // Log to armory_document
      await supabase.from('armory_document').insert({
        'משתמש': permissions['name'] || 'Unknown',
        'תאריך': currentTime,
        'הודעה': message
      });
      
      onTransferComplete(message, true);
    } catch (error) {
      console.error('Error transferring item:', error);
      onTransferComplete(`שגיאה בהעברת ${item.name} (מסד: ${item.id})`, false);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50" dir="rtl">
      <div className="bg-white rounded-lg p-6 max-w-md w-full">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">העבר פריט</h2>
          <X className="w-6 h-6 cursor-pointer" onClick={onClose} />
        </div>

        <div className="mb-4">
          <p className="mb-2"><strong>פריט:</strong> {item.name} (#{item.id})</p>
          <p className="mb-4"><strong>סוג:</strong> {item.kind}</p>
        </div>

        {loading ? (
          <div className="flex justify-center py-4">
            <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-blue-500"></div>
          </div>
        ) : (
          <>
            <div className="mb-4">
              <label className="block mb-2 font-semibold">בחר חייל:</label>
              <select className="w-full border rounded px-3 py-2" value={selectedPersonId || ''} onChange={(e) => setSelectedPersonId(parseInt(e.target.value))}>
                <option value="">-- בחר חייל --</option>
                {people.map((person) => (
                  <option key={person.id} value={person.id}>
                    {person.name} (מספר אישי: {person.id})
                  </option>
                ))}
              </select>
            </div>

            {item.kind === 'נשק' && (
              <div className="mb-4">
                <label className="block text-sm font-medium mb-2">חתימת החייל:</label>
                <div className="border-2 border-gray-300 rounded">
                  <SignatureCanvas
                    ref={sigPadRef}
                    canvasProps={{
                      className: 'w-full h-40',
                      style: { touchAction: 'none' }
                    }}
                  />
                </div>
                {error && <p className="text-red-500 text-sm mt-1">{error}</p>}
                <Button 
                  onClick={handleClearSignature} 
                  variant="outline" 
                  className="mt-2 w-full"
                >
                  נקה חתימה
                </Button>
              </div>
            )}

            <div className="flex gap-3 justify-end">
              <Button variant="outline" onClick={onClose}>ביטול</Button>
              <Button onClick={handleTransfer} className="bg-green-500 hover:bg-green-600 text-white">העבר</Button>
            </div>
          </>
        )}
      </div>
    </div>
  );
};

export default TransferItemModal;
