# 02 — Arquitetura técnica

## 1. Visão geral

**Monólito modular** em Next.js (App Router) sobre Supabase (PostgreSQL + Auth + Storage).
Um único deploy, um único banco, módulos com fronteiras explícitas no código.

```
                    ┌──────────────────────────────────────────────┐
  Navegador         │  Next.js (Vercel)                            │
  ─────────         │                                              │
  App da clínica ──►│  app/(clinic)/...    Server Components       │
  Página pública ──►│  app/agendar/[slug]  Server Actions          │──► Supabase Auth
  Admin SaaS     ──►│  app/(platform)/...  Route Handlers          │
                    │        │                                     │
                    │        ▼                                     │
                    │  src/modules/<domínio>  (regras de negócio)  │
                    │        │                                     │
                    │        ▼                                     │
                    │  src/server/db  ── cliente Supabase com JWT  │──► PostgreSQL (RLS)
                    │  src/server/admin ── service role (restrito) │──► Storage (privado)
                    └──────────────────────────────────────────────┘
```

### Por que monólito modular (ADR-001)
- Time pequeno, um deploy, uma base de testes, transações ACID entre domínios (ex.: aprovar
  agendamento e registrar evento de auditoria na mesma transação).
- Fronteiras de módulo permitem extrair um serviço no futuro (ex.: integrações) sem reescrever.

## 2. Stack

| Camada | Escolha | Observação |
|--------|---------|------------|
| Framework | Next.js (App Router) + React + TypeScript (strict) | Versão estável vigente na Fase 2, fixada no `package.json` |
| UI | Tailwind CSS + shadcn/ui (Radix) + Lucide | shadcn copia o código dos componentes para o projeto → personalizamos sem depender de lib externa |
| Animação | Motion para React | Só em transições de painéis, listas e feedback; respeita `prefers-reduced-motion` |
| Formulários | React Hook Form + Zod | **O mesmo schema Zod valida no cliente e no servidor** |
| Datas | `date-fns` + `date-fns-tz` (ou `Temporal` com polyfill) | Gravação em UTC; exibição no fuso da unidade |
| Calendário | Componente próprio sobre CSS Grid | Bibliotecas de calendário completas pesam e brigam com o design system (ADR-006) |
| Planilhas | Parser CSV (`papaparse`) + XLSX (`exceljs` ou distribuição oficial SheetJS) | O pacote `xlsx` do npm está desatualizado e com vulnerabilidades conhecidas — não usar |
| Banco | PostgreSQL (Supabase) | Extensões: `btree_gist`, `pgcrypto`, `pg_cron`, `citext`, `pg_trgm` |
| Auth | Supabase Auth (`@supabase/ssr`) | Sessão em cookie httpOnly; MFA TOTP |
| Arquivos | Supabase Storage, buckets privados | URLs assinadas de curta duração |
| Anti-abuso | Cloudflare Turnstile | Gratuito; só na página pública |
| E-mail | Provedor transacional com plano gratuito (ex.: Resend) | Decisão D-07 |
| Testes | Vitest, Testing Library, Playwright, pgTAP (`supabase test db`) | pgTAP para RLS |
| Qualidade | ESLint (+ regra de fronteiras de módulo), Prettier, `tsc --noEmit` | CI no GitHub Actions (gratuito para repositório privado dentro da cota) |
| Observabilidade | Logs Vercel + Sentry (plano gratuito) | Sem dados de pacientes nos logs |

## 3. Mapa de módulos

Cada módulo é dono das suas tabelas, schemas Zod, ações e componentes.
Outros módulos só usam o que ele exporta em `index.ts`.

```
auth ──────────────► organizations ◄────────── platform (admin SaaS)
                        │   │   ▲                    │
                        ▼   │   │                    ▼
                    members │   └──────────── subscriptions (planos, limites, features)
                    (perms) │
                        ▼   ▼
        professionals ◄─ services
              │             │
              ▼             ▼
          availability ──► scheduling (agenda + agendamentos) ◄── public-booking
                               │
                 ┌─────────────┼───────────────┐
                 ▼             ▼               ▼
              patients     finance        audit (transversal)
                 ▲
                 │
        data-transfer (importação/exportação) ──► integrations (camada anticorrupção)
```

