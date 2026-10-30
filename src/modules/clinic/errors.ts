/**
 * Erro do banco → mensagem para a interface (migrações 0011–0012).
 * As funções do banco já escrevem mensagens em português com código P0001; o resto é traduzido aqui.
 */
export function dbErrorMessage(error: { code?: string; message?: string } | null): string {
  if (!error) return "";
  if (error.code === "P0001" && error.message) return error.message;
  if (error.code === "42501") return "Você não tem permissão para esta ação.";
  if (error.code === "23514") return "Algum valor está fora do permitido. Revise os campos.";
  if (error.code === "23503") return "Um dos itens escolhidos não existe mais. Recarregue a página.";
  if (error.code === "23P01") return "Esse horário já está ocupado.";
  return "Não foi possível concluir agora. Tente de novo em instantes.";
}

export interface Result<T = undefined> {
  ok: boolean;
  message?: string;
  fields?: Partial<Record<string, string>>;
  data?: T;
}
