import { useMemo, useRef } from 'react';
import { Button } from '@/components/ui/button';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { ChangeLogRow, GroupLocation } from '../types';

interface Props {
  open: boolean;
  onClose: () => void;
  location: GroupLocation;
  changeLog: ChangeLogRow[];
  ammoName: string;
  ammoSignature: string;
}

function formatDate(iso: string): string {
  const d = new Date(iso);
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  const mo = String(d.getMonth() + 1).padStart(2, '0');
  return `${hh}:${mm} ${dd}-${mo}-${d.getFullYear()}`;
}

export function SatzalPrintModal({ open, onClose, location, changeLog, ammoName, ammoSignature }: Props) {
  const printRef = useRef<HTMLDivElement>(null);

  const satzalRows = useMemo(
    () =>
      changeLog
        .filter((r) => r.action_type === 'decrease_from_group')
        .sort((a, b) => new Date(a.created_at).getTime() - new Date(b.created_at).getTime()),
    [changeLog]
  );

  const handlePrint = () => {
    const content = printRef.current?.innerHTML;
    if (!content) return;
    const win = window.open('', '_blank');
    if (!win) return;
    win.document.write(`
      <!DOCTYPE html>
      <html dir="rtl" lang="he">
      <head>
        <meta charset="UTF-8" />
        <title>דף שצל - פלוגה ${location}</title>
        <style>
          body { font-family: Arial, sans-serif; direction: rtl; margin: 20px; font-size: 13px; }
          table { width: 100%; border-collapse: collapse; margin-bottom: 24px; }
          th, td { border: 1px solid #999; padding: 6px 10px; text-align: right; }
          th { background: #f0f0f0; font-weight: bold; }
          h1 { text-align: center; font-size: 18px; margin-bottom: 4px; }
          h2 { text-align: center; font-size: 14px; color: #555; margin-bottom: 16px; }
          .footer { display: flex; justify-content: space-between; margin-top: 40px; }
          .sig-box { width: 42%; border-top: 1px solid #333; padding-top: 8px; text-align: center; font-size: 12px; }
          .sig-img { max-height: 60px; margin-top: 4px; }
          @page { size: A4; margin: 20mm; }
        </style>
      </head>
      <body>${content}</body>
      </html>
    `);
    win.document.close();
    win.focus();
    setTimeout(() => { win.print(); win.close(); }, 300);
  };

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent dir="rtl" className="max-w-3xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>דפי שצל — פלוגה {location}</DialogTitle>
        </DialogHeader>

        <div className="flex justify-end mb-2">
          <Button onClick={handlePrint} size="sm">הדפסה</Button>
        </div>

        {/* Printable content */}
        <div ref={printRef} dir="rtl" className="font-sans text-sm">
          <h1 className="text-center text-lg font-bold mb-1">דף שצל — פלוגה {location}</h1>
          <h2 className="text-center text-sm text-gray-500 mb-4">
            {new Date().toLocaleDateString('he-IL', { year: 'numeric', month: 'long', day: 'numeric' })}
          </h2>

          {satzalRows.length === 0 ? (
            <p className="text-center text-gray-400 py-4">אין רישומי שצל</p>
          ) : (
            <table className="w-full border-collapse text-sm mb-6">
              <thead>
                <tr className="bg-gray-100">
                  <th className="border border-gray-300 p-2 text-right">תאריך ושעה</th>
                  <th className="border border-gray-300 p-2 text-right">פריט</th>
                  <th className="border border-gray-300 p-2 text-right">כמות</th>
                  <th className="border border-gray-300 p-2 text-right">שם מבצע</th>
                  <th className="border border-gray-300 p-2 text-right">הערה</th>
                </tr>
              </thead>
              <tbody>
                {satzalRows.map((r) => (
                  <tr key={r.id} className="even:bg-gray-50">
                    <td className="border border-gray-300 p-2 tabular-nums">{formatDate(r.created_at)}</td>
                    <td className="border border-gray-300 p-2">{r.item_name}</td>
                    <td className="border border-gray-300 p-2 font-medium">{Math.abs(r.delta)}</td>
                    <td className="border border-gray-300 p-2">{r.actor_name}</td>
                    <td className="border border-gray-300 p-2 text-gray-500">{r.note ?? ''}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}

          {/* Footer signatures */}
          <div className="flex justify-between mt-12 gap-4">
            {/* Left side — group requester */}
            <div className="flex-1 border-t border-gray-700 pt-3 text-center text-sm">
              <div className="text-gray-500">חתימת הנמסר</div>
              <div className="mt-1 text-gray-400 text-xs">שם: _______________</div>
              <div className="mt-1 text-gray-400 text-xs">מספר אישי: _______________</div>
              <div className="h-12 mt-2 border border-dashed border-gray-300 rounded" />
            </div>

            {/* Right side — ammo user */}
            <div className="flex-1 border-t border-gray-700 pt-3 text-center text-sm">
              <div className="text-gray-500">חתימת המנסר</div>
              <div className="mt-1 font-medium">{ammoName}</div>
              {ammoSignature && (
                <img src={ammoSignature} alt="חתימה" className="max-h-14 mx-auto mt-2 border" />
              )}
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default SatzalPrintModal;
