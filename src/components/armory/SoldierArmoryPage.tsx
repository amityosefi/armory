import React, { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { supabase } from '@/lib/supabaseClient';
import { Button } from '@/components/ui/button';
import { Pencil, ArrowRightLeft, Download, Ban, PenLine, Home, Wrench, Plus, Trash } from 'lucide-react';
import TransferItemModal from './TransferItemModal';
import AssignEquipmentModal from './AssignEquipmentModal';
import WeaponReturnSignatureModal from './WeaponReturnSignatureModal';
import { exportSoldierPDF } from './SoldierPDFExport';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import useIsMobile from '@/hooks/useIsMobile';
import { usePermissions } from '@/contexts/PermissionsContext';
import { Combobox } from '@/components/ui/combobox';
import equipmentJson from '@/assets/equipment.json';

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
  logistic_sign?: string;
  logistic_name?: string;
  logistic_id?: string;
}

const SoldierArmoryPage: React.FC = () => {
  const { soldierID } = useParams<{ soldierID: string }>();
  const navigate = useNavigate(); //
  
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
  const [editingItemId, setEditingItemId] = useState<{ name: string; kind: string } | null>(null);
  const [newItemId, setNewItemId] = useState<string>('');
  const isMobile = useIsMobile();
  const { permissions } = usePermissions();

  const plugotOptions = ['א', 'ב', 'ג', 'מסייעת', 'אלון', 'מכלול', 'פלסם'];

  // Soldier equipment state (for non-armory users)
  interface SoldierEquipment {
    id?: number;
    soldier_id: number;
    name: string;
    quantity: number;
  }
  const [soldierEquipment, setSoldierEquipment] = useState<SoldierEquipment[]>([]);
  const [equipmentLoading, setEquipmentLoading] = useState(false);
  const [addingEquipment, setAddingEquipment] = useState(false);
  const [addingEquipmentToLocation, setAddingEquipmentToLocation] = useState(false);
  const [creatingItemName, setCreatingItemName] = useState(false);
  const [newEquipName, setNewEquipName] = useState('');
  const [newEquipQty, setNewEquipQty] = useState(1);
  const equipmentNames = Object.keys(equipmentJson).sort((a, b) => a.localeCompare(b, 'he'));
  const [extraEquipmentNames, setExtraEquipmentNames] = useState<string[]>([]);
  const combinedEquipmentNames = [...equipmentNames, ...extraEquipmentNames].sort((a, b) =>
    a.localeCompare(b, 'he')
  );

  const fetchSoldierEquipment = async () => {
    if (!soldierID) return;
    setEquipmentLoading(true);
    try {
      const { data, error } = await supabase
        .from('armory_soldier_equipment')
        .select('*')
        .eq('soldier_id', soldierID);
      if (error) throw error;
      setSoldierEquipment((data as unknown as SoldierEquipment[]) || []);
    } catch (err) {
      console.error('Error fetching soldier equipment:', err);
    } finally {
      setEquipmentLoading(false);
    }
  };

  const fetchExtraEquipmentNames = async () => {
    try {
      const { data, error } = await supabase
        .from('armoryGroupsEquipment')
        .select('name');
      if (error) throw error;
      const existing = new Set(equipmentNames);
      const names = ((data as unknown as { name: string }[]) || [])
        .map(row => row.name)
        .filter(name => !existing.has(name));
      const uniqueNames = Array.from(new Set(names)).sort((a, b) => a.localeCompare(b, 'he'));
      setExtraEquipmentNames(uniqueNames);
    } catch (err) {
      console.error('Error fetching extra equipment names:', err);
    }
  };

  const handleCreateNewItemName = async (rawName: string) => {
    const name = rawName.trim();
    if (!name) return;
    setCreatingItemName(true);
    try {
      const { error } = await supabase
        .from('armoryGroupsEquipment')
        .insert({ name, added_by: permissions['name'] || 'Unknown' });
      if (error && error.code !== '23505') throw error;
      setExtraEquipmentNames(prev =>
        prev.includes(name) ? prev : [...prev, name].sort((a, b) => a.localeCompare(b, 'he'))
      );
      setNewEquipName(name);
    } catch (err) {
      console.error('Error creating new item name:', err);
      setStatusMessage({ text: 'שגיאה ביצירת פריט חדש', isSuccess: false });
    } finally {
      setCreatingItemName(false);
    }
  };

  const handleAddEquipment = async () => {
    if (!newEquipName || !soldierID || newEquipQty < 1) return;
    setAddingEquipment(true);
    try {
      const { error } = await supabase
        .from('armory_soldier_equipment')
        .insert({ soldier_id: Number(soldierID), name: newEquipName, quantity: newEquipQty });
      if (error) throw error;
      setNewEquipName('');
      setNewEquipQty(1);
      await fetchSoldierEquipment();
    } catch (err) {
      console.error('Error adding equipment:', err);
      setStatusMessage({ text: 'שגיאה בהוספת ציוד', isSuccess: false });
    } finally {
      setAddingEquipment(false);
    }
  };

  const handleAddEquipmentToLocation = async () => {
    if (!newEquipName || !soldierID || newEquipQty < 1 || !soldier?.location) return;
    setAddingEquipmentToLocation(true);
    try {
      const { data: peopleAtLocation, error: peopleError } = await supabase
        .from('people')
        .select('id')
        .eq('location', soldier.location);
      if (peopleError) throw peopleError;
      const peopleIds = ((peopleAtLocation as unknown as { id: number }[]) || []).map(p => p.id);
      if (peopleIds.length === 0) return;

      const { data: existingRows, error: existingError } = await supabase
        .from('armory_soldier_equipment')
        .select('soldier_id')
        .eq('name', newEquipName)
        .in('soldier_id', peopleIds);
      if (existingError) throw existingError;
      const alreadyHaveIt = new Set(
        ((existingRows as unknown as { soldier_id: number }[]) || []).map(r => r.soldier_id)
      );

      const idsToInsert = peopleIds.filter(id => !alreadyHaveIt.has(id));
      if (idsToInsert.length === 0) {
        setStatusMessage({ text: 'לכולם במיקום זה יש כבר פריט זה', isSuccess: true });
        return;
      }

      const { error: insertError } = await supabase
        .from('armory_soldier_equipment')
        .insert(idsToInsert.map(id => ({ soldier_id: id, name: newEquipName, quantity: newEquipQty })));
      if (insertError) throw insertError;

      setNewEquipName('');
      setNewEquipQty(1);
      if (idsToInsert.includes(Number(soldierID))) {
        await fetchSoldierEquipment();
      }
      setStatusMessage({ text: `הפריט נוסף ל-${idsToInsert.length} אנשים במיקום`, isSuccess: true });
    } catch (err) {
      console.error('Error adding equipment to location:', err);
      setStatusMessage({ text: 'שגיאה בהוספת ציוד לכל מי שבמיקום', isSuccess: false });
    } finally {
      setAddingEquipmentToLocation(false);
    }
  };

  const handleUpdateEquipmentQty = async (id: number, quantity: number) => {
    if (quantity < 1) return;
    try {
      const { error } = await supabase
        .from('armory_soldier_equipment')
        .update({ quantity })
        .eq('id', id);
      if (error) throw error;
      setSoldierEquipment(prev => prev.map(e => e.id === id ? { ...e, quantity } : e));
    } catch (err) {
      console.error('Error updating equipment quantity:', err);
      setStatusMessage({ text: 'שגיאה בעדכון כמות', isSuccess: false });
    }
  };

  const handleRemoveEquipment = async (id: number) => {
    try {
      const { error } = await supabase
        .from('armory_soldier_equipment')
        .delete()
        .eq('id', id);
      if (error) throw error;
      setSoldierEquipment(prev => prev.filter(e => e.id !== id));
    } catch (err) {
      console.error('Error removing equipment:', err);
      setStatusMessage({ text: 'שגיאה במחיקת ציוד', isSuccess: false });
    }
  };

  const logToArmoryDocument = async (message: string) => {
    try {
      await supabase.from('armory_document').insert({
        'משתמש': permissions['name'] || 'Unknown',
        'הודעה': message
      });
    } catch (error) {
      console.error('Error logging to armory_document:', error);
    }
  };

  useEffect(() => {
    if (soldierID) {
      fetchSoldierData();
      if (!permissions['armory']) {
        fetchSoldierEquipment();
        fetchExtraEquipmentNames();
      }
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

  const handleIdClick = (item: ArmoryItem) => {
    if (item.kind === 'כוונת' && permissions['armory']) {
      setEditingItemId({ name: item.name, kind: item.kind });
      setNewItemId(String(item.id));
    }
  };

  const handleIdUpdate = async (item: ArmoryItem) => {
    if (!newItemId.trim()) {
      setStatusMessage({ text: 'מספר מסד לא יכול להיות ריק', isSuccess: false });
      return;
    }

    const newIdNum = parseInt(newItemId.trim());
    if (isNaN(newIdNum)) {
      setStatusMessage({ text: 'מספר מסד חייב להיות מספר', isSuccess: false });
      return;
    }

    try {
      const { error } = await supabase
        .from('armory_items')
        .update({ id: newIdNum })
        .eq('name', item.name)
        .eq('kind', item.kind)
        .eq('id', item.id);

      if (error) throw error;

      const message = `עודכן מסד של ${item.name} (${item.kind}) מ-${item.id} ל-${newIdNum} - חייל ${soldier?.name}`;
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);

      setArmoryItems(armoryItems.map(i => 
        i.id === item.id && i.name === item.name && i.kind === item.kind ? { ...i, id: newIdNum } : i
      ));
      setEditingItemId(null);
      setNewItemId('');
    } catch (error) {
      console.error('Error updating item ID:', error);
      setStatusMessage({ text: `שגיאה בעדכון מסד ${item.name}`, isSuccess: false });
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
        .eq('id', item.id)
        .eq('name', item.name)
        .eq('kind', item.kind);

      if (error) throw error;
      
      const message = !item.is_save 
        ? `החייל ${soldier?.name} מספר אישי ${soldier?.id} איפסן את ${item.name} מסד ${item.id}`
        : `החייל ${soldier?.name} מספר אישי ${soldier?.id} לקח את ${item.name} מסד ${item.id} מאיפסון`;
      
      setArmoryItems(armoryItems.map(i => 
        i.id === item.id && i.name === item.name && i.kind === item.kind ? { ...i, is_save: !i.is_save } : i
      ));
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
    } catch (error) {
      console.error('Error toggling save status:', error);
      setStatusMessage({ text: `שגיאה בעדכון ${item.name} (מסד: ${item.id})`, isSuccess: false });
    }
  };

  const handleWeaponReturnSignature = async (signature: string) => {
    if (!selectedWeaponForReturn) return;

    try {

      const { error } = await supabase
        .from('armory_items')
        .update({ 
          is_save: false,
          people_sign: signature,
          logistic_sign: permissions['signature'] ? String(permissions['signature']) : '',
          logistic_name: permissions['name'] ? String(permissions['name']) : '',
          logistic_id: permissions['id'] ? String(permissions['id']) : ''
        })
        .eq('id', selectedWeaponForReturn.id);

      if (error) throw error;
      
      const message = `${selectedWeaponForReturn.name} (מסד: ${selectedWeaponForReturn.id}) הוחזר לחייל ${soldier?.name} מאפסון `;
      
      setArmoryItems(armoryItems.map(i => 
        i.id === selectedWeaponForReturn.id ? { 
          ...i, 
          is_save: false,
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
      setStatusMessage({ text: `שגיאה בהחזרת ${selectedWeaponForReturn.name}`, isSuccess: false });
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
        .update({ location: newLocation , is_save: false, people_sign: '', logistic_sign: '', logistic_name: '', logistic_id: 0, is_examine: false, is_examine_groups: false})
        .eq('id', item.id)
        .eq('kind', item.kind)
          .eq('name', item.name);

      if (error) throw error;
      
      const message = `החייל ${soldier?.name} זיכה ${item.kind} ${item.name} מסד ${item.id} ל${newLocation}`;
      
      setArmoryItems(armoryItems.filter(i => i.id !== item.id));
      setStatusMessage({ text: message, isSuccess: true });
      await logToArmoryDocument(message);
    } catch (error) {
      console.error('Error returning item:', error);
      setStatusMessage({ text: `שגיאה בהחזרת ${item.name} (מסד: ${item.id})`, isSuccess: false });
    }
  };

  const handleDischargeSoldier = async () => {

    try {
      const itemCount = armoryItems.length;
      const itemsList = armoryItems.map(item => `${item.name} (מסד: ${item.id})`).join(', ');
      
      const { error: itemsError } = await supabase
        .from('armory_items')
        .update({ location: 'גדוד' , is_save: false, people_sign: '', logistic_sign: '', logistic_name: '', logistic_id: 0, is_examine: false, is_examine_groups: false})
        .eq('location', soldierID!);

      if (itemsError) throw itemsError;

      const { error: deleteError } = await supabase
        .from('people')
        .delete()
        .eq('id', soldierID!);

      if (deleteError) throw deleteError;

      const message = `זוכה ונמחק חייל ${soldier?.name} (מספר אישי: ${soldier?.id}). הוחזרו ${itemCount} פריטים: ${itemsList}`;
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
    
    // Define the order of kinds
    const kindOrder = ['נשק', 'כוונת', 'אמרל', 'אופטיקה', 'ציוד'];
    
    // Create ordered object
    const orderedGrouped: { [key: string]: ArmoryItem[] } = {};
    
    // First add items in the specified order
    kindOrder.forEach(kind => {
      if (grouped[kind]) {
        orderedGrouped[kind] = grouped[kind];
      }
    });
    
    // Then add any remaining kinds not in the order (alphabetically)
    Object.keys(grouped)
      .filter(kind => !kindOrder.includes(kind))
      .sort((a, b) => a.localeCompare(b, 'he'))
      .forEach(kind => {
        orderedGrouped[kind] = grouped[kind];
      });
    
    return orderedGrouped;
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
                <input 
                  type="text" 
                  inputMode="numeric"
                  pattern="\d*"
                  value={editValues.phone || ''} 
                  onChange={(e) => {
                    const value = e.target.value;
                    // Only allow digits
                    if (value === '' || /^\d+$/.test(value)) {
                      setEditValues({ ...editValues, phone: value });
                    }
                  }} 
                  className="border rounded px-2 py-1 flex-1" 
                />
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

      <StatusMessage
          isSuccess={statusMessage.isSuccess}
          message={statusMessage.text}
          onClose={() => setStatusMessage({ text: '', isSuccess: false })}
      />

      <br/>

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
                  {kind === 'נשק' && (
                    <th className="p-2 text-right w-16">מאופסן</th>
                  )}
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
                    <td className="p-2 w-12">
                      {editingItemId?.name === item.name && editingItemId?.kind === item.kind ? (
                        <div className="flex gap-1">
                          <input
                            type="text"
                            value={newItemId}
                            onChange={(e) => setNewItemId(e.target.value)}
                            className="w-16 px-1 py-0.5 border rounded text-xs"
                            autoFocus
                            onKeyDown={(e) => {
                              if (e.key === 'Enter') handleIdUpdate(item);
                              if (e.key === 'Escape') { setEditingItemId(null); setNewItemId(''); }
                            }}
                          />
                          <button
                            onClick={() => handleIdUpdate(item)}
                            className="text-green-600 hover:text-green-800 text-xs"
                          >
                            ✓
                          </button>
                          <button
                            onClick={() => { setEditingItemId(null); setNewItemId(''); }}
                            className="text-red-600 hover:text-red-800 text-xs"
                          >
                            ✗
                          </button>
                        </div>
                      ) : (
                        <span
                          className={kind === 'כוונת' && permissions['armory'] ? 'cursor-pointer hover:text-blue-600' : ''}
                          onClick={() => handleIdClick(item)}
                        >
                          {item.id}
                        </span>
                      )}
                    </td>
                    {kind === 'נשק' && (
                      <td className="p-2 w-16">
                        <span 
                          className={`px-2 py-1 text-xs rounded-full ${permissions['armory'] ? 'cursor-pointer' : ''} ${item.is_save ? 'bg-green-100 text-green-800' : 'bg-red-100 text-red-800'}`} 
                          onClick={permissions['armory'] ? () => handleToggleSave(item) : undefined}
                        >
                          {item.is_save ? 'כן' : 'לא'}
                        </span>
                      </td>
                    )}
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

      {/* Soldier Equipment Section - only for non-armory users */}
      {(!permissions['armory']) && (
        <div className="mb-6">
          <div className="bg-purple-600 text-white font-bold text-lg p-2 rounded-t-lg">ציוד אישי</div>
          <div className="bg-white rounded-b-lg shadow-md p-4">
            {equipmentLoading ? (
              <div className="flex justify-center py-4">
                <div className="animate-spin rounded-full h-6 w-6 border-t-2 border-b-2 border-purple-500"></div>
              </div>
            ) : (
              <>
                {soldierEquipment.length > 0 ? (
                  <table className="w-full text-sm mb-4">
                    <thead className="bg-purple-100">
                      <tr>
                        <th className="p-2 text-right">שם פריט</th>
                        <th className="p-2 text-right w-20">כמות</th>
                        <th className="p-2 text-right w-16"></th>
                      </tr>
                    </thead>
                    <tbody>
                      {soldierEquipment.map((equip, index) => (
                        <tr key={equip.id} className={index % 2 === 0 ? 'bg-gray-50' : 'bg-white'}>
                          <td className="p-2">{equip.name}</td>
                          <td className="p-2">
                            <input
                              type="number"
                              min={1}
                              value={equip.quantity}
                              onChange={(e) => {
                                const val = parseInt(e.target.value) || 1;
                                setSoldierEquipment(prev => prev.map(eq => eq.id === equip.id ? { ...eq, quantity: val } : eq));
                              }}
                              onBlur={() => equip.id && handleUpdateEquipmentQty(equip.id, equip.quantity)}
                              className="w-16 border border-gray-300 rounded px-2 py-1 text-right"
                            />
                          </td>
                          <td className="p-2">
                            <button
                              onClick={() => equip.id && handleRemoveEquipment(equip.id)}
                              className="text-red-500 hover:text-red-700 p-1"
                            >
                              <Trash className="w-4 h-4" />
                            </button>
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                ) : (
                  <p className="text-gray-500 text-center py-3 mb-4">אין ציוד אישי</p>
                )}

                {/* Add equipment form */}
                <div className="flex gap-2 items-end flex-wrap">
                  <div className="flex-1 min-w-[140px]">
                    <label className="block text-sm font-medium text-gray-700 mb-1">פריט</label>
                    <Combobox
                      value={newEquipName || null}
                      onValueChange={(value) => setNewEquipName(String(value))}
                      options={combinedEquipmentNames.map(name => ({ value: name, label: name }))}
                      placeholder="-- בחר פריט --"
                      searchPlaceholder="חפש פריט..."
                      emptyText="לא נמצאו תוצאות"
                      disabled={creatingItemName}
                      onCreateOption={handleCreateNewItemName}
                      createOptionLabel={(query) => `➕ הוסף "${query}" כפריט חדש`}
                    />
                  </div>
                  <div className="w-20">
                    <label className="block text-sm font-medium text-gray-700 mb-1">כמות</label>
                    <input
                      type="number"
                      min={1}
                      value={newEquipQty}
                      onChange={(e) => setNewEquipQty(Math.max(1, parseInt(e.target.value) || 1))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-right"
                    />
                  </div>
                  <Button
                    onClick={handleAddEquipment}
                    disabled={!newEquipName || addingEquipment}
                    className="bg-purple-600 hover:bg-purple-700 text-white flex items-center gap-1"
                  >
                    {addingEquipment ? (
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    הוסף
                  </Button>
                  <Button
                    onClick={handleAddEquipmentToLocation}
                    disabled={!newEquipName || addingEquipmentToLocation}
                    className="bg-purple-200 hover:bg-purple-300 text-purple-900 flex items-center gap-1"
                  >
                    {addingEquipmentToLocation ? (
                      <span className="animate-spin inline-block h-4 w-4 border-2 border-current border-t-transparent rounded-full"></span>
                    ) : (
                      <Plus className="w-4 h-4" />
                    )}
                    הוסף לכל הפלוגה
                  </Button>
                </div>
              </>
            )}
          </div>
        </div>
      )}

      {transferModalOpen && selectedItemForTransfer && (
        <TransferItemModal 
          item={selectedItemForTransfer} 
          currentLocation={soldier.location}
          currentPersonName={soldier.name}
          currentPersonId={soldier.id}
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
            soldierName={soldier?.name}
          soldierID={parseInt(soldierID!)} 
          onClose={() => setAssignModalOpen(false)} 
          onAssignComplete={(message, isSuccess) => { 
            setStatusMessage({ text: message, isSuccess });
            fetchSoldierData(); 
            setAssignModalOpen(false); 
          }} 
        />
      )}

      {weaponReturnModalOpen && selectedWeaponForReturn && soldier && (
        <WeaponReturnSignatureModal 
          item={selectedWeaponForReturn}
          soldierID={soldier.id}
          onClose={() => { setWeaponReturnModalOpen(false); setSelectedWeaponForReturn(null); }} 
          onSubmit={handleWeaponReturnSignature} 
        />
      )}
    </div>
  );
};

export default SoldierArmoryPage;
