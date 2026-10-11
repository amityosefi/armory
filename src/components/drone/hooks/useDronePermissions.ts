import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuthStore } from '@/stores/useAuthStore';
import { DRONE_PERMISSION } from '../types';

export interface DronePermissions {
  /** May read the section. Admin counts. */
  canView: boolean;
  /** May sign, delete, reassign, edit quantities, move גדוד stock. Admin does NOT count. */
  canEdit: boolean;
  isLoaded: boolean;
  /** permissions['id'] - the acting user's personal number. */
  actorId: string;
  /** permissions['name'] - falls back to the login email. */
  actorName: string;
}

/**
 * The only place the drone permission keys are read.
 *
 * Viewing needs permissions['רחפנים'] or permissions['admin'];
 * every write needs permissions['רחפנים'] alone - admin is read-only here.
 *
 * This is a UI-level restriction, not a security boundary: the RPCs stay
 * reachable by any authenticated client, as elsewhere in this app.
 */
export function useDronePermissions(): DronePermissions {
  const { permissions, isPermissionsLoaded } = usePermissions();
  const email = useAuthStore((s) => s.email) ?? '';

  const canEdit = !!permissions[DRONE_PERMISSION];
  const canView = canEdit || !!permissions['admin'];

  return {
    canView,
    canEdit,
    isLoaded: isPermissionsLoaded,
    actorId: (permissions['id'] as unknown as string) || '',
    actorName: (permissions['name'] as unknown as string) || email,
  };
}
