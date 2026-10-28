# 03 — Modelo de dados inicial

> Rascunho para aprovação. O SQL definitivo nasce em `supabase/migrations/` na Fase 3.
> Convenções: `uuid` como chave (`gen_random_uuid()`), `timestamptz` em UTC, valores em
> **centavos** (`bigint`), `created_at`/`updated_at` em todas as tabelas, exclusão lógica
> (`deleted_at`) onde houver dado de paciente ou financeiro.

## 1. Diagrama (resumo)

```
plans ─┐
       ▼
organizations ──1:N── units
   │  │  │
   │  │  └──1:N── memberships ──N:1── auth.users ──1:1── profiles
   │  │                                   ▲
   │  └──1:N── professionals ─────────────┘ (user_id opcional)
   │              │  └─N:M─ services (professional_services)
   │              └──1:N── availability_rules / schedule_blocks
   │
   ├──1:N── patients ──1:N── appointments ──1:1── booking_requests
   │                          │   └──1:N── appointment_events
   │                          └──N:1── services, professionals, units
   ├──1:N── financial_entries ──N:1── financial_categories
   ├──1:1── subscriptions ── organization_features
   ├──1:N── import_jobs ──1:N── import_job_rows
   ├──1:N── export_jobs
   ├──1:N── external_identifiers
   └──1:N── audit_logs
```

## 2. Organizações, unidades e acesso

```sql
create type org_segment as enum (
  'medical_clinic','medical_office','dental_clinic','dental_office',
  'aesthetic_clinic','aesthetic_office','multidisciplinary','other');
create type org_status as enum ('trial','active','suspended','cancelled');

create table organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  slug citext not null unique,              -- usado em /agendar/[slug]
  segment org_segment not null,             -- tipo do ESTABELECIMENTO
  status org_status not null default 'trial',
  timezone text not null default 'America/Sao_Paulo',
  settings jsonb not null default '{}',     -- preferências de UI e agenda (validadas por Zod)
  onboarding jsonb,                         -- respostas do questionário
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug ~ '^[a-z0-9](-?[a-z0-9])*$' and length(slug) between 3 and 48)
);

create table organization_slug_history (     -- redireciona links antigos
  slug citext primary key,
  organization_id uuid not null references organizations(id) on delete cascade,
  replaced_at timestamptz not null default now()
);

create table units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  address jsonb,
  timezone text,                             -- null = herda da organização
  is_default boolean not null default false,
  created_at timestamptz not null default now()
);
create unique index one_default_unit on units(organization_id) where is_default;

create table profiles (                      -- dados da PESSOA usuária, globais
  user_id uuid primary key references auth.users(id) on delete cascade,
  full_name text not null,
  phone text,
  created_at timestamptz not null default now()
);

create type member_role as enum ('manager','reception','professional');
create type member_status as enum ('invited','active','disabled');

create table memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role member_role not null,                 -- NÍVEL DE ACESSO
  status member_status not null default 'invited',
  invited_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table role_permissions (              -- matriz semeada por migração; base p/ papéis customizados
  role member_role not null,
  permission text not null,
  primary key (role, permission)
);

create table platform_admins (               -- equipe do SaaS; fora do alcance do cliente
  user_id uuid primary key references auth.users(id),
  created_at timestamptz not null default now()
);
```

## 3. Profissionais e serviços

```sql
create table professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  user_id uuid references auth.users(id),    -- opcional: profissional pode não usar o sistema
  display_name text not null,
  specialty text,                            -- especialidade do PROFISSIONAL (≠ segmento da clínica)
  council_type text,                         -- CRM, CRO, CRBM... (opcional)
  council_number text,
  color text not null default 'blue',        -- token de cor da agenda, não hex livre
  accepts_public_booking boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  unique (organization_id, user_id)
);

create table professional_units (
  professional_id uuid references professionals(id) on delete cascade,
  unit_id uuid references units(id) on delete cascade,
  primary key (professional_id, unit_id)
);

create table services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  name text not null,
  category text,                             -- consulta, procedimento, sessão, retorno...
  duration_min int not null check (duration_min between 5 and 720),
  buffer_after_min int not null default 0 check (buffer_after_min between 0 and 120),
  price_cents bigint check (price_cents >= 0),
  show_price_publicly boolean not null default false,
  is_public boolean not null default true,   -- aparece na página pública
  active boolean not null default true,
  created_at timestamptz not null default now()
);

create table professional_services (
  professional_id uuid references professionals(id) on delete cascade,
  service_id uuid references services(id) on delete cascade,
  duration_min_override int,
  price_cents_override bigint,
  primary key (professional_id, service_id)
);
```

## 4. Pacientes

```sql
create table patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  full_name text not null,
  phone_e164 text,                           -- normalizado (+5511...)
  email citext,
  birth_date date,
  admin_notes text,                          -- SOMENTE administrativo (aviso na UI)
  extra jsonb not null default '{}',         -- campos adicionais por segmento, validados por schema
  source text not null default 'manual',     -- manual | public_booking | import:<job_id> | integration:<sistema>
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz
);
create index patients_phone on patients(organization_id, phone_e164) where deleted_at is null;
create index patients_email on patients(organization_id, email) where deleted_at is null;
create index patients_name_trgm on patients using gin (full_name gin_trgm_ops); -- busca por nome
```

