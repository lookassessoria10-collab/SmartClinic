"use client";

import { createContext, useContext, type ReactNode } from "react";
import type { Role } from "@/prototype/types";

/**
 * Sessão real (vinda do servidor em src/app/c/[org]/layout.tsx) disponível para os
 * componentes de cliente. Serve só para a INTERFACE decidir o que mostrar — quem garante
 * o acesso é o servidor e a RLS (docs/04 §3).
 */
export interface ClinicSession {
  user: { id: string; name: string; email: string | null };
  organization: { id: string; slug: string; name: string; writable: boolean };
  role: Role;
  permissions: string[];
  clinics: { slug: string; name: string; role: Role }[];
}

const SessionContext = createContext<ClinicSession | null>(null);

export function SessionProvider({ value, children }: { value: ClinicSession; children: ReactNode }) {
  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}

export function useSession(): ClinicSession {
  const s = useContext(SessionContext);
  if (!s) throw new Error("useSession fora de SessionProvider (só existe dentro de /c/[org]).");
  return s;
}

export const can = (s: ClinicSession, permission: string) => s.permissions.includes(permission);
