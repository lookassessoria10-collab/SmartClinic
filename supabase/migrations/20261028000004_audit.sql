-- 0004 — Auditoria só-anexar (docs/09 §4).
-- Nenhum papel de cliente pode inserir, alterar ou apagar: só os gatilhos (security definer)
-- e o servidor com a chave secreta (eventos sem usuário, ex.: login com falha).

create table public.audit_logs (
  id bigint generated always as identity primary key,
  -- Sem FK de propósito: o registro sobrevive à exclusão da clínica (retenção de 5 anos).
  organization_id uuid,
  actor_user_id uuid,
  actor_kind text not null check (actor_kind in ('member', 'platform_admin', 'public', 'system')),
  action text not null,            -- ex.: 'memberships.update', 'auth.login_failed'
  entity text,
  entity_id uuid,
  changes jsonb,                   -- só campos alterados; segredos removidos
  ip_hash bytea,
  created_at timestamptz not null default now()
);
create index on public.audit_logs (organization_id, created_at desc);

-- Campos que nunca vão para a auditoria.
create function app.redact(p jsonb) returns jsonb
language sql immutable
set search_path = ''
as $$
  select coalesce(p, '{}'::jsonb) - 'token_hash' - 'settings' - 'onboarding';
$$;

create function app.audit_row() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then app.redact(to_jsonb(old)) end;
  v_new jsonb := case when tg_op <> 'DELETE' then app.redact(to_jsonb(new)) end;
  v_changes jsonb;
  v_row jsonb := coalesce(v_new, v_old);
  v_org uuid;
  v_uid uuid := auth.uid();
begin
  if tg_op = 'UPDATE' then
    select jsonb_object_agg(key, jsonb_build_object('from', v_old -> key, 'to', value))
      into v_changes
      from jsonb_each(v_new)
     where v_old -> key is distinct from value and key not in ('updated_at');
    if v_changes is null then
      return null; -- nada relevante mudou
    end if;
  else
    v_changes := v_row;
  end if;

  v_org := case when tg_table_name = 'organizations' then (v_row ->> 'id')::uuid
                else (v_row ->> 'organization_id')::uuid end;

  insert into public.audit_logs (organization_id, actor_user_id, actor_kind, action, entity, entity_id, changes)
  values (
    v_org,
    v_uid,
    case when v_uid is null then 'system'
         when exists (select 1 from public.platform_admins where user_id = v_uid)
              and not exists (select 1 from public.memberships where user_id = v_uid and organization_id = v_org)
           then 'platform_admin'
         else 'member' end,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    coalesce((v_row ->> 'id')::uuid, null),
    v_changes
  );
  return null;
end;
$$;

create trigger audit_organizations after insert or update or delete on public.organizations
  for each row execute function app.audit_row();
create trigger audit_units after insert or update or delete on public.units
  for each row execute function app.audit_row();
create trigger audit_memberships after insert or update or delete on public.memberships
  for each row execute function app.audit_row();
create trigger audit_invitations after insert or update or delete on public.invitations
  for each row execute function app.audit_row();
create trigger audit_professionals after insert or update or delete on public.professionals
  for each row execute function app.audit_row();
