'use client';

import { createContext, useContext, type ReactNode } from 'react';
import type { FunctionReturnType } from 'convex/server';
import type { api } from '@convex/_generated/api';
import type { AdminPermission } from '@convex/admin/permissions';

export type StaffMe = Extract<FunctionReturnType<typeof api.admin.roles.me>, { staff: true }>;

const AdminContext = createContext<StaffMe | null>(null);

export function AdminProvider({ me, children }: { me: StaffMe; children: ReactNode }) {
  return <AdminContext.Provider value={me}>{children}</AdminContext.Provider>;
}

export function useAdmin(): StaffMe {
  const me = useContext(AdminContext);
  if (!me) throw new Error('useAdmin must be used inside the console');
  return me;
}

/** Client-side permission check, for hiding UI only. The server enforces every call. */
export function useCan() {
  const me = useAdmin();
  const granted = new Set(me.permissions);
  return (permission: AdminPermission) => granted.has(permission);
}
