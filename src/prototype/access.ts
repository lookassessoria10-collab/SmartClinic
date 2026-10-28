import type { Role } from "./types";

/**
 * Visibilidade de navegação por papel (docs/05 §1). No protótipo isto só controla a interface;
 * no sistema real, a mesma regra é verificada no servidor e pela RLS (docs/04 §3).
 */
export type Section = "inicio" | "agenda" | "pacientes" | "financeiro" | "gestao";

const ACCESS: Record<Role, Section[]> = {
  manager: ["inicio", "agenda", "pacientes", "financeiro", "gestao"],
  reception: ["inicio", "agenda", "pacientes", "financeiro"],
  professional: ["inicio", "agenda", "pacientes"],
};

export const canAccess = (role: Role, section: Section) => ACCESS[role].includes(section);

export const ROLE_LABEL: Record<Role, string> = {
  manager: "Gestora",
  reception: "Recepção",
  professional: "Profissional",
};