Registros clínicos **não** entram nesta tabela. O futuro prontuário terá tabelas próprias,
permissões próprias (`clinical.*`) e trilha de auditoria de leitura.

## 5. Disponibilidade e agenda

```sql
create table availability_rules (            -- "seg 08:00–12:00 na unidade X"
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  professional_id uuid not null references professionals(id) on delete cascade,
  unit_id uuid not null references units(id),
  weekday smallint not null check (weekday between 0 and 6),
  start_time time not null,
  end_time time not null check (end_time > start_time),
  valid_from date, valid_to date
);

create type block_kind as enum ('break','time_off','vacation','holiday','other');
create table schedule_blocks (               -- bloqueios pontuais, férias, feriados
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),         -- null = organização inteira
  professional_id uuid references professionals(id), -- null = todos
  kind block_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null check (ends_at > starts_at),
  reason text
);

create type appointment_status as enum (
  'requested',   -- Aguardando aprovação (origem pública)
  'confirmed',   -- Confirmado
  'declined',    -- Recusado
  'expired',     -- Solicitação não respondida a tempo
  'cancelled',   -- Cancelado
  'no_show',     -- Faltou
  'completed');  -- Concluído
create type appointment_origin as enum ('staff','public','import','integration');

create table appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid not null references units(id),
  professional_id uuid not null references professionals(id),
  service_id uuid not null references services(id),
  patient_id uuid references patients(id),   -- null enquanto solicitação pública não é vinculada
  starts_at timestamptz not null,
  ends_at timestamptz not null,              -- inclui buffer pós-atendimento
  status appointment_status not null,
  origin appointment_origin not null,
  hold_expires_at timestamptz,               -- reserva temporária (só 'requested')
  admin_notes text,
  created_by uuid references auth.users(id), -- null = paciente pela página pública
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (status <> 'requested' or hold_expires_at is not null),

  -- GARANTIA DE NÃO CONFLITO NO BANCO (não depende do frontend)
  constraint no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('requested','confirmed'))
);
create index appt_org_time on appointments(organization_id, starts_at);

create table appointment_events (            -- histórico de status, imutável
  id bigint generated always as identity primary key,
  appointment_id uuid not null references appointments(id) on delete cascade,
  organization_id uuid not null,
  from_status appointment_status,
  to_status appointment_status not null,
  actor_user_id uuid,                        -- null = paciente/sistema
  reason text,
  created_at timestamptz not null default now()
);

create table booking_requests (              -- dados informados pelo paciente na página pública
  appointment_id uuid primary key references appointments(id) on delete cascade,
  organization_id uuid not null,
  contact_name text not null,
  contact_phone_e164 text not null,
  contact_email citext,
  message text,
  status_token_hash bytea not null unique,   -- sha256 do token; o token só existe no link
  consent_version text not null,             -- versão do aviso de privacidade aceito
  consent_at timestamptz not null,
  client_ip_hash bytea,                      -- p/ limite de abuso, sem guardar IP puro
  created_at timestamptz not null default now()
);
```

**Por que a solicitação pública é um `appointment`:** a agenda pública e a administrativa leem a
mesma tabela, e a mesma restrição `no_overlap` impede que duas solicitações (ou uma solicitação
e um agendamento interno) peguem o mesmo horário. **Por que os dados de contato ficam em
`booking_requests`:** o visitante anônimo nunca cria nem lê registros de `patients`; a recepção
vincula a um paciente existente ou cria um novo ao aprovar, evitando duplicidade e exposição.

**Reservas expiradas:** a função de solicitação primeiro marca como `expired` as reservas vencidas
do mesmo profissional (na mesma transação), e um job `pg_cron` a cada 5 min faz a limpeza geral.
Assim, um horário nunca fica preso por uma reserva vencida.

## 6. Financeiro

```sql
create type fin_type as enum ('income','expense');
create type fin_status as enum ('pending','paid','cancelled');

create table financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  type fin_type not null,
  name text not null
);

create table financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  unit_id uuid references units(id),
  type fin_type not null,
  category_id uuid references financial_categories(id),
  description text not null,
  amount_cents bigint not null check (amount_cents > 0),
  due_date date not null,
  paid_at date,
  status fin_status not null default 'pending',
  payment_method text,                       -- pix, dinheiro, cartão... (lista configurável)
  patient_id uuid references patients(id),
  appointment_id uuid references appointments(id),
  professional_id uuid references professionals(id),
  created_by uuid references auth.users(id),
  created_at timestamptz not null default now(),
  deleted_at timestamptz,
  check ((status = 'paid') = (paid_at is not null))
);
```

## 7. Assinaturas e funcionalidades

