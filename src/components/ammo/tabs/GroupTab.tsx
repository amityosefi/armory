import { useMemo, useState } from 'react';
import { Button } from '@/components/ui/button';
import StatusMessage from '@/components/feedbackFromBackendOrUser/StatusMessageProps';
import { InventoryTables } from '../panels/InventoryTables';
import { ChangeLogGrid } from '../panels/ChangeLogGrid';
import { MyRequestsCards } from '../panels/MyRequestsCards';
import { RequestBatchCards } from '../panels/RequestBatchCards';
import { SatzalPrintModal } from '../panels/SatzalPrintModal';
import { RequestDecreaseForm } from '../forms/RequestDecreaseForm';
import { SignToGroupForm } from '../forms/SignToGroupForm';
import { DirectDecreaseForm } from '../forms/DirectDecreaseForm';
import { useGroupTabData, useUserTabData } from '../hooks/useTabData';
import { useUserRole } from '../hooks/useUserRole';
import { GroupLocation } from '../types';

interface Props {
  location: GroupLocation;
}

const BALL_AMMO_SUMMARY = [
  { label: 'נגב', qty: 380 },
  { label: 'מאג', qty: 230 },
  { label: 'דגם א/ ב', qty: 990 },
];

function BallAmmoSummary() {
  return (
    <div className="bg-blue-50 border border-blue-200 rounded-lg px-4 py-2 flex flex-wrap gap-x-5 gap-y-1 items-center text-sm" dir="rtl">
      <span className="font-semibold text-blue-800 shrink-0">כמויות כדורים בברוס:</span>
      {BALL_AMMO_SUMMARY.map(({ label, qty }) => (
        <span key={label} className="text-blue-900">
          <span className="font-medium">{label}:</span>{' '}
          <span className="font-bold">{qty}</span>
        </span>
      ))}
    </div>
  );
}

export function GroupTab({ location }: Props) {
  const { role, email, name, signature } = useUserRole();
  const isAmmo = role.kind === 'ammo';

  const ammoQ = useGroupTabData(location);
  const userQ = useUserTabData(email, location);
  const query = isAmmo ? ammoQ : userQ;

  const [signOpen, setSignOpen] = useState(false);
  const [decreaseOpen, setDecreaseOpen] = useState(false);
  const [requestOpen, setRequestOpen] = useState(false);
  const [printOpen, setPrintOpen] = useState(false);
  const [activeTab, setActiveTab] = useState<'דיווחים' | 'החתמה'>('דיווחים');
  const [statusMessage, setStatusMessage] = useState('');

  const inventory = useMemo(() => query.data?.inventory ?? [], [query.data]);
  const changeLog = useMemo(() => isAmmo ? (ammoQ.data?.change_log ?? []) : [], [isAmmo, ammoQ.data]);
  const allRequests = useMemo(
    () => (isAmmo ? ammoQ.data?.all_requests ?? [] : []),
    [isAmmo, ammoQ.data]
  );
  const myRequests = useMemo(
    () => (isAmmo ? [] : userQ.data?.my_requests ?? []),
    [isAmmo, userQ.data]
  );

  if (query.isLoading) return <div className="p-4" dir="rtl">טוען…</div>;
  if (query.error) return <div className="p-4 text-red-600" dir="rtl">שגיאה בטעינת נתונים</div>;

  const pendingCount = allRequests.filter((r) => r.status === 'ממתין').length;

  return (
    <div className="space-y-4 p-2" dir="rtl">
      <StatusMessage
        message={statusMessage}
        isSuccess
        onClose={() => setStatusMessage('')}
      />

      {/* Static ball-ammo summary banner */}
      <BallAmmoSummary />

      {/* Header + action buttons */}
      <div className="flex flex-wrap items-center gap-2 justify-between">
        <h3 className="text-xl font-semibold">פלוגה {location}</h3>
        <div className="flex flex-wrap gap-2">
          {isAmmo ? (
            <>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setSignOpen(true)}>
                החתמה/ זיכוי
              </Button>
              <Button className="bg-green-600 hover:bg-green-700 text-white" onClick={() => setDecreaseOpen(true)}>
                שצל
              </Button>
              <Button variant="outline" onClick={() => setPrintOpen(true)}>
                הורדת דפי החתמות
              </Button>
            </>
          ) : (
            <Button onClick={() => setRequestOpen(true)}>דיווח שצל</Button>
          )}
        </div>
      </div>

      {/* Tabs: דיווחים (requests, card view) / החתמה (current inventory) */}
      <section>
        <div className="border-b mb-4">
          <div className="flex overflow-x-auto">
            {(['דיווחים', 'החתמה'] as const).map((tab) => (
              <button
                key={tab}
                type="button"
                className={`py-2 px-4 flex items-center gap-2 ${activeTab === tab ? 'border-b-2 border-blue-500 font-bold' : ''}`}
                onClick={() => setActiveTab(tab)}
              >
                {tab}
                {tab === 'דיווחים' && isAmmo && pendingCount > 0 && (
                  <span className="inline-flex items-center justify-center bg-red-500 text-white text-xs px-2 py-0.5 rounded-full">
                    {pendingCount}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {activeTab === 'החתמה' ? (
          <InventoryTables inventory={inventory} />
        ) : isAmmo ? (
          <RequestBatchCards requests={allRequests} inventory={inventory} onSuccess={setStatusMessage} />
        ) : (
          <MyRequestsCards requests={myRequests} email={email} onSuccess={setStatusMessage} />
        )}
      </section>

      {/* Change log — collapsible, ammo only */}
      {isAmmo && (
        <section>
          <ChangeLogGrid rows={changeLog} />
        </section>
      )}

      {/* Forms */}
      {isAmmo && (
        <>
          <SignToGroupForm
            location={location}
            groupInventory={inventory}
            open={signOpen}
            onOpenChange={setSignOpen}
            onSuccess={setStatusMessage}
          />
          <DirectDecreaseForm
            location={location}
            inventory={inventory}
            open={decreaseOpen}
            onOpenChange={setDecreaseOpen}
            onSuccess={setStatusMessage}
          />
          <SatzalPrintModal
            open={printOpen}
            onClose={() => setPrintOpen(false)}
            location={location}
            changeLog={changeLog}
            ammoName={name}
            ammoSignature={signature}
          />
        </>
      )}

      {!isAmmo && (
        <RequestDecreaseForm
          location={location}
          inventory={inventory}
          open={requestOpen}
          onOpenChange={setRequestOpen}
          onSuccess={setStatusMessage}
        />
      )}
    </div>
  );
}

export default GroupTab;
