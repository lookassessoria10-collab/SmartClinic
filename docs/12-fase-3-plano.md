# 12 — Plano da Fase 3: autenticação, organizações e permissões

> Status: **aprovado (2026-10-27) · em andamento**.

### Progresso

| Passo | Situação |
|-------|----------|
| Verificação da documentação (§6) | ✅ Chaves publishable/secret confirmadas; `getClaims()` no servidor; `proxy.ts` no Next 16; tabelas novas exigem GRANT explícito a partir de 30/10/2026; e-mail padrão do Supabase só entrega para a equipe do projeto (2/h) → D-16 necessária para convites em staging |
| 1. Git, estrutura, CI | ✅ Repositório local; `supabase/` inicializado (senha ≥ 10, confirmação de e-mail, MFA TOTP); CI em `.github/workflows/ci.yml`; `.env.example` |
| 2. Migrações 0001–0007 | ✅ Aplicadas no banco local (2026-10-28). Corrigidos 2 erros revelados na execução: tipo do papel na carga de permissões; EXECUTE padrão do Postgres para PUBLIC (só removível na forma global) |
| 3. Testes pgTAP | ✅ **87/87 passando.** Teste de mutação: com o isolamento quebrado de propósito, os testes de isolamento falharam como esperado |
| Seed local | ✅ 2 clínicas fictícias e 5 usuários de teste (`supabase/seed.sql`). Login real verificado no Auth local; pela API, a recepção vê só a própria clínica e nenhum convite; `anon` recebe 401 |
| 4. Clientes, proxy, autorização | ✅ `src/server/supabase.ts` (sessão do usuário, RLS sempre ativa), `src/server/admin/` (chave secreta, `server-only`), `src/proxy.ts`, `src/server/auth.ts` (`getCurrentUser`, `requireMember` → 404 para não membros, `requirePermission`). Tipos gerados do schema (`npm run db:types`) |
| 5. Cadastro, confirmação, login, sair, redefinição | ✅ Testado no navegador contra o Supabase local (2026-10-28): área protegida sem login → `/login?next=`; senha errada → mensagem genérica; login → volta ao destino; sair → sessão encerrada; cadastro → e-mail (Mailpit) → link → onboarding; link reutilizado → recusado; redefinição: e-mail inexistente recebe a mesma resposta e nenhum e-mail sai; nova senha vale e a antiga não; 5 falhas → bloqueio de 15 min mesmo com a senha certa. Falhas e logins na auditoria (e-mail/IP só como hash). Chave secreta ausente do bundle |
| 6. Onboarding real e seletor de clínica | ✅ Testado no navegador (2026-10-28): onboarding cria clínica + unidade + gestor + profissional + respostas numa transação (`create_organization`), com endereço sugerido do nome e verificado ao vivo; casca usa nome, papel e permissões reais (sem o seletor "Visualizar como"); seletor lista as clínicas da pessoa com o papel em cada uma; quem não é membro recebe "Página não encontrada" em português; última clínica lembrada no pós-login. Agenda e pacientes continuam com dados de demonstração (D-18), alinhados ao papel real |
| 7–10 | ⏳ Não iniciados |

**Ambiente desta máquina:** 7,2 GB de RAM e disco que chegou a encher. `npm run db:start` sobe só
banco, Auth, API e Mailpit (sem Studio, Storage, Realtime). Feche apps pesados antes de usar.
> Base: [02-arquitetura](02-arquitetura.md), [03-modelo-de-dados](03-modelo-de-dados.md),
> [04-perfis-e-permissoes](04-perfis-e-permissoes.md), [09-seguranca-e-lgpd](09-seguranca-e-lgpd.md).

## 1. Objetivo

Trocar a "porta de entrada" fictícia do protótipo por uma base multiempresa real e segura:
pessoas criam conta, criam a clínica, convidam a equipe com papéis, e **o banco recusa** qualquer
acesso fora da própria clínica — mesmo que a interface falhe.

Ao final, as telas de agenda, pacientes e Início continuam com dados de demonstração
(ver D-18), mas atrás de login real.

