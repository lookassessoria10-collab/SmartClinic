import type { ModuleKey, Role } from "./types";

/**
 * Visibilidade de navegação por papel (docs/05 §1). No protótipo isto só controla a interface;
 * no sistema real, a mesma regra é verificada no servidor e pela RLS (docs/04 §3).
 */
export type Section = "inicio" | "agenda" | "pacientes" | "financeiro" | "gestao" | "conta";

// "conta" (Minha conta e segurança) é de todos; não aparece no menu, só no menu do usuário.
const ACCESS: Record<Role, Section[]> = {
  manager: ["inicio", "agenda", "pacientes", "financeiro", "gestao", "conta"],
  reception: ["inicio", "agenda", "pacientes", "financeiro", "conta"],
  professional: ["inicio", "agenda", "pacientes", "conta"],
};

export const canAccess = (role: Role, section: Section) => ACCESS[role].includes(section);

/** Módulo de que cada seção depende (0016). Início, Gestão e Minha conta existem sempre. */
export const SECTION_MODULE: Partial<Record<Section, ModuleKey>> = {
  agenda: "schedule",
  pacientes: "schedule",
  financeiro: "finance",
};

export const moduleOn = (features: ModuleKey[], section: Section) => {
  const m = SECTION_MODULE[section];
  return !m || features.includes(m);
};

export const ROLE_LABEL: Record<Role, string> = {
  manager: "Gestora",
  reception: "Recepção",
  professional: "Profissional",
};
