-- 0007 — Funções chamadas pela aplicação (expostas via API, só para `authenticated`).
-- Cada uma valida quem chama, roda numa transação e deixa trilha na auditoria (via gatilhos).
-- Erros usam errcode '42501' (sem permissão) ou 'P0001' com `hint` legível pela aplicação.

-- Disponibilidade de slug: livre, fora da lista reservada e fora da quarentena de 90 dias.
create function app.slug_free(p_slug text, p_for_org uuid default null) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select p_slug ~ '^[a-z0-9](-?[a-z0-9])*$'
     and length(p_slug) between 3 and 48
     and not app.is_reserved_slug(p_slug)
     and not exists (select 1 from public.organizations where slug = p_slug::extensions.citext)
     and not exists (
       select 1 from public.organization_slug_history h
       where h.slug = p_slug::extensions.citext
         and h.replaced_at > now() - interval '90 days'
         and h.organization_id is distinct from p_for_org
     );
$$;

create function public.slug_available(p_slug text) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.slug_free(lower(btrim(p_slug)));
$$;

-- Usuário com e-mail confirmado (convites e criação de clínica exigem).
create function app.current_confirmed_email() returns extensions.citext
language sql stable security definer
set search_path = ''
as $$
  select u.email::extensions.citext from auth.users u
  where u.id = (select auth.uid()) and u.email_confirmed_at is not null;
$$;

