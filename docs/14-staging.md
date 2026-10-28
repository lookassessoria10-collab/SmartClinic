# 14 — Staging (ambiente de testes na internet)

> Status: **guia pronto · aguardando você criar as contas** (2026-10-28).
> Custo: R$ 0 (Supabase Free + Vercel Hobby, uso não comercial — D-10 só na Fase 10).

Staging é uma cópia do app na internet para testar de qualquer lugar, **só com dados fictícios**
(docs/09 S12). Ele não recebe o `seed.sql`: as contas são criadas pelo próprio cadastro.

## Quem faz o quê

Criar contas, aceitar termos e digitar chaves são passos **seus** — eu não crio contas nem
manipulo chaves de serviços externos. Depois de cada etapa, me avise que eu confiro o
resultado (migrações aplicadas, URLs, e-mails chegando, cabeçalhos de segurança).

| Etapa | Quem | Tempo |
|-------|------|-------|
| 1. Projeto Supabase | Você | 5 min |
| 2. Aplicar as migrações | Você (comandos abaixo) | 5 min |
| 3. Configurar o Auth | Você (painel) | 10 min |
| 4. SMTP (D-16) | Você — opcional | 15 min |
| 5. Projeto na Vercel | Você | 10 min |
| 6. Conferência | Eu | — |

## 1. Projeto Supabase

1. Em supabase.com, crie uma organização (plano **Free**) e um projeto:
   - Nome: `smartclinic-staging`
   - Região: **South America (São Paulo)** — docs/09 (dados no Brasil)
   - Senha do banco: gere uma forte e guarde no seu gerenciador de senhas (não me envie).
2. Anote o **Project ref** (Project Settings → General). Ele não é segredo.

> O plano Free pausa o projeto após ~7 dias sem uso. Para reativar: painel → Restore project.

## 2. Aplicar as migrações

No terminal, na pasta do projeto:

```bash
npx supabase login
```

```bash
npx supabase link --project-ref SEU_PROJECT_REF
```

```bash
npx supabase db push
```

O `link` pede a senha do banco (digite você). O `db push` aplica `supabase/migrations/*` e
**não** aplica o `seed.sql`. Não use `supabase config push`: ele levaria as URLs de
`localhost` do `config.toml` para o staging.

## 3. Configurar o Auth (painel do Supabase)

| Onde | O quê |
|------|-------|
| Authentication → Sign In / Providers → Email | Confirm email: **ligado**; Secure password change: **ligado**; Minimum password length: **10** |
| Authentication → Sign In / Providers | Desligar todos os outros provedores (D-20); Anonymous sign-ins: **desligado** |
| Authentication → Multi-Factor | TOTP (App Authenticator): **ligado** |
| Authentication → Attack Protection | Leaked password protection: ligar **se disponível no plano** (D-21) |
| Authentication → URL Configuration | Site URL: `https://SEU-APP.vercel.app` · Redirect URLs: `https://SEU-APP.vercel.app/auth/confirm**` |
| Authentication → Emails → Templates | Para Confirm signup, Invite user, Magic link, Change email e Reset password: copiar assunto e HTML de `supabase/templates/*.html` (assuntos em `supabase/config.toml`) |

O endereço `SEU-APP.vercel.app` só existe depois da etapa 5: volte aqui para preencher.

## 4. SMTP próprio (D-16)

Sem SMTP próprio, o Supabase só entrega e-mails para os membros da equipe do projeto no
painel, e no máximo 2 por hora. Dá para testar cadastro e convites usando **apenas e-mails seus**
cadastrados como membros da organização do Supabase.

Para convidar outras pessoas: crie uma conta gratuita num provedor de e-mail transacional
(ex.: Resend), verifique um domínio seu e preencha em Authentication → Emails → SMTP Settings.
A senha SMTP fica só no painel do Supabase.

## 5. Projeto na Vercel

1. Em vercel.com (plano **Hobby**), Add New → Project → importe `lookassessoria10-collab/SmartClinic`.
2. Framework: Next.js (detectado). Não altere os comandos de build.
3. Em Environment Variables, crie (valores em Supabase → Project Settings → API Keys):

| Variável | Valor | Observação |
|----------|-------|------------|
| `NEXT_PUBLIC_SUPABASE_URL` | `https://SEU_PROJECT_REF.supabase.co` | Pública |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `sb_publishable_…` | Pública (a RLS protege) |
| `SUPABASE_SECRET_KEY` | `sb_secret_…` | **Marque como Sensitive.** Nunca com prefixo `NEXT_PUBLIC_` |
| `NEXT_PUBLIC_SITE_URL` | `https://SEU-APP.vercel.app` | Usado nos links dos e-mails |

4. Deploy. Depois, volte à etapa 3 e preencha as URLs.
5. Settings → Deployment Protection: deixe **Vercel Authentication** ligada nas *Preview
   Deployments* (só você abre as prévias de cada branch).

## 6. Conferência (eu faço, quando você avisar)

- Migrações: as 10 aplicadas, RLS ligada em todas as tabelas, `anon` sem acesso.
- `https://SEU-APP.vercel.app/login`: cabeçalhos de segurança, cookie `HttpOnly` + `Secure`.
- Cadastro → e-mail → onboarding com uma conta sua; convite (se houver SMTP).
- Chave secreta ausente do JavaScript entregue ao navegador.

## O que nunca fazer em staging

- Cadastrar paciente, cliente ou e-mail de terceiros reais (S12).
- Colar a chave secreta em chat, issue, commit ou variável `NEXT_PUBLIC_*`.
- Rodar `supabase db reset --linked` (apaga o banco de staging).
