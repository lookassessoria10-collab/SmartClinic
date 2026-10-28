/**
 * Tradução dos erros do Supabase Auth para mensagens ao usuário.
 * Regra (docs/12 §5): nada que revele se um e-mail está cadastrado.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: "E-mail ou senha incorretos.",
  emailNotConfirmed: "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  tooManyAttempts: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  weakPassword: "Escolha uma senha mais forte (evite senhas comuns ou já vazadas).",
  linkInvalid: "O link expirou ou já foi usado. Peça um novo.",
  unexpected: "Não foi possível concluir agora. Tente de novo em instantes.",
} as const;

export function authErrorMessage(error: { code?: string; status?: number } | null | undefined): string {
  switch (error?.code) {
    case "invalid_credentials":
    case "user_not_found":
      return AUTH_MESSAGES.invalidCredentials;
    case "email_not_confirmed":
      return AUTH_MESSAGES.emailNotConfirmed;
    case "over_request_rate_limit":
    case "over_email_send_rate_limit":
      return AUTH_MESSAGES.tooManyAttempts;
    case "weak_password":
      return AUTH_MESSAGES.weakPassword;
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return AUTH_MESSAGES.linkInvalid;
  }
  if (error?.status === 429) return AUTH_MESSAGES.tooManyAttempts;
  return AUTH_MESSAGES.unexpected;
}