-- Onboarding: clínica + unidade padrão + gestor + profissional (se atende), atômico (docs/12 §3.5).
create function public.create_organization(
  p_name text,
  p_slug text,
  p_segment public.org_segment,
  p_onboarding jsonb default '{}',
  p_attends boolean default false,
  p_specialty text default null,
  p_timezone text default 'America/Sao_Paulo'
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_slug text := lower(btrim(p_slug));
  v_org uuid;
  v_name text;
begin
  if v_uid is null or app.current_confirmed_email() is null then
    raise exception 'Confirme seu e-mail antes de criar a clínica.' using errcode = '42501';
  end if;
  if (select count(*) from public.organizations where created_by = v_uid) >= 5 then
    raise exception 'Limite de clínicas criadas atingido.' using errcode = 'P0001', hint = 'org_limit';
  end if;
  if not app.slug_free(v_slug) then
    raise exception 'Este endereço já está em uso ou não é permitido.' using errcode = 'P0001', hint = 'slug_unavailable';
  end if;
  if not exists (select 1 from pg_catalog.pg_timezone_names where name = p_timezone) then
    raise exception 'Fuso horário inválido.' using errcode = 'P0001', hint = 'invalid_timezone';
  end if;

  insert into public.organizations (name, slug, segment, timezone, onboarding, created_by)
  values (btrim(p_name), v_slug, p_segment, p_timezone, coalesce(p_onboarding, '{}'), v_uid)
  returning id into v_org;

  insert into public.units (organization_id, name, is_default)
  values (v_org, 'Unidade principal', true);

  insert into public.memberships (organization_id, user_id, role, status)
  values (v_org, v_uid, 'manager', 'active');

  if p_attends then
    select full_name into v_name from public.profiles where user_id = v_uid;
    insert into public.professionals (organization_id, user_id, display_name, specialty)
    values (v_org, v_uid, coalesce(v_name, 'Profissional'), nullif(btrim(p_specialty), ''));
  end if;

  return v_org;
end;
$$;

-- Convite: devolve o token em claro UMA vez (para o e-mail); o banco guarda só o hash.
-- Reenviar = revogar o convite aberto e criar outro.
create function public.create_invitation(p_org uuid, p_email text, p_role public.member_role)
returns text
language plpgsql security definer
set search_path = ''
as $$
declare
  v_email extensions.citext := lower(btrim(p_email))::extensions.citext;
  v_token text := encode(extensions.gen_random_bytes(32), 'hex');
begin
  if not app.has_perm(p_org, 'members.manage') then
    raise exception 'Sem permissão para convidar.' using errcode = '42501';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if v_email::text !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'E-mail inválido.' using errcode = 'P0001', hint = 'invalid_email';
  end if;
  if exists (
    select 1 from public.memberships m join auth.users u on u.id = m.user_id
    where m.organization_id = p_org and m.status = 'active' and u.email::extensions.citext = v_email
  ) then
    raise exception 'Esta pessoa já faz parte da equipe.' using errcode = 'P0001', hint = 'already_member';
  end if;

  update public.invitations set revoked_at = now()
  where organization_id = p_org and email = v_email and accepted_at is null and revoked_at is null;

  insert into public.invitations (organization_id, email, role, token_hash, invited_by)
  values (p_org, v_email, p_role, extensions.digest(v_token, 'sha256'), auth.uid());

  return v_token;
end;
$$;

create function public.revoke_invitation(p_invitation uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.invitations where id = p_invitation;
  if v_org is null or not app.has_perm(v_org, 'members.manage') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  update public.invitations set revoked_at = now()
  where id = p_invitation and accepted_at is null and revoked_at is null;
end;
$$;

-- Aceite: o e-mail CONFIRMADO de quem aceita precisa ser o do convite.
-- Mesma mensagem para token inexistente, vencido, revogado ou já usado (não revela qual).
create function public.accept_invitation(p_token text) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email extensions.citext := app.current_confirmed_email();
  v_inv public.invitations;
begin
  if v_uid is null or v_email is null then
    raise exception 'Confirme seu e-mail para aceitar o convite.' using errcode = '42501';
  end if;

  select * into v_inv from public.invitations
  where token_hash = extensions.digest(coalesce(p_token, ''), 'sha256')
    and accepted_at is null and revoked_at is null and expires_at > now()
  for update;

  if v_inv.id is null then
    raise exception 'Convite inválido ou expirado.' using errcode = 'P0001', hint = 'invitation_invalid';
  end if;
  if v_inv.email <> v_email then
    raise exception 'Este convite foi enviado para outro e-mail.' using errcode = 'P0001', hint = 'invitation_email_mismatch';
  end if;
  if not app.org_writable(v_inv.organization_id) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;

  insert into public.memberships (organization_id, user_id, role, status, invited_by)
  values (v_inv.organization_id, v_uid, v_inv.role, 'active', v_inv.invited_by)
  on conflict (organization_id, user_id)
  do update set role = excluded.role, status = 'active', invited_by = excluded.invited_by;

  update public.invitations set accepted_at = now() where id = v_inv.id;
  return v_inv.organization_id;
end;
$$;

-- Papel e situação de membros. O gatilho memberships_keep_manager garante o último gestor;
-- aqui a verificação é repetida só para devolver uma mensagem clara.
create function app.assert_manages_member(p_membership uuid) returns uuid
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.memberships where id = p_membership;
  if v_org is null or not app.has_perm(v_org, 'members.manage') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  return v_org;
end;
$$;

create function public.change_member_role(p_membership uuid, p_role public.member_role) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.assert_manages_member(p_membership);
  update public.memberships set role = p_role where id = p_membership;
end;
$$;

create function public.set_member_status(p_membership uuid, p_status public.member_status) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if p_status not in ('active', 'disabled') then
    raise exception 'Situação inválida.' using errcode = 'P0001', hint = 'invalid_status';
  end if;
  perform app.assert_manages_member(p_membership);
  update public.memberships set status = p_status where id = p_membership;
end;
$$;

-- Troca de slug com histórico (RN-04): o antigo redireciona e fica reservado por 90 dias.
create function public.change_slug(p_org uuid, p_slug text) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_slug text := lower(btrim(p_slug));
  v_old extensions.citext;
begin
  if not app.has_perm(p_org, 'org.settings') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  select slug into v_old from public.organizations where id = p_org;
  if v_old = v_slug::extensions.citext then
    return;
  end if;
  if not app.slug_free(v_slug, p_org) then
    raise exception 'Este endereço já está em uso ou não é permitido.' using errcode = 'P0001', hint = 'slug_unavailable';
  end if;

  -- Retomar um slug antigo da própria clínica tira ele do histórico.
  delete from public.organization_slug_history where slug = v_slug::extensions.citext and organization_id = p_org;
  insert into public.organization_slug_history (slug, organization_id) values (v_old, p_org)
  on conflict (slug) do update set organization_id = excluded.organization_id, replaced_at = now();
  update public.organizations set slug = v_slug where id = p_org;
end;
$$;

revoke execute on function
  app.slug_free(text, uuid), app.current_confirmed_email(), app.assert_manages_member(uuid),
  public.slug_available(text),
  public.create_organization(text, text, public.org_segment, jsonb, boolean, text, text),
  public.create_invitation(uuid, text, public.member_role),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.change_member_role(uuid, public.member_role),
  public.set_member_status(uuid, public.member_status),
  public.change_slug(uuid, text)
from public, anon;

grant execute on function
  public.slug_available(text),
  public.create_organization(text, text, public.org_segment, jsonb, boolean, text, text),
  public.create_invitation(uuid, text, public.member_role),
  public.revoke_invitation(uuid),
  public.accept_invitation(text),
  public.change_member_role(uuid, public.member_role),
  public.set_member_status(uuid, public.member_status),
  public.change_slug(uuid, text)
to authenticated;