## 2. Escopo

### Dentro
| Bloco | Itens |
|-------|-------|
| Infraestrutura | Repositório Git; Supabase local (CLI) e projeto de staging; variáveis de ambiente; CI no GitHub Actions |
| Banco | Migrações de `organizations`, `units`, `organization_slug_history`, `profiles`, `memberships`, `invitations`, `role_permissions`, `platform_admins`, `audit_logs`; funções `app.*`; RLS; gatilhos de auditoria |
| Autenticação | Cadastro com confirmação de e-mail, login, sair, esqueci/redefinir senha, MFA TOTP opcional (gestores), sessão por cookie |
| Organização | Onboarding persistido (cria clínica + unidade padrão + vínculo de gestor + profissional, se a pessoa atende), seletor de clínica, Gestão → Clínica (nome, slug, fuso) |
| Equipe | Gestão → Equipe: convidar por e-mail com papel, reenviar/cancelar convite, mudar papel, desativar membro; aceitar convite |
| Autorização | `requireMember`, `requirePermission` no servidor; matriz de [04](04-perfis-e-permissoes.md) semeada; interface lê as permissões para mostrar/esconder |
| Auditoria | Gestão → Auditoria (lista simples filtrável) |
| Testes | pgTAP (isolamento + matriz de papéis), Vitest, **Playwright passa a existir** (login, convite, troca de clínica) |

### Fora (fases seguintes)
Profissionais/serviços/pacientes reais (Fase 4), agenda real (5), página pública real (6),
admin da plataforma com interface (9 — nesta fase o primeiro admin é criado por script),
login social, link mágico, SSO.

## 3. Arquitetura da fase

```
Navegador ──► proxy.ts (Next 16, substitui middleware)
                │  renova a sessão Supabase nos cookies; redireciona não logados de /c/* para /login
                ▼
         Server Components / Server Actions
                │  getCurrentUser()      → valida o JWT no servidor (nunca confia em getSession)
                │  requireMember(slug)   → membership ativa + papel + permissões (cache só por requisição)
                │  requirePermission(p)  → lança 403 tipado
                ▼
         Cliente Supabase com o JWT do usuário ──► PostgreSQL + RLS (app.has_perm, app.org_writable)
         Cliente admin (chave secreta) ──► só em src/server/admin: convites, script do 1º admin
```

Decisões técnicas desta fase (viram ADRs ao aprovar):

1. **`proxy.ts` só renova a sessão e faz o redirecionamento grosso.** Autorização de verdade
   fica no servidor de renderização e no banco: o proxy roda separado e não deve ser a barreira.
2. **Leitura da sessão atrás de `<Suspense>`** (exigência do `cacheComponents`). A casca
   (barra lateral, cabeçalho) pré-renderiza; o conteúdo autenticado chega em streaming.
   O `instant = false` do protótipo (ADR-013) é removido.
3. **Nada de dados da clínica em `use cache`.** O guia do Next 16 sugere `use cache: private`
   para dados da sessão, mas ele guarda o resultado por 5 min — uma pessoa desativada
   continuaria vendo dados. Membership e permissões usam apenas `React.cache()` (escopo da
   requisição). Revisitar na Fase 5 com `cacheTag` + invalidação explícita, se o desempenho pedir.
4. **Login e cadastro via Server Action**, não direto do navegador ao Supabase: permite auditar,
   aplicar limite de tentativas próprio e padronizar mensagens ("e-mail ou senha incorretos"
   — nunca revelar se o e-mail existe).
5. **Criação da clínica numa única função SQL** `app.create_organization(...)` (security definer):
   organização + unidade padrão + membership `manager` + profissional opcional + respostas do
   onboarding + auditoria, tudo na mesma transação. Sem estados "meio criados".
6. **Convites próprios** (tabela `invitations`, token aleatório com hash, validade de 7 dias,
   papel definido) em vez de depender só do convite nativo do Supabase: o convite nativo não
   carrega organização nem papel, e precisamos de reenviar/cancelar/auditar.
