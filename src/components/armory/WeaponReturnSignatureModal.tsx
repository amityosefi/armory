import React, { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Button } from '@/components/ui/button';
import { X } from 'lucide-react';
import { usePermissions } from '@/contexts/PermissionsContext';

interface ArmoryItem {
  id: number;
  name: string;
  kind: string;
}

interface WeaponReturnSignatureModalProps {
  item: ArmoryItem;
  onClose: () => void;
  onSubmit: (signature: string) => void;
}

const WeaponReturnSignatureModal: React.FC<WeaponReturnSignatureModalProps> = ({ item, onClose, onSubmit }) => {
  const sigPadRef = useRef<SignatureCanvas>(null);
  const [error, setError] = useState('');
  const { permissions } = usePermissions();

  const handleClear = () => {
    sigPadRef.current?.clear();
    setError('');
  };

  const handleSubmit = () => {
    if (sigPadRef.current?.isEmpty()) {
      setError('נא לחתום לפני השליחה');
      return;
    }

    const signature = sigPadRef.current?.toDataURL();
    if (signature) {
      onSubmit(signature);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full p-6">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold">החזרת נשק לאחסון</h2>
          <button onClick={onClose} className="text-gray-500 hover:text-gray-700">
            <X className="w-6 h-6" />
          </button>
        </div>

        <div className="mb-4 p-4 bg-blue-50 rounded">
          <p className="font-semibold">שם הפריט: {item.name}</p>
          <p className="text-gray-600">מספר: {item.id}</p>
        </div>

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
        </div>

        <div className="flex gap-2 justify-end">
          <Button onClick={handleClear} variant="outline">
            נקה חתימה
          </Button>
          <Button onClick={onClose} variant="outline">
            ביטול
          </Button>
          <Button onClick={handleSubmit} className="bg-blue-500 hover:bg-blue-600">
            אישור החזרה
          </Button>
        </div>
      </div>
    </div>
  );
};

export default WeaponReturnSignatureModal;
