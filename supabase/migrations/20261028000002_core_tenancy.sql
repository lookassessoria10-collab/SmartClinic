-- 0002 — Organizações (clínicas), unidades, histórico de slug e perfis.
-- Modelo: docs/03-modelo-de-dados.md §2. Regras: RN-01, RN-04.

create type public.org_segment as enum (
  'medical_clinic', 'medical_office', 'dental_clinic', 'dental_office',
  'aesthetic_clinic', 'aesthetic_office', 'multidisciplinary', 'other'
);
create type public.org_status as enum ('trial', 'active', 'suspended', 'cancelled');

-- Palavras que não podem virar slug (colidem com rotas ou confundem o usuário).
create function app.is_reserved_slug(p_slug text) returns boolean
language sql immutable
set search_path = ''
as $$
  select p_slug = any (array[
    'admin', 'api', 'app', 'agendar', 'ajuda', 'assets', 'auth', 'cadastro', 'clinica',
    'convite', 'gestao', 'login', 'onboarding', 'perfil', 'public', 'redefinir-senha',
    'static', 'status', 'suporte', 'www'
  ]);
$$;

create table public.organizations (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 120),
  slug extensions.citext not null unique,
  segment public.org_segment not null,
  status public.org_status not null default 'trial',
  timezone text not null default 'America/Sao_Paulo',
  phone text,
  settings jsonb not null default '{}',
  onboarding jsonb,
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint slug_format check (slug::text ~ '^[a-z0-9](-?[a-z0-9])*$' and length(slug) between 3 and 48),
  constraint slug_not_reserved check (not app.is_reserved_slug(slug::text))
);
create trigger organizations_touch before update on public.organizations
  for each row execute function app.touch_updated_at();

-- Slugs antigos redirecionam por 90 dias e não podem ser usados por outra clínica nesse período.
create table public.organization_slug_history (
  slug extensions.citext primary key,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  replaced_at timestamptz not null default now()
);
create index on public.organization_slug_history (organization_id);

create table public.units (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  address jsonb,
  timezone text, -- null = herda da organização
  is_default boolean not null default false,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index on public.units (organization_id);
create unique index units_one_default on public.units (organization_id) where is_default;
create trigger units_touch before update on public.units
  for each row execute function app.touch_updated_at();

-- Dados da pessoa usuária, independentes de clínica.
create table public.profiles (
  user_id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 1 and 120),
  phone text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create trigger profiles_touch before update on public.profiles
  for each row execute function app.touch_updated_at();

-- Cria o perfil junto com o usuário do Supabase Auth (nome vem dos metadados do cadastro).
create function app.handle_new_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  insert into public.profiles (user_id, full_name)
  values (
    new.id,
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'full_name'), ''), split_part(new.email, '@', 1))
  );
  return new;
end;
$$;
create trigger on_auth_user_created after insert on auth.users
  for each row execute function app.handle_new_user();
