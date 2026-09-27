import { useMemo } from 'react';
import { usePermissions } from '@/contexts/PermissionsContext';
import { useAuthStore } from '@/stores/useAuthStore';
import { GROUP_LOCATIONS, GroupLocation, UserRole } from '../types';

export interface ResolvedUser {
  role: UserRole;
  email: string;
  name: string;
  signature: string;
  userId: string;
}

export function useUserRole(): ResolvedUser {
  const { permissions } = usePermissions();
  const email = useAuthStore((s) => s.email) ?? '';

  const role: UserRole = useMemo(() => {
    if (permissions['ammo']) return { kind: 'ammo' };
    const group = GROUP_LOCATIONS.find((g) => permissions[g]);
    if (group) return { kind: 'group', location: group as GroupLocation };
    return { kind: 'none' };
  }, [permissions]);

  return {
    role,
    email,
    name: (permissions['name'] as unknown as string) || email,
    signature: (permissions['signature'] as unknown as string) || '',
    userId: (permissions['id'] as unknown as string) || '',
  };
}
