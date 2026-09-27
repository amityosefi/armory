import { useState } from 'react';
import { Button } from '@/components/ui/button';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { InventoryTables } from '../panels/InventoryTables';
import { ChangeLogGrid } from '../panels/ChangeLogGrid';
import { StockAddForm } from '../forms/StockAddForm';
import { StockRemoveForm } from '../forms/StockRemoveForm';
import { TransferForm } from '../forms/TransferForm';
import { useStockTabData } from '../hooks/useTabData';
import { useUserRole } from '../hooks/useUserRole';

type StockLoc = 'גדוד' | 'מחסן';

export function StockTab() {
  const { role } = useUserRole();
  const isAmmo = role.kind === 'ammo';

  const { data, isLoading, error } = useStockTabData();

  const [addOpen, setAddOpen] = useState<StockLoc | null>(null);
  const [removeOpen, setRemoveOpen] = useState<StockLoc | null>(null);
  const [transferOpen, setTransferOpen] = useState(false);
  const [statusMessage, setStatusMessage] = useState('');

  if (!isAmmo) {
    return <div className="p-4 text-center text-gray-500" dir="rtl">אין הרשאה לצפות במחסן</div>;
  }
  if (isLoading) return <div className="p-4" dir="rtl">טוען…</div>;
  if (error) return <div className="p-4 text-red-600" dir="rtl">שגיאה בטעינת מחסן</div>;

  const gadudInventory = data?.gadud_inventory ?? [];
  const mahsanInventory = data?.mahsan_inventory ?? [];
  const catalog = data?.catalog ?? [];
  const changeLog = data?.change_log ?? [];

  return (
    <div className="space-y-6 p-2" dir="rtl">
      <StatusMessage
        message={statusMessage}
        isSuccess
        onClose={() => setStatusMessage('')}
      />

      {/* גדוד section */}
      <section className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">גדוד</h3>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setAddOpen('גדוד')}
            >
              הוספה לגדוד
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRemoveOpen('גדוד')}>
              מחיקה מגדוד
            </Button>
          </div>
        </div>
        <InventoryTables inventory={gadudInventory} />
      </section>

      {/* Transfer button between sections */}
      <div className="flex justify-center">
        <Button variant="outline" onClick={() => setTransferOpen(true)}>
          העברה בין גדוד ↔ מחסן
        </Button>
      </div>

      {/* מחסן section */}
      <section className="border rounded-lg p-3">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-lg font-semibold">מחסן</h3>
          <div className="flex gap-2 flex-wrap justify-end">
            <Button
              size="sm"
              className="bg-green-600 hover:bg-green-700 text-white"
              onClick={() => setAddOpen('מחסן')}
            >
              הוספה למחסן
            </Button>
            <Button size="sm" variant="outline" onClick={() => setRemoveOpen('מחסן')}>
              מחיקה ממחסן
            </Button>
          </div>
        </div>
        <InventoryTables inventory={mahsanInventory} />
      </section>

      {/* Change log */}
      <section>
        <h4 className="font-semibold mb-2">יומן שינויים</h4>
        <ChangeLogGrid rows={changeLog} />
      </section>

      {/* Forms */}
      {addOpen && (
        <StockAddForm
          catalog={catalog}
          stock={addOpen === 'גדוד' ? gadudInventory : mahsanInventory}
          location={addOpen}
          open={!!addOpen}
          onOpenChange={(o) => { if (!o) setAddOpen(null); }}
          onSuccess={setStatusMessage}
        />
      )}

      {removeOpen && (
        <StockRemoveForm
          stock={removeOpen === 'גדוד' ? gadudInventory : mahsanInventory}
          location={removeOpen}
          open={!!removeOpen}
          onOpenChange={(o) => { if (!o) setRemoveOpen(null); }}
          onSuccess={setStatusMessage}
        />
      )}

      <TransferForm
        gadudInventory={gadudInventory}
        mahsanInventory={mahsanInventory}
        open={transferOpen}
        onOpenChange={setTransferOpen}
        onSuccess={setStatusMessage}
      />
    </div>
  );
}

export default StockTab;