```sql
create table plans (
  id uuid primary key default gen_random_uuid(),
  code text unique not null,                 -- 'starter', 'pro'...
  name text not null,
  limits jsonb not null,                     -- {"professionals":3,"members":5,"storage_mb":500}
  features text[] not null,                  -- {'public_booking','finance','import'}
  active boolean not null default true
);

create type sub_status as enum ('trialing','active','past_due','suspended','cancelled');
create table subscriptions (
  organization_id uuid primary key references organizations(id) on delete cascade,
  plan_id uuid not null references plans(id),
  status sub_status not null,
  current_period_end date,
  billing_notes text,                        -- cobrança manual no MVP
  updated_by uuid references auth.users(id),
  updated_at timestamptz not null default now()
);

create table organization_features (         -- liga/desliga módulos (onboarding e plano)
  organization_id uuid references organizations(id) on delete cascade,
  feature text not null,
  enabled boolean not null,
  primary key (organization_id, feature)
);
```

Funcionalidade disponível = **está no plano** E **está habilitada pela clínica**.

## 8. Importação, exportação e integrações

```sql
create type job_status as enum ('uploaded','mapped','validated','importing','done','failed','cancelled');

create table import_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity text not null check (entity in ('patients','professionals','services')), -- 'appointments' depois
  file_path text not null,                   -- Storage privado, removido após N dias
  file_sha256 bytea not null,
  column_mapping jsonb,
  status job_status not null default 'uploaded',
  totals jsonb,                              -- {"rows":500,"created":480,"skipped":15,"errors":5}
  created_by uuid not null references auth.users(id),
  created_at timestamptz not null default now(),
  finished_at timestamptz
);

create table import_job_rows (
  id bigint generated always as identity primary key,
  job_id uuid not null references import_jobs(id) on delete cascade,
  organization_id uuid not null,
  row_number int not null,
  raw jsonb not null,
  normalized jsonb,
  outcome text check (outcome in ('valid','invalid','duplicate','created','updated','skipped')),
  messages text[],
  target_id uuid                             -- registro criado/atualizado
);

create table export_jobs (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  scope text[] not null,
  format text not null check (format in ('csv','xlsx')),
  file_path text,                            -- link assinado expira em 15 min; arquivo some em 24 h
  requested_by uuid not null references auth.users(id),
  created_at timestamptz not null default now()
);

create table external_identifiers (          -- base para integrações futuras
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references organizations(id) on delete cascade,
  entity text not null,                      -- 'patient','professional','service','appointment'
  entity_id uuid not null,
  system text not null,                      -- 'import:clinicorp', 'fhir:<base-url>', 'tuss'...
  external_id text not null,
  last_synced_at timestamptz,
  unique (organization_id, system, entity, external_id)
);
```

## 9. Auditoria

```sql
create table audit_logs (
  id bigint generated always as identity primary key,
  organization_id uuid,                      -- null = ação de plataforma
  actor_user_id uuid,
  actor_kind text not null,                  -- 'member','platform_admin','public','system'
  action text not null,                      -- 'patient.update','export.create','member.role_change'
  entity text, entity_id uuid,
  changes jsonb,                             -- campos alterados (sem conteúdo de notas livres)
  ip_hash bytea,
  created_at timestamptz not null default now()
);
-- Sem políticas de UPDATE/DELETE: tabela só-anexar. Retenção mínima proposta: 5 anos.
```

## 10. RLS — padrão de políticas

```sql
-- Funções auxiliares em schema não exposto; security definer evita recursão de RLS
create schema app;

create function app.is_member(org uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = org and m.user_id = (select auth.uid()) and m.status = 'active')
$$;

create function app.has_perm(org uuid, perm text) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.organization_id = org and m.user_id = (select auth.uid())
      and m.status = 'active' and rp.permission = perm)
$$;

create function app.org_writable(org uuid) returns boolean   -- suspensa = somente leitura
language sql stable security definer set search_path = '' as $$
  select status in ('trial','active') from public.organizations where id = org
$$;

-- Exemplo: pacientes
alter table patients enable row level security;

create policy patients_select on patients for select to authenticated using (
  deleted_at is null and (
    app.has_perm(organization_id, 'patients.read_all')
    or (app.has_perm(organization_id, 'patients.read_own') and exists (
         select 1 from appointments a join professionals p on p.id = a.professional_id
         where a.patient_id = patients.id and p.user_id = (select auth.uid())))
  ));

create policy patients_insert on patients for insert to authenticated with check (
  app.has_perm(organization_id, 'patients.write') and app.org_writable(organization_id));

create policy patients_update on patients for update to authenticated
  using (app.has_perm(organization_id, 'patients.write'))
  with check (app.has_perm(organization_id, 'patients.write') and app.org_writable(organization_id));
-- Sem política de DELETE: exclusão é lógica (deleted_at) via função auditada.
```

Regras gerais de RLS:
1. Toda tabela com `organization_id` tem RLS habilitada; o role `anon` não tem nenhuma política.
2. A página pública acessa o banco **somente** por funções `security definer`
   (`public_get_booking_page`, `public_get_slots`, `public_request_booking`,
   `public_get_request_status`, `public_cancel_request`) que retornam apenas o necessário
   (nunca nomes de outros pacientes).
3. Índices em `organization_id` em todas as tabelas (desempenho das políticas).
4. Teste pgTAP para cada tabela: usuário da clínica A não lê, não cria, não altera e não apaga nada da clínica B.