7. **Chaves novas do Supabase**: chave *publishable* no cliente, chave *secret* só no servidor
   (`import 'server-only'`) — a verificar na documentação vigente no início da fase.
8. **Slug** com validação (formato, palavras reservadas, unicidade) e histórico de 90 dias (RN-04).

## 4. Banco de dados — migrações planejadas

| # | Migração | Conteúdo |
|---|----------|----------|
| 0001 | `extensions` | `pgcrypto`, `citext`, `btree_gist`, `pg_trgm`; schema `app` (não exposto pela API) |
| 0002 | `core_tenancy` | `organizations`, `units`, `organization_slug_history`, `profiles` (+ gatilho que cria o perfil ao criar o usuário) |
| 0003 | `access` | `memberships`, `invitations`, `role_permissions` (+ carga da matriz), `platform_admins` |
| 0004 | `audit` | `audit_logs` só-anexar; função `app.audit()`; gatilhos em organizations, units, memberships, invitations |
| 0005 | `authz_functions` | `app.is_member`, `app.has_perm`, `app.org_writable`, `app.my_permissions(org)` |
| 0006 | `rls_policies` | RLS habilitada em **todas** as tabelas; políticas por operação; `anon` sem nenhuma |
| 0007 | `rpc` | `app.create_organization`, `app.accept_invitation`, `app.change_member_role` (impede remover o último gestor), `app.change_slug` |

Tabela nova em relação ao [03](03-modelo-de-dados.md):

```sql
create table invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  email citext not null,
  role member_role not null,
  token_hash bytea not null unique,         -- sha256; o token só existe no link enviado
  invited_by uuid not null references auth.users(id),
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index one_open_invite on invitations(organization_id, email)
  where accepted_at is null and revoked_at is null;
```

Regras que o banco garante (não só a aplicação):
- Toda clínica tem **pelo menos um gestor ativo** (função de troca de papel recusa remover o último).
- Membro `invited`/`disabled` não passa em `app.is_member`.
- Organização `suspended` → `app.org_writable` falso → toda escrita recusada.
- Convite só é aceito pelo usuário cujo e-mail **confirmado** é igual ao do convite.

## 5. Fluxos

| Fluxo | Passos | Observações |
|-------|--------|-------------|
| Cadastro | `/cadastro` → e-mail + senha + nome → e-mail de confirmação → `/auth/confirm` (PKCE) → `/onboarding` | Sem confirmação de e-mail, não cria clínica |
| Onboarding | Mesmas 4 perguntas do protótipo + "Você também atende?" → `create_organization` → `/c/<slug>/inicio` | Slug sugerido do nome, editável |
| Login | `/login` → Server Action → se tiver MFA: `/login/mfa` → última clínica usada ou seletor | Mensagem genérica de erro; limite de tentativas |
| Esqueci a senha | `/redefinir-senha` → e-mail → `/auth/confirm?type=recovery` → nova senha | Resposta igual exista ou não o e-mail |
| Convite | Gestor convida → e-mail com link `/convite/<token>` → cria conta ou entra → confirma → `accept_invitation` | E-mail diferente do convite → recusa com explicação |
| Trocar de clínica | Seletor lista memberships ativas → navega para `/c/<slug>` | Lembrar a última em cookie (não sensível) |
| Desativar membro | Gestão → Equipe → Desativar → confirmação | Efeito imediato (sem cache de permissões); sessões existentes ficam sem acesso |
| MFA | Perfil → Segurança → ativar (QR + código) → códigos de recuperação | Obrigatório para admin da plataforma |

## 6. Ambientes e ferramentas

| Item | Proposta | Custo |
|------|----------|-------|
| Repositório | GitHub privado (você cria; eu preparo o conteúdo e o primeiro commit) | R$ 0 |
| Banco local | Supabase CLI + Docker Desktop; e-mails capturados localmente (caixa de teste do CLI) | R$ 0 |
| Staging | 1 projeto Supabase Free, região São Paulo, **só dados fictícios** | R$ 0 |
| E-mail em staging | O e-mail embutido do Supabase é limitado e serve só para testes; para convites reais em staging, SMTP próprio (D-16) | R$ 0 no plano gratuito do provedor |
| Hospedagem staging | Vercel Hobby (não comercial) | R$ 0 |
| CI | GitHub Actions: lint, tipos, Vitest, pgTAP (com Supabase no runner), Playwright | Cota gratuita |

