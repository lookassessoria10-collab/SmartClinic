# 13 — Revisão de segurança da Fase 3

> Data: 2026-10-28 · Escopo: autenticação, organizações, equipe, MFA, auditoria (passos 1–8 do
> [12](12-fase-3-plano.md)) · Base: [09-seguranca-e-lgpd](09-seguranca-e-lgpd.md).

Método: leitura de todo o código de servidor (`src/server`, `src/modules/*/actions.ts`,
`src/proxy.ts`, `src/app/auth`), das migrações e políticas; tentativas de contorno pela API
com sessões reais (passos 5–8); testes automatizados (pgTAP, Vitest, Playwright).

## 1. Resumo

| | |
|---|---|
| Achados corrigidos nesta revisão | 5 (§3) |
| Riscos aceitos, com prazo | 7 (§4) |
| Achados críticos ou altos em aberto | **0** |

O ponto mais forte é que a **barreira está no banco**: RLS em todas as tabelas, escritas
sensíveis só por funções que conferem papel, clínica ativa e nível da sessão (MFA). Nos testes
pela API, uma sessão de recepção, de outra clínica ou só com senha (quando há MFA) foi recusada
pelo banco mesmo chamando as funções diretamente — a interface não é a proteção.

## 2. O que foi verificado

| Área | Verificação | Resultado |
|------|-------------|-----------|
| Isolamento entre clínicas | pgTAP: leitura/escrita cruzada em todas as tabelas; Playwright: endereço de outra clínica | ✅ recusado; "Página não encontrada" (não revela que a clínica existe) |
| Papéis | pgTAP: matriz de [04](04-perfis-e-permissoes.md); Playwright: recepção abrindo Gestão pelo endereço | ✅ recusado no banco e na tela |
| `anon` | pgTAP: nenhuma tabela, nenhuma função `app.*` | ✅ |
| Chave secreta | CI procura `sb_secret_`/`service_role` no bundle do navegador; `server-only` no cliente admin | ✅ ausente |
| Senhas | Só no Supabase Auth (bcrypt); mínimo 10; máximo 72 bytes validado; nunca em log | ✅ |
| Enumeração de contas | Login, redefinição e convite respondem igual exista ou não o e-mail | ✅ |
| Força bruta | 5 falhas por e-mail / 30 por IP em 15 min; limites do próprio Supabase por IP | ✅ |
| MFA | Sessão só com senha não lê clínica nem convida (aal2 exigido no banco, migração 0010) | ✅ |
| Convites | Token de 32 bytes aleatórios, só o hash no banco; uso único; 7 dias; e-mail tem de ser o convidado | ✅ |
| Redirecionamento aberto | `next=` só aceita caminhos internos (`safe-redirect.ts` + testes) | ✅ |
| CSRF | Server Actions do Next conferem a origem; cookies `SameSite=Lax` | ✅ |
| IDOR | Ações recebem o slug e ids, mas o banco confere o vínculo; ids de outra clínica → 0 linhas / 403 | ✅ |
| Auditoria | Convites, papéis, desativação, slug, dados da clínica, logins e falhas; e-mail/IP só como hash | ✅ |

## 3. Achados corrigidos

| # | Achado | Severidade | Correção |
|---|--------|-----------|----------|
| C1 | O cookie de sessão do Supabase era legível por JavaScript (padrão do `@supabase/ssr`). Um XSS futuro poderia levar o token | Média | `src/lib/session-cookie.ts`: `HttpOnly`, `Secure` em produção, `SameSite=Lax` em todo cookie de sessão (proxy e servidor). Coberto por teste Playwright |
| C2 | Sem cabeçalhos de segurança: a página podia ser embutida em outro site (clickjacking) | Média | `next.config.ts`: `X-Frame-Options: DENY`, CSP `frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'`, `nosniff`, `Referrer-Policy`, `Permissions-Policy`, HSTS, COOP; `X-Powered-By` removido |
| C3 | O código do convite está no endereço `/convite/<código>`; ao clicar num link externo, ele poderia ir no cabeçalho `Referer` | Baixa | `Referrer-Policy: no-referrer` em `/convite/*`, `/auth/confirm` e no futuro `/agendar/*/status/*` |
| C4 | Dependências sem atualização automática nem verificação de falhas conhecidas | Baixa | Dependabot semanal (`.github/dependabot.yml`) e `npm audit --audit-level=high` no CI |
| C5 | O CI falhava no build desde o primeiro envio (variáveis públicas ausentes), então a checagem da chave secreta no bundle nunca rodou | Média | Valores de exemplo no passo de build; novo job ponta a ponta com Supabase local |

## 4. Riscos aceitos

| # | Risco | Por que é aceitável agora | Quando revisitar |
|---|-------|---------------------------|------------------|
| A1 | O limite por IP usa `x-forwarded-for`, que pode ser forjado fora da Vercel | Na Vercel o cabeçalho é definido pela plataforma; o limite por e-mail não depende dele; o Supabase tem limite próprio por IP | Se mudar de hospedagem |
| A2 | O hash do e-mail na auditoria é SHA-256 sem segredo: quem tiver acesso ao banco e uma lista de e-mails consegue confirmar se um deles tentou entrar | Só administradores do banco veem `audit_logs` de autenticação; não há dado de paciente | Fase 10: trocar por HMAC com segredo do servidor |
| A3 | "Receber novo link" do convite pode ser usado para enviar e-mails repetidos ao convidado | Só vai para o e-mail já convidado; limite de frequência do Supabase (60 s) e de e-mails por hora | Fase 10: limite próprio por convite |
| A4 | CSP sem `script-src` com nonce (só proteção contra embutir e injeção de `<base>`/`<form>`) | A CSP com nonce no Next 16 exige renderização dinâmica em todas as páginas e conflita com o pré-carregamento atual | Fase 10, com medição de desempenho |
| A5 | Ids (uuid) recebidos nas ações não são validados pelo Zod antes de ir ao banco | O banco recusa formato inválido (erro tratado, mensagem genérica) e confere o vínculo | Ao criar as ações da Fase 4 |
| A6 | Supabase não oferece códigos de recuperação de MFA | Quem perder o celular é atendido pelo suporte (Fase 9, com verificação de identidade e auditoria) | Fase 9 |
| A7 | Aviso do SDK sobre `getSession()` a cada requisição (checagem de "MFA pendente") | Usado só para decidir a tela; o banco valida o nível da sessão pelo token | Quando o SDK oferecer a checagem pelo token já validado |

## 5. Fora do escopo desta fase

Dados de pacientes e prontuário (Fase 4+), página pública de agendamento (Fase 6),
pagamentos, uploads (Storage) e o painel do administrador da plataforma (Fase 9). Cada uma terá
revisão própria antes de receber qualquer dado.

## 6. Como repetir esta revisão

```bash
npm run db:start && npm run db:reset
npm run db:test          # pgTAP: isolamento, papéis, MFA, convites
npm test                 # Vitest
npm run test:e2e         # Playwright + axe (sobe o app sozinho)
npm audit --omit=dev
```
