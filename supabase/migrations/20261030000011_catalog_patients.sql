-- 0011 — Fase 4: serviços, vínculo profissional↔serviço e pacientes (docs/03 §3–4, docs/16).
-- Mesmos princípios da 0006: RLS em tudo, privilégios por coluna, `anon` sem nada.

-- Chaves compostas (id, organization_id): as tabelas filhas referenciam o par, então o banco
-- impede ligar um registro de uma clínica a outro de outra clínica, mesmo por escrita direta.
alter table public.professionals add constraint professionals_id_org unique (id, organization_id);

-- Profissional ligado a uma conta precisa ser membro da mesma clínica.
create function app.check_professional_user() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if new.user_id is not null and not exists (
    select 1 from public.memberships m
    where m.organization_id = new.organization_id and m.user_id = new.user_id
  ) then
    raise exception 'A pessoa precisa fazer parte da equipe da clínica.'
      using errcode = 'P0001', hint = 'not_a_member';
  end if;
  return new;
end;
$$;
create trigger professionals_check_user before insert or update of user_id on public.professionals
  for each row execute function app.check_professional_user();

grant update (user_id) on public.professionals to authenticated;

-- services ----------------------------------------------------------------------------------
create table public.services (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (length(btrim(name)) between 1 and 120),
  category text check (category is null or length(category) <= 60),
  duration_min integer not null check (duration_min between 5 and 720),
  buffer_after_min integer not null default 0 check (buffer_after_min between 0 and 120),
  price_cents bigint check (price_cents is null or price_cents between 0 and 100000000),
  show_price_publicly boolean not null default false,
  is_public boolean not null default true,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint services_id_org unique (id, organization_id)
);
create index on public.services (organization_id);
create trigger services_touch before update on public.services
  for each row execute function app.touch_updated_at();

create table public.professional_services (
  professional_id uuid not null,
  service_id uuid not null,
  organization_id uuid not null references public.organizations (id) on delete cascade,
  primary key (professional_id, service_id),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade,
  foreign key (service_id, organization_id) references public.services (id, organization_id) on delete cascade
);
create index on public.professional_services (organization_id);
create index on public.professional_services (service_id);

-- patients ----------------------------------------------------------------------------------
-- Só dados ADMINISTRATIVOS. Prontuário, se existir um dia, terá tabelas e permissões próprias.
create table public.patients (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  full_name text not null check (length(btrim(full_name)) between 2 and 160),
  phone_e164 text check (phone_e164 is null or phone_e164 ~ '^\+[1-9][0-9]{7,14}$'),
  email extensions.citext check (email is null or email::text ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'),
  birth_date date check (birth_date is null or birth_date >= date '1900-01-01'),
  admin_notes text check (admin_notes is null or length(admin_notes) <= 2000),
  source text not null default 'manual' check (source in ('manual', 'public_booking', 'import')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  deleted_at timestamptz,
  constraint patients_id_org unique (id, organization_id)
);
create index on public.patients (organization_id, phone_e164) where deleted_at is null;
create index on public.patients (organization_id, email) where deleted_at is null;
create index patients_name_trgm on public.patients using gin (full_name extensions.gin_trgm_ops);
create trigger patients_touch before update on public.patients
  for each row execute function app.touch_updated_at();

-- Auditoria de dados pessoais: registra QUEM mudou O QUÊ (nomes dos campos), nunca os valores.
-- Assim a trilha não vira uma cópia dos dados do paciente que sobreviveria à exclusão.
create function app.audit_row_fields_only() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old jsonb := case when tg_op <> 'INSERT' then to_jsonb(old) end;
  v_new jsonb := case when tg_op <> 'DELETE' then to_jsonb(new) end;
  v_row jsonb := coalesce(v_new, v_old);
  v_fields jsonb;
begin
  if tg_op = 'UPDATE' then
    select jsonb_agg(key order by key) into v_fields
      from jsonb_each(v_new)
     where v_old -> key is distinct from value and key not in ('updated_at');
    if v_fields is null then
      return null;
    end if;
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, actor_kind, action, entity, entity_id, changes)
  values (
    (v_row ->> 'organization_id')::uuid,
    auth.uid(),
    case when auth.uid() is null then 'system' else 'member' end,
    tg_table_name || '.' || lower(tg_op),
    tg_table_name,
    (v_row ->> 'id')::uuid,
    case when v_fields is null then null else jsonb_build_object('fields', v_fields) end
  );
  return null;
end;
$$;

create trigger audit_services after insert or update or delete on public.services
  for each row execute function app.audit_row();
create trigger audit_professional_services after insert or delete on public.professional_services
  for each row execute function app.audit_row();
create trigger audit_patients after insert or update or delete on public.patients
  for each row execute function app.audit_row_fields_only();

-- RLS ---------------------------------------------------------------------------------------
alter table public.services enable row level security;
alter table public.professional_services enable row level security;
alter table public.patients enable row level security;

revoke all on public.services, public.professional_services, public.patients from anon, authenticated;

grant select on public.services to authenticated;
grant insert (organization_id, name, category, duration_min, buffer_after_min, price_cents, show_price_publicly, is_public)
  on public.services to authenticated;
grant update (name, category, duration_min, buffer_after_min, price_cents, show_price_publicly, is_public, active)
  on public.services to authenticated;

create policy services_select on public.services for select to authenticated
  using (app.is_member(organization_id));
create policy services_insert on public.services for insert to authenticated
  with check (app.has_perm(organization_id, 'services.manage') and app.org_writable(organization_id));
create policy services_update on public.services for update to authenticated
  using (app.has_perm(organization_id, 'services.manage'))
  with check (app.has_perm(organization_id, 'services.manage') and app.org_writable(organization_id));

grant select, insert, delete on public.professional_services to authenticated;
create policy professional_services_select on public.professional_services for select to authenticated
  using (app.is_member(organization_id));
create policy professional_services_insert on public.professional_services for insert to authenticated
  with check (app.has_perm(organization_id, 'services.manage') and app.org_writable(organization_id));
create policy professional_services_delete on public.professional_services for delete to authenticated
  using (app.has_perm(organization_id, 'services.manage') and app.org_writable(organization_id));

-- Pacientes: recepção e gestão veem todos; profissional vê os que cadastrou e (0012) os que
-- tem atendimento com ele (D-06). Exclusão só lógica, pela função delete_patient.
grant select on public.patients to authenticated;
grant insert (organization_id, full_name, phone_e164, email, birth_date, admin_notes)
  on public.patients to authenticated;
grant update (full_name, phone_e164, email, birth_date, admin_notes) on public.patients to authenticated;

create policy patients_select on public.patients for select to authenticated
  using (
    deleted_at is null and (
      app.has_perm(organization_id, 'patients.read_all')
      or (app.has_perm(organization_id, 'patients.read_own') and created_by = (select auth.uid()))
    )
  );
create policy patients_insert on public.patients for insert to authenticated
  with check (
    (app.has_perm(organization_id, 'patients.write') or app.has_perm(organization_id, 'patients.write_own'))
    and created_by = (select auth.uid())
    and app.org_writable(organization_id)
  );
create policy patients_update on public.patients for update to authenticated
  using (
    deleted_at is null and (
      app.has_perm(organization_id, 'patients.write')
      or (app.has_perm(organization_id, 'patients.write_own') and created_by = (select auth.uid()))
    )
  )
  with check (app.org_writable(organization_id));
