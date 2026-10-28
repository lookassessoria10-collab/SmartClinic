-- 0003 — Acesso: membros, convites, matriz de permissões, admins da plataforma, profissionais.
-- Modelo: docs/03 §2–3 e docs/12 §4. Matriz: docs/04 §2.

create type public.member_role as enum ('manager', 'reception', 'professional');
create type public.member_status as enum ('invited', 'active', 'disabled');

-- Nível de acesso da pessoa NA clínica. "Ser profissional" fica em `professionals` (D-05).
create table public.memberships (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid not null references auth.users (id) on delete cascade,
  role public.member_role not null,
  status public.member_status not null default 'active',
  invited_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.memberships (user_id);
create trigger memberships_touch before update on public.memberships
  for each row execute function app.touch_updated_at();

create table public.invitations (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  email extensions.citext not null,
  role public.member_role not null,
  token_hash bytea not null unique, -- sha256; o token em claro só existe no link enviado
  invited_by uuid not null references auth.users (id) on delete cascade,
  expires_at timestamptz not null default now() + interval '7 days',
  accepted_at timestamptz,
  revoked_at timestamptz,
  created_at timestamptz not null default now()
);
create unique index invitations_one_open on public.invitations (organization_id, email)
  where accepted_at is null and revoked_at is null;

-- Matriz global de permissões por papel. Papéis personalizados por clínica: pós-MVP.
create table public.role_permissions (
  role public.member_role not null,
  permission text not null,
  primary key (role, permission)
);

insert into public.role_permissions (role, permission)
select 'manager'::public.member_role, p from unnest(array[
  'schedule.view_all',
  'appointments.read', 'appointments.read_own', 'appointments.write', 'appointments.write_own',
  'appointments.set_status', 'appointments.set_status_own',
  'booking_requests.review', 'booking_requests.review_own',
  'availability.manage', 'availability.manage_own',
  'patients.read_all', 'patients.read_own', 'patients.write', 'patients.write_own', 'patients.delete',
  'professionals.manage', 'services.manage',
  'finance.read', 'finance.write', 'finance.read_own',
  'members.manage', 'org.settings', 'data.import', 'data.export', 'audit.read'
]) p
union all
select 'reception'::public.member_role, p from unnest(array[
  'schedule.view_all',
  'appointments.read', 'appointments.write', 'appointments.set_status',
  'booking_requests.review', 'availability.manage',
  'patients.read_all', 'patients.read_own', 'patients.write',
  'finance.write'
]) p
union all
select 'professional'::public.member_role, p from unnest(array[
  'schedule.view_all',
  'appointments.read_own', 'appointments.write_own', 'appointments.set_status_own',
  'booking_requests.review_own', 'availability.manage_own',
  'patients.read_own', 'patients.write_own',
  'finance.read_own'
]) p;

-- Equipe do SaaS. Sem relação com clínicas; criada só por script (docs/12 §2).
create table public.platform_admins (
  user_id uuid primary key references auth.users (id) on delete cascade,
  created_at timestamptz not null default now()
);

-- Versão mínima para a Fase 3: o gestor que atende já vira profissional no onboarding (D-05).
-- A Fase 4 completa (unidades, serviços, conselho profissional na interface).
create table public.professionals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  user_id uuid references auth.users (id) on delete set null,
  display_name text not null check (length(btrim(display_name)) between 1 and 120),
  specialty text, -- do PROFISSIONAL, não do estabelecimento
  council_type text,
  council_number text,
  color smallint not null default 1 check (color between 1 and 8),
  accepts_public_booking boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (organization_id, user_id)
);
create index on public.professionals (organization_id);
create trigger professionals_touch before update on public.professionals
  for each row execute function app.touch_updated_at();

-- Defesa em profundidade: nenhuma clínica fica sem gestor ativo, nem por escrita direta.
create function app.ensure_active_manager() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid := coalesce(old.organization_id, new.organization_id);
begin
  -- Exclusão em cascata da própria clínica: nada a proteger.
  if not exists (select 1 from public.organizations where id = v_org) then
    return null;
  end if;
  if not exists (
    select 1 from public.memberships
    where organization_id = v_org and role = 'manager' and status = 'active'
  ) then
    raise exception 'A clínica precisa de pelo menos um gestor ativo.'
      using errcode = 'P0001', hint = 'last_manager';
  end if;
  return null;
end;
$$;
-- Imediato (não adiado): trocar de gestor é promover o novo antes de rebaixar o antigo.
create trigger memberships_keep_manager
  after update or delete on public.memberships
  for each row execute function app.ensure_active_manager();
