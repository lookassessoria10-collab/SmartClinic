-- 0005 — Funções de autorização usadas pelas políticas RLS (docs/03 §10, docs/04 §3).
-- `security definer` evita recursão de RLS (as funções leem `memberships`, que também tem RLS).
-- `search_path = ''` + nomes qualificados impedem sequestro de funções/tabelas.

create function app.is_member(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create function app.has_perm(p_org uuid, p_perm text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission = p_perm
  );
$$;

-- Suspensa/cancelada = somente leitura (RN-72).
create function app.org_writable(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select o.status in ('trial', 'active') from public.organizations o where o.id = p_org), false);
$$;

create function app.is_platform_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- Pessoas que dividem alguma clínica ativa com quem consulta (para ver nomes da equipe).
create function app.shares_org_with(p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.memberships me
    join public.memberships other on other.organization_id = me.organization_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_user
  );
$$;

revoke execute on function
  app.is_member(uuid), app.has_perm(uuid, text), app.org_writable(uuid),
  app.is_platform_admin(), app.shares_org_with(uuid)
from public, anon;
grant execute on function
  app.is_member(uuid), app.has_perm(uuid, text), app.org_writable(uuid),
  app.is_platform_admin(), app.shares_org_with(uuid)
to authenticated;
