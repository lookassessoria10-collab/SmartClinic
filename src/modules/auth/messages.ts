/**
 * Tradução dos erros do Supabase Auth para mensagens ao usuário.
 * Regra (docs/12 §5): nada que revele se um e-mail está cadastrado.
 */
export const AUTH_MESSAGES = {
  invalidCredentials: "E-mail ou senha incorretos.",
  emailNotConfirmed: "Confirme seu e-mail pelo link que enviamos antes de entrar.",
  tooManyAttempts: "Muitas tentativas. Aguarde alguns minutos e tente de novo.",
  loginPaused: "Por segurança, pausamos o acesso deste e-mail após várias senhas incorretas. Aguarde 15 minutos ou use “Esqueci minha senha”.",
  accountExists: "Já existe uma conta com este e-mail. Entre com sua senha ou use “Esqueci minha senha”.",
  weakPassword: "Escolha uma senha mais forte (evite senhas comuns ou já vazadas).",
  linkInvalid: "O link expirou ou já foi usado. Peça um novo.",
  emailSendFailed: "Não conseguimos enviar o e-mail de confirmação agora. Tente de novo em alguns minutos.",
  unexpected: "Não foi possível concluir agora. Tente de novo em instantes.",
} as const;

/** Falha do Auth ao ENVIAR o e-mail (SMTP recusou, endereço não autorizado no e-mail padrão). */
export function isEmailSendFailure(error: { code?: string; status?: number; message?: string } | null | undefined) {
  return (
    error?.code === "email_address_not_authorized" ||
    error?.code === "email_address_invalid" ||
    (error?.status === 500 && /sending|smtp|email/i.test(error.message ?? ""))
  );
}

export function authErrorMessage(error: { code?: string; status?: number; message?: string } | null | undefined): string {
  if (isEmailSendFailure(error)) return AUTH_MESSAGES.emailSendFailed;
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
    // Só acontece com a confirmação de e-mail desligada (com ela ligada o Supabase responde igual).
    case "user_already_exists":
    case "email_exists":
      return AUTH_MESSAGES.accountExists;
    case "otp_expired":
    case "flow_state_expired":
    case "flow_state_not_found":
    case "bad_code_verifier":
      return AUTH_MESSAGES.linkInvalid;
  }
  if (error?.status === 429) return AUTH_MESSAGES.tooManyAttempts;
  return AUTH_MESSAGES.unexpected;
}