**A verificar no primeiro dia da fase** (documentação muda): nomes e formato das chaves
publishable/secret, método recomendado para validar o JWT no servidor (`getClaims` vs `getUser`),
limites atuais do plano Free (pausa por inatividade, e-mails/hora), disponibilidade da proteção
contra senhas vazadas no plano gratuito, e a forma atual de configurar SMTP próprio.

## 7. Ordem de trabalho

1. Git + estrutura (`supabase/`, `src/server/`), CI básico.
2. Supabase local, migrações 0001–0006, seed com 2 clínicas fictícias e 4 usuários de teste.
3. **Testes pgTAP de isolamento antes de qualquer tela** (falham primeiro, passam depois).
4. Clientes Supabase (servidor, navegador, admin) + `proxy.ts` + `getCurrentUser`/`requireMember`/`requirePermission`.
5. Cadastro, confirmação, login, sair, redefinição.
6. Onboarding real (`create_organization`) e seletor de clínica; shell lendo papel/permissões reais.
7. Convites e Gestão → Equipe; Gestão → Clínica (slug).
8. MFA; Gestão → Auditoria.
9. Playwright nos fluxos; verificação de que a chave secreta não está em nenhum arquivo do bundle do cliente.
10. Staging no ar; revisão de segurança da fase; atualização da documentação.

## 8. Critérios de aceitação

1. Pessoa nova cria conta, confirma e-mail e cria a clínica em ≤ 5 min.
2. Gestor convida Recepção e Profissional; ambos entram e veem apenas o permitido pela matriz.
3. **pgTAP: 0 falhas** em isolamento (clínica A × B para SELECT/INSERT/UPDATE/DELETE em todas as tabelas) e na matriz de papéis.
4. Membro desativado perde acesso na **próxima requisição**.
5. Clínica suspensa (via script): leitura funciona, qualquer escrita falha no banco.
6. Não é possível remover o último gestor.
7. `anon` não lê nenhuma tabela diretamente.
8. Chave secreta ausente do bundle do cliente (verificação automática no CI).
9. Mensagens de login/redefinição não revelam se o e-mail existe.
10. axe sem violações nas telas novas; fluxos completos por teclado.
11. Ações sensíveis (convite, mudança de papel, desativação, troca de slug, login com falha) aparecem na auditoria.

## 9. Testes

| Tipo | Cobertura |
|------|-----------|
| pgTAP | Isolamento por tabela; matriz de papéis; último gestor; convite com e-mail diferente; organização suspensa; `anon` |
| Vitest | Validação de slug; schemas Zod; `requirePermission`; normalização de e-mail |
| Playwright | Cadastro → onboarding; login com e sem MFA; convite → aceite; desativação; troca de clínica |
| Segurança | Tentativa de IDOR (trocar `org`/ids nas ações); força bruta no login; token de convite expirado/reutilizado |

## 10. Riscos

| Risco | Mitigação |
|-------|-----------|
| Política RLS errada vaza dados | Testes de isolamento escritos **antes** das telas; lint que falha se tabela nova não tiver RLS |
| Recursão/lentidão nas políticas | Funções `security definer` com `search_path` fixo; índices em `organization_id`; `explain analyze` nas consultas críticas |
| E-mail de confirmação/convite não chega | Caixa local no desenvolvimento; SMTP próprio em staging (D-16) |
| Docker pesado no Windows | Alternativa: desenvolver direto contra o staging (D-17), com mais cuidado nos testes |
| Projeto Free pausa por inatividade | Aceitável em staging; documentar como reativar |
| Mudanças nas APIs do Supabase/Next | Verificação do item 6 no início; versões fixadas no `package.json` |
| Mistura de dados reais e de demonstração | Faixa "dados de demonstração" mantida nas telas ainda simuladas (D-18) |
