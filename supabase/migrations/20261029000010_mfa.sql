-- 0010 — Verificação em duas etapas (MFA/TOTP) aplicada no BANCO, não só na tela (D-19).
--
-- Quem ativou MFA só acessa dados depois do segundo passo: a sessão precisa estar no nível
-- `aal2`. Uma sessão parada na senha (`aal1`) não lê nem altera nada, nem chamando a API
-- direto. Admin da plataforma: MFA obrigatório sempre (aal2 ou nada).
--
-- Como: as funções de autorização da 0005 passam a exigir app.mfa_ok(). Como todas as políticas
-- e funções de escrita da 0007 usam is_member/has_perm, a regra vale em tudo de uma vez.

create function app.mfa_ok() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
      or not exists (
        select 1 from auth.mfa_factors f
         where f.user_id = (select auth.uid()) and f.status = 'verified'
      );
$$;

create or replace function app.is_member(p_org uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.mfa_ok() and exists (
    select 1 from public.memberships m
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
  );
$$;

create or replace function app.has_perm(p_org uuid, p_perm text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.mfa_ok() and exists (
    select 1
    from public.memberships m
    join public.role_permissions rp on rp.role = m.role
    where m.organization_id = p_org
      and m.user_id = (select auth.uid())
      and m.status = 'active'
      and rp.permission = p_perm
  );
$$;

create or replace function app.shares_org_with(p_user uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.mfa_ok() and exists (
    select 1
    from public.memberships me
    join public.memberships other on other.organization_id = me.organization_id
    where me.user_id = (select auth.uid())
      and me.status = 'active'
      and other.user_id = p_user
  );
$$;

-- Admin da plataforma: sempre com o segundo passo concluído.
create or replace function app.is_platform_admin() returns boolean
language sql stable security definer
set search_path = ''
as $$
  select coalesce((select auth.jwt()) ->> 'aal', 'aal1') = 'aal2'
     and exists (select 1 from public.platform_admins where user_id = (select auth.uid()));
$$;

-- Políticas de "a própria linha" não passam pelas funções acima: recebem a mesma exigência.
alter policy profiles_select on public.profiles
  using ((user_id = (select auth.uid()) and app.mfa_ok()) or app.shares_org_with(user_id));
alter policy profiles_update on public.profiles
  using (user_id = (select auth.uid()) and app.mfa_ok())
  with check (user_id = (select auth.uid()) and app.mfa_ok());
alter policy memberships_select on public.memberships
  using ((user_id = (select auth.uid()) and app.mfa_ok()) or app.is_member(organization_id));
alter policy platform_admins_select on public.platform_admins
  using (user_id = (select auth.uid()) and app.mfa_ok());

revoke execute on function app.mfa_ok() from public, anon;
grant execute on function app.mfa_ok() to authenticated;
