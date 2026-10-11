import type { ReactNode } from 'react';
import { useDronePermissions } from './hooks/useDronePermissions';

/**
 * Blocks the drone tabs for users without view access, so a hand-typed URL is
 * refused even though the navigation would not have offered the link.
 */
export function DroneGuard({ children }: { children: ReactNode }) {
  const { canView, isLoaded } = useDronePermissions();

  if (!isLoaded) {
    return (
      <div className="flex flex-col items-center justify-center h-[40vh]">
        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500 mb-4" />
        <p className="text-center p-4">טוען הרשאות...</p>
      </div>
    );
  }

  if (!canView) {
    return (
      <div className="p-6 text-center text-red-700 bg-red-50 border border-red-200 rounded" dir="rtl">
        אין לך הרשאה לצפות בנתונים אלה
      </div>
    );
  }

  return <>{children}</>;
}

export default DroneGuard;
