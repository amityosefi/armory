import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Pencil, ArrowRightLeft, Download, Ban, PenLine, Home, Wrench } from 'lucide-react';
import TransferItemModal from './TransferItemModal';
import AssignEquipmentModal from './AssignEquipmentModal';
import WeaponReturnSignatureModal from './WeaponReturnSignatureModal';
import { exportSoldierPDF } from './SoldierPDFExport';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import useIsMobile from '@/hooks/useIsMobile';
import { usePermissions } from '@/contexts/PermissionsContext';

interface Person {
  id: number;
  name: string;
  phone: string;
  location: string;
}

interface ArmoryItem {
  id: number;
  kind: string;
  location: string | number;
  is_save: boolean;
  name: string;
  people_sign?: string;
  sign_time?: string;
  logistic_sign?: string;
  logistic_name?: string;
  logistic_id?: string;
}

const SoldierArmoryPage: React.FC = () => {
  const { soldierID } = useParams<{ soldierID: string }>();
  const navigate = useNavigate();
  
  const [soldier, setSoldier] = useState<Person | null>(null);
  const [armoryItems, setArmoryItems] = useState<ArmoryItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [editMode, setEditMode] = useState<{ [key: string]: boolean }>({});
  const [editValues, setEditValues] = useState<Partial<Person>>({});
  
  const [transferModalOpen, setTransferModalOpen] = useState(false);
  const [selectedItemForTransfer, setSelectedItemForTransfer] = useState<ArmoryItem | null>(null);
  const [assignModalOpen, setAssignModalOpen] = useState(false);
  const [weaponReturnModalOpen, setWeaponReturnModalOpen] = useState(false);
  const [selectedWeaponForReturn, setSelectedWeaponForReturn] = useState<ArmoryItem | null>(null);
  const [statusMessage, setStatusMessage] = useState({ text: '', isSuccess: false });
  const isMobile = useIsMobile();
  const { permissions } = usePermissions();

  const plugotOptions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם'];

  // Helper function to log successful actions to armory_document
  const logToArmoryDocument = async (message: string) => {
    try {
      await supabase.from('armory_document').insert({
        'משתמש': permissions['name'] || 'Unknown',
        'תאריך': new Date().toLocaleString('he-IL'),
        'הודעה': message
      });
    } catch (error) {
      console.error('Error logging to armory_document:', error);
    }
  };

  useEffect(() => {
    if (soldierID) {
      fetchSoldierData();
    }
  }, [soldierID]);

  const fetchSoldierData = async () => {
    try {
      setLoading(true);
      
      const { data, error } = await supabase
        .from('people')
        .select('*')
        .eq('id', soldierID!)
        .single();

      if (error) throw error;
      setSoldier(data as unknown as Person);
      setEditValues(data as unknown as Person);

      const { data: itemsData, error: itemsError } = await supabase
        .from('armory_items')
        .select('*')
        .eq('location', soldierID!);

      if (itemsError) throw itemsError;
      setArmoryItems((itemsData as unknown as ArmoryItem[]) || []);
    } catch (error) {
      console.error('Error fetching soldier data:', error);
      alert('שגיאה בטעינת נתוני החייל');
    } finally {
      setLoading(false);
    }
  };

  const handleEditField = (field: keyof Person) => {
    setEditMode({ ...editMode, [field]: true });
  };

  const handleSaveField = async (field: keyof Person) => {
    try {
      const { error } = await supabase
        .from('people')
        .update({ [field]: editValues[field] })
        .eq('id', soldierID!);

      if (error) throw error;
      
      const fieldName = field === 'name' ? 'שם' : field === 'phone' ? 'פלאפון' : 'פלוגה';
      const message = `עודכן ${fieldName} עבור חייל ${soldier?.name} (מספר אישי: ${soldier?.id}) ל: ${editValues[field]}`;
      
      setSoldier({ ...soldier!, [field]: editValues[field] });
      setEditMode({ ...editMode, [field]: false });
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
    } catch (error) {
      console.error('Error updating field:', error);
      const fieldName = field === 'name' ? 'שם' : field === 'phone' ? 'פלאפון' : 'פלוגה';
      setStatusMessage({ text: `שגיאה בעדכון ${fieldName} עבור חייל ${soldier?.name}`, isSuccess: false });
    }
  };

  const handleToggleSave = async (item: ArmoryItem) => {
    // Only show modal if changing from כן (true) to לא (false) for weapons
    if (item.is_save && item.kind === 'נשק') {
      setSelectedWeaponForReturn(item);
      setWeaponReturnModalOpen(true);
      return;
    }

    // For all other cases (weapons going from לא to כן, or non-weapons), proceed normally
    try {
      const { error } = await supabase
        .from('armory_items')
        .update({ is_save: !item.is_save })
        .eq('id', item.id);

      if (error) throw error;
      
      const newStatus = !item.is_save ? 'מאופסן' : 'לא מאופסן';
      const message = `סטטוס אחסון של ${item.name} (מספר: ${item.id}) עודכן ל${newStatus} עבור חייל ${soldier?.name}`;
      
      setArmoryItems(armoryItems.map(i => 
        i.id === item.id ? { ...i, is_save: !i.is_save } : i
      ));
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
    } catch (error) {
      console.error('Error toggling save status:', error);
      setStatusMessage({ text: `שגיאה בעדכון סטטוס אחסון עבור ${item.name} (מספר: ${item.id})`, isSuccess: false });
    }
  };

  const handleWeaponReturnSignature = async (signature: string) => {
    if (!selectedWeaponForReturn) return;

    try {
      const currentTime = new Date().toLocaleString('he-IL');
      
      const { error } = await supabase
        .from('armory_items')
        .update({ 
          is_save: false,
          sign_time: currentTime,
          people_sign: signature,
          logistic_sign: permissions['signature'] ? String(permissions['signature']) : '',
          logistic_name: permissions['name'] ? String(permissions['name']) : '',
          logistic_id: permissions['id'] ? String(permissions['id']) : ''
        })
        .eq('id', selectedWeaponForReturn.id);

      if (error) throw error;
      
      const message = `נשק ${selectedWeaponForReturn.name} (מספר: ${selectedWeaponForReturn.id}) הוחזר לאחסון עבור חייל ${soldier?.name}`;
      
      setArmoryItems(armoryItems.map(i => 
        i.id === selectedWeaponForReturn.id ? { 
          ...i, 
          is_save: false,
          sign_time: currentTime,
          people_sign: signature,
          logistic_sign: permissions['signature'] ? String(permissions['signature']) : '',
          logistic_name: permissions['name'] ? String(permissions['name']) : '',
          logistic_id: permissions['id'] ? String(permissions['id']) : ''
        } : i
      ));
      
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
      setWeaponReturnModalOpen(false);
      setSelectedWeaponForReturn(null);
    } catch (error) {
      console.error('Error returning weapon:', error);
      setStatusMessage({ text: `שגיאה בהחזרת נשק ${selectedWeaponForReturn.name}`, isSuccess: false });
    }
  };

  const handleTransferItem = (item: ArmoryItem) => {
    setSelectedItemForTransfer(item);
    setTransferModalOpen(true);
  };

  const handleReturnToBase = async (item: ArmoryItem, newLocation: string) => {
    try {
      const { error } = await supabase
        .from('armory_items')
        .update({ location: newLocation })
        .eq('id', item.id)
        .eq('kind', item.kind)
          .eq('name', item.name);

      if (error) throw error;
      
      const message = `הפריט ${item.name} (מספר: ${item.id}) הוחזר מחייל ${soldier?.name} ל${newLocation}`;
      
      setArmoryItems(armoryItems.filter(i => i.id !== item.id));
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
    } catch (error) {
      console.error('Error returning item:', error);
      setStatusMessage({ text: `שגיאה בהחזרת ${item.name} (מספר: ${item.id}) מחייל ${soldier?.name}`, isSuccess: false });
    }
  };

  const handleDischargeSoldier = async () => {

    try {
      const itemCount = armoryItems.length;
      const itemsList = armoryItems.map(item => `${item.name} (מספר: ${item.id})`).join(', ');
      
      const { error: itemsError } = await supabase
        .from('armory_items')
        .update({ location: 'גדוד' })
        .eq('location', soldierID!);

      if (itemsError) throw itemsError;

      const { error: deleteError } = await supabase
        .from('people')
        .delete()
        .eq('id', soldierID!);

      if (deleteError) throw deleteError;

      const message = `זוכה חייל ${soldier?.name} (מספר אישי: ${soldier?.id}). הוחזרו ${itemCount} פריטים: ${itemsList}`;
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
      setTimeout(() => navigate(-1), 1500);
    } catch (error) {
      console.error('Error discharging soldier:', error);
      setStatusMessage({ text: `שגיאה בזיכוי חייל ${soldier?.name}`, isSuccess: false });
    }
  };

  const handleExportPDF = () => {
    if (soldier) {
      exportSoldierPDF(soldier, armoryItems);
    }
  };

  const groupItemsByKind = () => {
    const grouped: { [key: string]: ArmoryItem[] } = {};
    armoryItems.forEach(item => {
      if (!grouped[item.kind]) {
        grouped[item.kind] = [];
      }
      grouped[item.kind].push(item);
    });
    return grouped;
  };

  if (loading) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
      </div>
    );
  }

  if (!soldier) {
    return (
      <div className="flex justify-center items-center min-h-screen">
        <p className="text-xl text-red-500">חייל לא נמצא</p>
      </div>
    );
  }

  const groupedItems = groupItemsByKind();

  return (
    <div className="w-full max-w-6xl mx-auto p-4" dir="rtl">
      <div className="bg-white rounded-lg shadow-md p-6 mb-4">
        <div className="flex justify-between items-center mb-4">
          <h1 className="text-2xl font-bold">דף חייל - {soldier.name}</h1>
          <Button onClick={() => navigate(-1)} variant="outline">חזור</Button>
        </div>

        <StatusMessage 
          isSuccess={statusMessage.isSuccess} 
          message={statusMessage.text} 
          onClose={() => setStatusMessage({ text: '', isSuccess: false })} 
        />

        <div className={`grid ${isMobile ? 'grid-cols-1' : 'grid-cols-2'} gap-4`}>
          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
            <span className="font-semibold">שם מלא:</span>
            {editMode.name ? (
              <div className="flex gap-2">
                <input type="text" value={editValues.name || ''} onChange={(e) => setEditValues({ ...editValues, name: e.target.value })} className="border rounded px-2 py-1 flex-1" />
                <Button size="sm" onClick={() => handleSaveField('name')}>שמור</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{soldier.name}</span>
                {permissions['admin'] && (
                  <Pencil className="w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700" onClick={() => handleEditField('name')} />
                )}
              </div>
            )}
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
            <span className="font-semibold">מספר אישי:</span>
            <span>{soldier.id}</span>
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
            <span className="font-semibold">פלאפון:</span>
            {editMode.phone ? (
              <div className="flex gap-2">
                <input type="text" value={editValues.phone || ''} onChange={(e) => setEditValues({ ...editValues, phone: e.target.value })} className="border rounded px-2 py-1 flex-1" />
                <Button size="sm" onClick={() => handleSaveField('phone')}>שמור</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{soldier.phone}</span>
                {permissions['admin'] && (
                  <Pencil className="w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700" onClick={() => handleEditField('phone')} />
                )}
              </div>
            )}
          </div>

          <div className={`flex ${isMobile ? 'flex-col' : 'items-center justify-between'} gap-2`}>
            <span className="font-semibold">פלוגה:</span>
            {editMode.location ? (
              <div className="flex gap-2">
                <select 
                  value={editValues.location || ''} 
                  onChange={(e) => setEditValues({ ...editValues, location: e.target.value })} 
                  className="border rounded px-2 py-1 flex-1"
                >
                  {plugotOptions.filter(opt => opt !== soldier.location).map(opt => (
                    <option key={opt} value={opt}>{opt}</option>
                  ))}
                </select>
                <Button size="sm" onClick={() => handleSaveField('location')}>שמור</Button>
              </div>
            ) : (
              <div className="flex items-center gap-2">
                <span>{soldier.location}</span>
                {permissions['admin'] && (
                  <Pencil className="w-4 h-4 cursor-pointer text-gray-500 hover:text-gray-700" onClick={() => handleEditField('location')} />
                )}
              </div>
            )}
          </div>
        </div>
      </div>

      <div className="flex gap-3 mb-4 justify-center flex-wrap">
        <Button onClick={handleExportPDF} className="bg-blue-500 hover:bg-blue-600 text-white flex items-center gap-2">
          <Download className="w-4 h-4" />
          ייצוא PDF
        </Button>
        {permissions['armory'] && (
          <>
            <Button onClick={() => setAssignModalOpen(true)} className="bg-green-500 hover:bg-green-600 text-white flex items-center gap-2">
              <PenLine className="w-4 h-4" />
              החתמת אמצעי
            </Button>
            <Button onClick={handleDischargeSoldier} className="bg-red-500 hover:bg-red-600 text-white flex items-center gap-2">
              <Ban className="w-4 h-4" />
              זיכוי חייל
            </Button>
          </>
        )}
      </div>

      {Object.entries(groupedItems).map(([kind, items]) => (
        <div key={kind} className="mb-6">
          <div className="bg-blue-600 text-white font-bold text-lg p-2 rounded-t-lg">{kind}</div>
          <div className="bg-white rounded-b-lg shadow-md overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-blue-100">
                <tr>
                  <th className="p-2 text-right w-8">#</th>
                  <th className="p-2 text-right w-24">שם</th>
                  <th className="p-2 text-right w-12">צ</th>
                  <th className="p-2 text-right w-16">מאופסן</th>
                  {permissions['armory'] && (
                    <th className="p-2 text-right w-32">פעולות</th>
                  )}
                </tr>
              </thead>
              <tbody>
                {items.map((item, index) => (
                  <tr key={item.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                    <td className="p-2 w-8">{index + 1}</td>
                    <td className="p-2 w-24 truncate">{item.name}</td>
                    <td className="p-2 w-12">{item.id}</td>
                    <td className="p-2 w-16">
                      <span 
                        className={`px-2 py-1 text-xs rounded-full ${permissions['armory'] ? 'cursor-pointer' : ''} ${item.is_save ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} 
                        onClick={permissions['armory'] ? () => handleToggleSave(item) : undefined}
                      >
                        {item.is_save ? 'כן' : 'לא'}
                      </span>
                    </td>
                    {permissions['armory'] && (
                      <td className="p-2 w-32">
                        <div className="flex gap-1 flex-wrap">
                          <Button size="sm" className="bg-green-500 hover:bg-green-600 text-white text-xs px-2 py-1 h-auto flex items-center gap-1" onClick={() => handleTransferItem(item)}>
                            <ArrowRightLeft className="w-3 h-3" />
                            העבר
                          </Button>
                          <Button size="sm" className="bg-blue-500 hover:bg-blue-600 text-white text-xs px-2 py-1 h-auto flex items-center gap-1" onClick={() => handleReturnToBase(item, 'גדוד')}>
                            <Home className="w-3 h-3" />
                            גדוד
                          </Button>
                          <Button size="sm" className="bg-orange-500 hover:bg-orange-600 text-white text-xs px-2 py-1 h-auto flex items-center gap-1" onClick={() => handleReturnToBase(item, 'סדנא')}>
                            <Wrench className="w-3 h-3" />
                            סדנא
                          </Button>
                        </div>
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      ))}

      {transferModalOpen && selectedItemForTransfer && (
        <TransferItemModal 
          item={selectedItemForTransfer} 
          currentLocation={soldier.location} 
          onClose={() => { setTransferModalOpen(false); setSelectedItemForTransfer(null); }} 
          onTransferComplete={(message, isSuccess) => { 
            setStatusMessage({ text: message, isSuccess });
            fetchSoldierData(); 
            setTransferModalOpen(false); 
            setSelectedItemForTransfer(null); 
          }} 
        />
      )}

      {assignModalOpen && (
        <AssignEquipmentModal 
          soldierID={parseInt(soldierID!)} 
          onClose={() => setAssignModalOpen(false)} 
          onAssignComplete={(message, isSuccess) => { 
            setStatusMessage({ text: message, isSuccess });
            fetchSoldierData(); 
            setAssignModalOpen(false); 
          }} 
        />
      )}

      {weaponReturnModalOpen && selectedWeaponForReturn && (
        <WeaponReturnSignatureModal 
          item={selectedWeaponForReturn} 
          onClose={() => { setWeaponReturnModalOpen(false); setSelectedWeaponForReturn(null); }} 
          onSubmit={handleWeaponReturnSignature} 
        />
      )}
    </div>
  );
};

export default SoldierArmoryPage;
