-- 0006 — Row Level Security e privilégios.
-- Princípios (docs/04 §3, docs/09 S1):
--   1. RLS em TODAS as tabelas; `anon` sem privilégio algum.
--   2. Privilégios explícitos por coluna/operação (o Supabase não expõe mais tabelas novas
--      automaticamente; mesmo assim revogamos tudo antes, para não depender do padrão).
--   3. Escritas sensíveis (membros, convites, slug, criação de clínica) só via funções da 0007.

alter table public.organizations enable row level security;
alter table public.organization_slug_history enable row level security;
alter table public.units enable row level security;
alter table public.profiles enable row level security;
alter table public.memberships enable row level security;
alter table public.invitations enable row level security;
alter table public.role_permissions enable row level security;
alter table public.platform_admins enable row level security;
alter table public.professionals enable row level security;
alter table public.audit_logs enable row level security;

revoke all on all tables in schema public from anon, authenticated;
revoke all on all sequences in schema public from anon, authenticated;

-- organizations ---------------------------------------------------------------------------
grant select on public.organizations to authenticated;
-- `slug` e `status` NÃO são atualizáveis diretamente (slug via change_slug; status: plataforma).
grant update (name, timezone, phone, settings) on public.organizations to authenticated;

create policy organizations_select on public.organizations for select to authenticated
  using (app.is_member(id) or app.is_platform_admin());

create policy organizations_update on public.organizations for update to authenticated
  using (app.has_perm(id, 'org.settings'))
  with check (app.has_perm(id, 'org.settings') and app.org_writable(id));

-- organization_slug_history ---------------------------------------------------------------
grant select on public.organization_slug_history to authenticated;
create policy slug_history_select on public.organization_slug_history for select to authenticated
  using (app.is_member(organization_id));

-- units -----------------------------------------------------------------------------------
grant select on public.units to authenticated;
grant insert (organization_id, name, address, timezone) on public.units to authenticated;
grant update (name, address, timezone) on public.units to authenticated;

create policy units_select on public.units for select to authenticated
  using (app.is_member(organization_id));
create policy units_insert on public.units for insert to authenticated
  with check (app.has_perm(organization_id, 'org.settings') and app.org_writable(organization_id));
create policy units_update on public.units for update to authenticated
  using (app.has_perm(organization_id, 'org.settings'))
  with check (app.has_perm(organization_id, 'org.settings') and app.org_writable(organization_id));

-- profiles --------------------------------------------------------------------------------
grant select on public.profiles to authenticated;
grant update (full_name, phone) on public.profiles to authenticated;

create policy profiles_select on public.profiles for select to authenticated
  using (user_id = (select auth.uid()) or app.shares_org_with(user_id));
create policy profiles_update on public.profiles for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- memberships (somente leitura; escrita via funções) -------------------------------------
grant select on public.memberships to authenticated;
create policy memberships_select on public.memberships for select to authenticated
  using (user_id = (select auth.uid()) or app.is_member(organization_id));

-- invitations (somente leitura para quem gerencia membros) -------------------------------
grant select (id, organization_id, email, role, invited_by, expires_at, accepted_at, revoked_at, created_at)
  on public.invitations to authenticated; -- token_hash nunca sai do banco
create policy invitations_select on public.invitations for select to authenticated
  using (app.has_perm(organization_id, 'members.manage'));

-- role_permissions (pública para usuários logados: não é dado sensível) -------------------
grant select on public.role_permissions to authenticated;
create policy role_permissions_select on public.role_permissions for select to authenticated
  using (true);

-- platform_admins (cada um só vê a própria linha) -----------------------------------------
grant select on public.platform_admins to authenticated;
create policy platform_admins_select on public.platform_admins for select to authenticated
  using (user_id = (select auth.uid()));

-- professionals ---------------------------------------------------------------------------
grant select on public.professionals to authenticated;
grant insert (organization_id, user_id, display_name, specialty, council_type, council_number, color, accepts_public_booking)
  on public.professionals to authenticated;
grant update (display_name, specialty, council_type, council_number, color, accepts_public_booking, active)
  on public.professionals to authenticated;

create policy professionals_select on public.professionals for select to authenticated
  using (app.is_member(organization_id));
create policy professionals_insert on public.professionals for insert to authenticated
  with check (app.has_perm(organization_id, 'professionals.manage') and app.org_writable(organization_id));
create policy professionals_update on public.professionals for update to authenticated
  using (app.has_perm(organization_id, 'professionals.manage'))
  with check (app.has_perm(organization_id, 'professionals.manage') and app.org_writable(organization_id));

-- audit_logs (só leitura, para quem tem audit.read) ----------------------------------------
grant select on public.audit_logs to authenticated;
create policy audit_logs_select on public.audit_logs for select to authenticated
  using (organization_id is not null and app.has_perm(organization_id, 'audit.read'));
