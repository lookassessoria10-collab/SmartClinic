/** Serviços sugeridos no onboarding por tipo de estabelecimento (docs/05 F1). Viram cadastros reais ao criar a clínica. */
export const SEGMENT_SUGGESTIONS: Record<string, { name: string; durationMin: number; category: string }[]> = {
  dental: [
    { name: "Avaliação", durationMin: 30, category: "Consulta" },
    { name: "Limpeza", durationMin: 45, category: "Procedimento" },
    { name: "Restauração", durationMin: 60, category: "Procedimento" },
    { name: "Clareamento", durationMin: 60, category: "Procedimento" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
  ],
  aesthetic: [
    { name: "Avaliação estética", durationMin: 30, category: "Consulta" },
    { name: "Limpeza de pele", durationMin: 60, category: "Sessão" },
    { name: "Sessão de laser", durationMin: 30, category: "Sessão" },
    { name: "Drenagem linfática", durationMin: 50, category: "Sessão" },
    { name: "Peeling", durationMin: 45, category: "Procedimento" },
  ],
  medical: [
    { name: "Consulta", durationMin: 30, category: "Consulta" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
    { name: "Teleconsulta", durationMin: 30, category: "Consulta" },
    { name: "Avaliação de exames", durationMin: 20, category: "Consulta" },
  ],
  multidisciplinary: [
    { name: "Consulta", durationMin: 30, category: "Consulta" },
    { name: "Avaliação", durationMin: 40, category: "Consulta" },
    { name: "Sessão", durationMin: 50, category: "Sessão" },
    { name: "Retorno", durationMin: 20, category: "Retorno" },
  ],
};

export function segmentFamily(segment: string) {
  if (segment.startsWith("dental")) return "dental";
  if (segment.startsWith("aesthetic")) return "aesthetic";
  if (segment.startsWith("medical")) return "medical";
  return "multidisciplinary";
}

/** Duração e categoria de um serviço escolhido no onboarding (nome livre → 30 min, "Consulta"). */
export function suggestionFor(segment: string, name: string) {
  return SEGMENT_SUGGESTIONS[segmentFamily(segment)].find((s) => s.name === name) ?? { name, durationMin: 30, category: "Consulta" };
}