| Módulo | Responsabilidade | Fase |
|--------|------------------|------|
| `auth` | Login, sessão, convite, MFA, redefinição | 3 |
| `organizations` | Clínica, unidades, onboarding, configurações, slug | 3 |
| `members` | Membros, papéis, permissões, seletor de clínica | 3 |
| `professionals` | Profissionais, especialidade do profissional, vínculo a serviços | 4 |
| `services` | Serviços, duração, intervalo pós-atendimento, preço, visibilidade pública | 4 |
| `patients` | Cadastro, duplicidade, histórico | 4 |
| `availability` | Regras semanais, bloqueios, férias, feriados, cálculo de horários livres | 5 |
| `scheduling` | Agendamentos, status, remarcação, conflitos | 5 |
| `public-booking` | Página pública, solicitação, reserva, token de status | 6 |
| `data-transfer` | Importação e exportação | 7 |
| `finance` | Lançamentos, categorias, resumo | 8 |
| `subscriptions` | Planos, limites, funcionalidades ativas | 9 |
| `platform` | Administração central | 9 |
| `integrations` | Identificadores externos, mapeamentos, conectores futuros | 7 (base) |
| `audit` | Registro de ações (transversal) | 3 |

**Interoperabilidade (§13):** `integrations` é uma camada anticorrupção. Conectores futuros
(FHIR, TISS, RNDS) convertem formatos externos para comandos dos módulos (`patients.create`,
`scheduling.book`) — nunca escrevem direto nas tabelas da agenda ou de pacientes. A importação de
planilhas da Fase 7 já usa esse mesmo caminho (origem registrada, mapeamento, validação, relatório),
o que valida a arquitetura antes de qualquer integração real.

## 4. Estrutura de pastas proposta

```
/
├─ docs/                      ← esta documentação
├─ supabase/
│  ├─ migrations/             ← SQL versionado (única fonte do schema)
│  ├─ seed.sql                ← dados fictícios
│  └─ tests/                  ← pgTAP: RLS e isolamento
├─ src/
│  ├─ app/
│  │  ├─ (auth)/login, convite, redefinir-senha
│  │  ├─ (clinic)/[org]/inicio, agenda, pacientes, financeiro, gestao/...
│  │  ├─ (platform)/admin/...
│  │  └─ agendar/[slug]/...   ← público, mobile-first
│  ├─ modules/<modulo>/
│  │  ├─ index.ts             ← API pública do módulo
│  │  ├─ schemas.ts           ← Zod
│  │  ├─ actions.ts           ← Server Actions ('use server')
│  │  ├─ queries.ts           ← leituras (server-only)
│  │  ├─ rules.ts             ← regras puras, testáveis sem banco
│  │  └─ components/
│  ├─ ui/                     ← design system (componentes shadcn personalizados)
│  ├─ styles/tokens.css       ← tokens como CSS variables
│  ├─ server/
│  │  ├─ db.ts                ← cliente Supabase com sessão do usuário
│  │  ├─ authz.ts             ← requirePermission(org, perm)
│  │  └─ admin/               ← service role; import 'server-only'; uso auditado
│  └─ lib/                    ← utilitários sem regra de negócio
└─ tests/e2e/                 ← Playwright
```

## 5. Fluxo de uma escrita (padrão)

1. Componente chama Server Action com dados do formulário.
2. Action valida com Zod (mesmo schema do cliente).
3. `requirePermission(orgId, 'appointments.create')` — checagem no servidor.
4. Operação via cliente Supabase **com o JWT do usuário** → RLS aplica a mesma regra no banco.
5. Operações com várias etapas (aprovar solicitação, importar lote) usam **funções SQL
   transacionais** (`rpc`), para não depender de várias idas e voltas.
6. Trigger de auditoria grava quem/quando/o quê.
7. `revalidatePath` / atualização otimista na interface.

**Service role** só é usada em: administração central, jobs agendados e a função pública de
solicitação (que roda como `security definer` com validação própria). Nunca em código que o cliente importa.

## 6. Multiempresa (ADR-002)

- **Banco e schema compartilhados**, coluna `organization_id` em todas as tabelas de clínica.
- RLS em **todas** as tabelas do schema exposto; tabela sem política = sem acesso.
- `unit_id` em agenda, disponibilidade, bloqueios e financeiro desde o início.
- URLs da área logada incluem a organização (`/c/[org]/agenda`) para suportar usuário em várias clínicas; o servidor confere o vínculo a cada requisição.
- Alternativas descartadas: banco por cliente (caro e operacionalmente pesado para clínicas pequenas) e schema por cliente (migrações N vezes, incompatível com o tooling do Supabase).

## 7. Ambientes

| Ambiente | Uso | Infra |
|----------|-----|-------|
| Local | Desenvolvimento | Supabase CLI (Docker) + `next dev` |
| Protótipo | Fase 2, dados fictícios em memória | Vercel Hobby (não comercial) |
| Staging | Fases 3–10, dados fictícios | Supabase Free + Vercel Hobby |
| Produção | Clientes reais | **A contratar** (ver D-10) |
