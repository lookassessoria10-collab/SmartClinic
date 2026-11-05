import { z } from "zod";

// Espelha as regras do banco (migração 0002/0007): o banco é a garantia final, isto é o aviso rápido.
export const SLUG_PATTERN = /^[a-z0-9](-?[a-z0-9])*$/;
export const RESERVED_SLUGS = new Set([
  "admin", "api", "app", "agendar", "ajuda", "assets", "auth", "cadastro", "clinica",
  "convite", "gestao", "login", "onboarding", "perfil", "public", "redefinir-senha",
  "static", "status", "suporte", "www",
]);

/** "Clínica São José!" → "clinica-sao-jose" (endereço sugerido, sempre editável). */
export function slugify(name: string): string {
  return name
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 48)
    .replace(/-+$/g, "");
}

export function slugProblem(slug: string): string | null {
  if (slug.length < 3) return "Use pelo menos 3 caracteres.";
  if (slug.length > 48) return "Use no máximo 48 caracteres.";
  if (!SLUG_PATTERN.test(slug)) return "Use só letras minúsculas, números e hífens (sem hífen no início ou no fim).";
  if (RESERVED_SLUGS.has(slug)) return "Este endereço é reservado. Escolha outro.";
  return null;
}

export const SEGMENTS = [
  "medical_clinic", "medical_office", "dental_clinic", "dental_office",
  "aesthetic_clinic", "aesthetic_office", "multidisciplinary", "other",
] as const;
export const SIZES = ["Só eu", "2 a 5", "6 a 10", "Mais de 10"] as const;
export const MODULE_KEYS = ["schedule", "opportunities", "finance"] as const;

export const onboardingSchema = z
  .object({
    name: z.string().trim().min(2, "Informe o nome do estabelecimento.").max(120, "Nome longo demais."),
    slug: z
      .string()
      .trim()
      .toLowerCase()
      .superRefine((v, ctx) => {
        const problem = slugProblem(v);
        if (problem) ctx.addIssue({ code: "custom", message: problem });
      }),
    segment: z.enum(SEGMENTS, { message: "Escolha o tipo de estabelecimento." }),
    // Módulos escolhidos (0016): Oportunidades exige Agenda; equipe e serviços só com Agenda.
    modules: z.array(z.enum(MODULE_KEYS)).min(1, "Escolha ao menos um módulo.").max(3),
    size: z.enum(SIZES, { message: "Escolha uma opção." }).optional(),
    services: z.array(z.string().trim().min(1).max(60)).max(30).default([]),
    attends: z.boolean().default(false),
    specialty: z.string().trim().max(80).optional(),
  })
  .superRefine((v, ctx) => {
    if (v.modules.includes("opportunities") && !v.modules.includes("schedule")) {
      ctx.addIssue({ code: "custom", path: ["modules"], message: "Oportunidades usa a Agenda: ligue a Agenda também." });
    }
    if (v.modules.includes("schedule") && !v.size) ctx.addIssue({ code: "custom", path: ["size"], message: "Escolha uma opção." });
    if (v.modules.includes("schedule") && v.services.length === 0) {
      ctx.addIssue({ code: "custom", path: ["services"], message: "Escolha ao menos um serviço." });
    }
  });

export type OnboardingInput = z.infer<typeof onboardingSchema>;
