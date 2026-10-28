/**
 * Erros das funções do banco (migração 0007) → mensagem para a interface.
 * As funções sinalizam o motivo em `hint` (P0001) ou usam 42501 para "sem permissão".
 */
export function teamErrorMessage(error: { code?: string; hint?: string | null; message?: string } | null): string {
  if (!error) return "";
  switch (error.hint) {
    case "last_manager":
      return "A clínica precisa de pelo menos um gestor ativo. Promova outra pessoa antes.";
    case "already_member":
      return "Esta pessoa já faz parte da equipe.";
    case "invalid_email":
      return "Informe um e-mail válido.";
    case "org_read_only":
      return "A clínica está em modo somente leitura (assinatura suspensa).";
    case "slug_unavailable":
      return "Este endereço já está em uso ou não é permitido.";
    case "invitation_invalid":
      return "Este convite expirou, foi cancelado ou já foi usado. Peça um novo convite à clínica.";
    case "invitation_email_mismatch":
      return "Este convite foi enviado para outro e-mail. Entre com a conta do e-mail convidado.";
  }
  // O gatilho de último gestor usa a mesma mensagem, mas pode chegar sem o hint.
  if (error.message?.includes("pelo menos um gestor ativo")) {
    return "A clínica precisa de pelo menos um gestor ativo. Promova outra pessoa antes.";
  }
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

export const ROLE_OPTIONS = [
  { value: "manager", label: "Gestor(a)", description: "Tudo, incluindo equipe, configurações e financeiro." },
  { value: "reception", label: "Recepção", description: "Agenda, pacientes, solicitações e recebimentos." },
  { value: "professional", label: "Profissional", description: "Os próprios atendimentos e pacientes." },
] as const;
