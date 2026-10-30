-- 0012 — Fase 5: horários de atendimento, bloqueios e agenda (docs/03 §5, docs/07 RN-10 a RN-25).
--
-- Garantias no banco (não dependem da tela):
--   • dois atendimentos ativos do mesmo profissional nunca se sobrepõem (exclusão GiST);
--   • agendamento só dentro do horário de atendimento e fora de bloqueios (fits_schedule);
--   • escrita só por funções, que conferem papel, "próprio" × "todos" e transições de status;
--   • profissional enxerga os atendimentos dos outros só como "Ocupado" (schedule_busy, ADR-015).

-- Horários de atendimento semanais ---------------------------------------------------------
create table public.availability_rules (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid not null,
  weekday smallint not null check (weekday between 0 and 6), -- 0 = domingo
  start_time time not null,
  end_time time not null,
  created_at timestamptz not null default now(),
  check (end_time > start_time),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade
);
create index on public.availability_rules (professional_id, weekday);
create index on public.availability_rules (organization_id);

-- Bloqueios: pausa, folga, férias, feriado. Sem profissional = clínica inteira.
create type public.block_kind as enum ('break', 'time_off', 'vacation', 'holiday', 'other');
create table public.schedule_blocks (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid,
  kind public.block_kind not null,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  reason text check (reason is null or length(reason) <= 200),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '366 days'),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade
);
create index on public.schedule_blocks (organization_id, starts_at);

-- Agendamentos -------------------------------------------------------------------------------
create type public.appointment_status as enum
  ('requested', 'confirmed', 'declined', 'expired', 'cancelled', 'no_show', 'completed');
create type public.appointment_origin as enum ('staff', 'public', 'import', 'integration');

create table public.appointments (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  professional_id uuid not null,
  service_id uuid not null,
  patient_id uuid, -- vazio só em solicitação pública ainda não vinculada (Fase 6)
  starts_at timestamptz not null,
  ends_at timestamptz not null, -- inclui o intervalo pós-atendimento do serviço
  status public.appointment_status not null,
  origin public.appointment_origin not null default 'staff',
  hold_expires_at timestamptz,
  admin_notes text check (admin_notes is null or length(admin_notes) <= 2000),
  created_by uuid references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '13 hours'),
  check (status <> 'requested' or hold_expires_at is not null),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id),
  foreign key (service_id, organization_id) references public.services (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients (id, organization_id),
  constraint appointments_no_overlap exclude using gist (
    professional_id with =,
    tstzrange(starts_at, ends_at, '[)') with &&
  ) where (status in ('requested', 'confirmed'))
);
create index on public.appointments (organization_id, starts_at);
create index on public.appointments (patient_id);
create trigger appointments_touch before update on public.appointments
  for each row execute function app.touch_updated_at();

-- Histórico imutável de cada agendamento (quem mudou o status, quando e por quê).
create table public.appointment_events (
  id bigint generated always as identity primary key,
  appointment_id uuid not null references public.appointments (id) on delete cascade,
  organization_id uuid not null,
  from_status public.appointment_status,
  to_status public.appointment_status not null,
  actor_user_id uuid,
  reason text,
  created_at timestamptz not null default now()
);
create index on public.appointment_events (appointment_id);

create trigger audit_schedule_blocks after insert or update or delete on public.schedule_blocks
  for each row execute function app.audit_row();
-- Agendamento cita paciente: auditoria só com os nomes dos campos (como em patients).
create trigger audit_appointments after insert or update or delete on public.appointments
  for each row execute function app.audit_row_fields_only();

-- Funções auxiliares --------------------------------------------------------------------------

-- O profissional é a própria pessoa logada?
create function app.is_my_professional(p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.professionals p
    where p.id = p_professional and p.user_id = (select auth.uid())
  );
$$;

-- Paciente com algum atendimento com a pessoa logada (visibilidade do profissional, D-06).
create function app.is_my_patient(p_patient uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.appointments a
    join public.professionals p on p.id = a.professional_id
    where a.patient_id = p_patient and p.user_id = (select auth.uid())
  );
$$;

-- Cabe no horário de atendimento (no fuso da clínica) e não cai em bloqueio?
create function app.fits_schedule(p_professional uuid, p_start timestamptz, p_end timestamptz) returns boolean
language sql stable security definer
set search_path = ''
as $$
  with ctx as (
    select p.organization_id, o.timezone,
           (p_start at time zone o.timezone) as s,
           (p_end at time zone o.timezone) as e
    from public.professionals p
    join public.organizations o on o.id = p.organization_id
    where p.id = p_professional
  )
  select exists (
           select 1 from public.availability_rules r, ctx
           where r.professional_id = p_professional
             and r.weekday = extract(dow from ctx.s)
             and ctx.s::date = ctx.e::date
             and ctx.s::time >= r.start_time
             and ctx.e::time <= r.end_time
         )
     and not exists (
           select 1 from public.schedule_blocks b, ctx
           where b.organization_id = ctx.organization_id
             and (b.professional_id is null or b.professional_id = p_professional)
             and tstzrange(b.starts_at, b.ends_at, '[)') && tstzrange(p_start, p_end, '[)')
         );
$$;

-- Pode escrever na agenda deste profissional? ('appointments.write' ou o próprio com '_own').
create function app.can_write_schedule(p_org uuid, p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'appointments.write')
      or (app.has_perm(p_org, 'appointments.write_own') and app.is_my_professional(p_professional));
$$;

create function app.can_see_patient(p_org uuid, p_patient uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'patients.read_all')
      or (app.has_perm(p_org, 'patients.read_own') and (
            exists (select 1 from public.patients where id = p_patient and created_by = (select auth.uid()))
            or app.is_my_patient(p_patient)));
$$;

-- Profissional passa a ver os pacientes que atende.
alter policy patients_select on public.patients
  using (
    deleted_at is null and (
      app.has_perm(organization_id, 'patients.read_all')
      or (app.has_perm(organization_id, 'patients.read_own')
          and (created_by = (select auth.uid()) or app.is_my_patient(id)))
    )
  );
alter policy patients_update on public.patients
  using (
    deleted_at is null and (
      app.has_perm(organization_id, 'patients.write')
      or (app.has_perm(organization_id, 'patients.write_own')
          and (created_by = (select auth.uid()) or app.is_my_patient(id)))
    )
  );

-- RLS -----------------------------------------------------------------------------------------
alter table public.availability_rules enable row level security;
alter table public.schedule_blocks enable row level security;
alter table public.appointments enable row level security;
alter table public.appointment_events enable row level security;

revoke all on public.availability_rules, public.schedule_blocks, public.appointments, public.appointment_events
  from anon, authenticated;

-- Horários: todos da clínica leem (para montar a agenda); escrita só por set_weekly_availability.
grant select on public.availability_rules to authenticated;
create policy availability_select on public.availability_rules for select to authenticated
  using (app.is_member(organization_id));

-- Bloqueios: gestão/recepção para qualquer um; profissional só os próprios.
grant select, delete on public.schedule_blocks to authenticated;
grant insert (organization_id, professional_id, kind, starts_at, ends_at, reason) on public.schedule_blocks to authenticated;
create policy blocks_select on public.schedule_blocks for select to authenticated
  using (app.is_member(organization_id));
create policy blocks_insert on public.schedule_blocks for insert to authenticated
  with check (
    app.org_writable(organization_id)
    and created_by = (select auth.uid())
    and (app.has_perm(organization_id, 'availability.manage')
         or (professional_id is not null and app.has_perm(organization_id, 'availability.manage_own')
             and app.is_my_professional(professional_id)))
  );
create policy blocks_delete on public.schedule_blocks for delete to authenticated
  using (
    app.org_writable(organization_id)
    and (app.has_perm(organization_id, 'availability.manage')
         or (professional_id is not null and app.has_perm(organization_id, 'availability.manage_own')
             and app.is_my_professional(professional_id)))
  );

-- Agendamentos: só leitura direta; escrita pelas funções abaixo.
grant select on public.appointments to authenticated;
create policy appointments_select on public.appointments for select to authenticated
  using (
    app.has_perm(organization_id, 'appointments.read')
    or (app.has_perm(organization_id, 'appointments.read_own') and app.is_my_professional(professional_id))
  );

grant select on public.appointment_events to authenticated;
create policy appointment_events_select on public.appointment_events for select to authenticated
  using (exists (select 1 from public.appointments a where a.id = appointment_id));

-- Funções chamadas pela aplicação ---------------------------------------------------------------

-- Grade semanal do profissional, substituída inteira (sem sobreposição entre faixas do mesmo dia).
-- p_rules: [{"weekday":1,"start":"08:00","end":"12:00"}, ...]
create function public.set_weekly_availability(p_professional uuid, p_rules jsonb) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.professionals where id = p_professional;
  if v_org is null or not (
       app.has_perm(v_org, 'availability.manage')
       or (app.has_perm(v_org, 'availability.manage_own') and app.is_my_professional(p_professional))) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if jsonb_typeof(p_rules) <> 'array' or jsonb_array_length(p_rules) > 50 then
    raise exception 'Horários inválidos.' using errcode = 'P0001', hint = 'invalid_rules';
  end if;

  delete from public.availability_rules where professional_id = p_professional;
  insert into public.availability_rules (organization_id, professional_id, weekday, start_time, end_time)
  select v_org, p_professional, (r ->> 'weekday')::smallint, (r ->> 'start')::time, (r ->> 'end')::time
  from jsonb_array_elements(p_rules) r;

  if exists (
    select 1 from public.availability_rules a
    join public.availability_rules b
      on b.professional_id = a.professional_id and b.weekday = a.weekday and b.id <> a.id
    where a.professional_id = p_professional
      and a.start_time < b.end_time and b.start_time < a.end_time
  ) then
    raise exception 'Há faixas de horário sobrepostas no mesmo dia.' using errcode = 'P0001', hint = 'overlapping_rules';
  end if;

  insert into public.audit_logs (organization_id, actor_user_id, actor_kind, action, entity, entity_id, changes)
  values (v_org, auth.uid(), 'member', 'availability_rules.replace', 'professionals', p_professional,
          jsonb_build_object('rules', p_rules));
exception
  when invalid_datetime_format or invalid_text_representation or check_violation or not_null_violation then
    raise exception 'Horários inválidos.' using errcode = 'P0001', hint = 'invalid_rules';
end;
$$;

-- Novo agendamento pela equipe: nasce confirmado (RN-21).
create function public.create_appointment(
  p_org uuid,
  p_professional uuid,
  p_service uuid,
  p_patient uuid,
  p_starts_at timestamptz,
  p_notes text default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_svc record;
  v_end timestamptz;
  v_id uuid;
begin
  if not app.can_write_schedule(p_org, p_professional) then
    raise exception 'Sem permissão para agendar para este profissional.' using errcode = '42501';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if not exists (select 1 from public.professionals where id = p_professional and organization_id = p_org and active) then
    raise exception 'Profissional inativo ou de outra clínica.' using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  select s.duration_min, s.buffer_after_min into v_svc
  from public.services s
  join public.professional_services ps on ps.service_id = s.id and ps.professional_id = p_professional
  where s.id = p_service and s.organization_id = p_org and s.active;
  if not found then
    raise exception 'Este profissional não oferece este serviço.' using errcode = 'P0001', hint = 'invalid_service';
  end if;
  if p_patient is null
     or not exists (select 1 from public.patients where id = p_patient and organization_id = p_org and deleted_at is null)
     or not app.can_see_patient(p_org, p_patient) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0001', hint = 'invalid_patient';
  end if;
  if p_starts_at < now() - interval '15 minutes' then
    raise exception 'Não é possível agendar no passado.' using errcode = 'P0001', hint = 'in_the_past';
  end if;

  v_end := p_starts_at + make_interval(mins => v_svc.duration_min + v_svc.buffer_after_min);
  if not app.fits_schedule(p_professional, p_starts_at, v_end) then
    raise exception 'Fora do horário de atendimento ou em um bloqueio.' using errcode = 'P0001', hint = 'outside_hours';
  end if;

  begin
    insert into public.appointments
      (organization_id, professional_id, service_id, patient_id, starts_at, ends_at, status, origin, admin_notes, created_by)
    values
      (p_org, p_professional, p_service, p_patient, p_starts_at, v_end, 'confirmed', 'staff',
       nullif(btrim(p_notes), ''), auth.uid())
    returning id into v_id;
  exception when exclusion_violation then
    raise exception 'Esse horário acabou de ser ocupado.' using errcode = 'P0001', hint = 'slot_taken';
  end;

  insert into public.appointment_events (appointment_id, organization_id, from_status, to_status, actor_user_id)
  values (v_id, p_org, null, 'confirmed', auth.uid());
  return v_id;
end;
$$;

-- Remarcar (RN-24): mesmo registro, mesmas validações. Profissional pode mudar (opcional).
create function public.reschedule_appointment(p_id uuid, p_starts_at timestamptz, p_professional uuid default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_prof uuid;
  v_svc record;
  v_end timestamptz;
begin
  select * into v_a from public.appointments where id = p_id;
  if v_a.id is null or not app.can_write_schedule(v_a.organization_id, v_a.professional_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  v_prof := coalesce(p_professional, v_a.professional_id);
  if not app.can_write_schedule(v_a.organization_id, v_prof) then
    raise exception 'Sem permissão para agendar para este profissional.' using errcode = '42501';
  end if;
  if not app.org_writable(v_a.organization_id) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if v_a.status <> 'confirmed' then
    raise exception 'Só agendamentos confirmados podem ser remarcados.' using errcode = 'P0001', hint = 'invalid_status';
  end if;
  if p_starts_at < now() - interval '15 minutes' then
    raise exception 'Não é possível remarcar para o passado.' using errcode = 'P0001', hint = 'in_the_past';
  end if;
  select s.duration_min, s.buffer_after_min into v_svc
  from public.services s
  join public.professional_services ps on ps.service_id = s.id and ps.professional_id = v_prof
  where s.id = v_a.service_id;
  if not found then
    raise exception 'Este profissional não oferece este serviço.' using errcode = 'P0001', hint = 'invalid_service';
  end if;

  v_end := p_starts_at + make_interval(mins => v_svc.duration_min + v_svc.buffer_after_min);
  if not app.fits_schedule(v_prof, p_starts_at, v_end) then
    raise exception 'Fora do horário de atendimento ou em um bloqueio.' using errcode = 'P0001', hint = 'outside_hours';
  end if;

  begin
    update public.appointments
       set professional_id = v_prof, starts_at = p_starts_at, ends_at = v_end
     where id = p_id;
  exception when exclusion_violation then
    raise exception 'Esse horário já está ocupado.' using errcode = 'P0001', hint = 'slot_taken';
  end;

  insert into public.appointment_events (appointment_id, organization_id, from_status, to_status, actor_user_id, reason)
  values (p_id, v_a.organization_id, 'confirmed', 'confirmed', auth.uid(),
          'Remarcado de ' || to_char(v_a.starts_at at time zone
            (select timezone from public.organizations where id = v_a.organization_id), 'DD/MM HH24:MI'));
end;
$$;

-- Mudança de status (RN-22, RN-25). Concluído/faltou só depois do horário de início.
create function public.set_appointment_status(p_id uuid, p_to public.appointment_status, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_allowed public.appointment_status[];
begin
  select * into v_a from public.appointments where id = p_id;
  if v_a.id is null or not (
       app.has_perm(v_a.organization_id, 'appointments.set_status')
       or (app.has_perm(v_a.organization_id, 'appointments.set_status_own') and app.is_my_professional(v_a.professional_id))) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_a.organization_id) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;

  v_allowed := case v_a.status
    when 'confirmed' then array['completed', 'no_show', 'cancelled']::public.appointment_status[]
    else array[]::public.appointment_status[]
  end; -- 'requested' é tratado pela fila de aprovação (Fase 6)
  if not p_to = any (v_allowed) then
    raise exception 'Mudança de status não permitida.' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if p_to in ('completed', 'no_show') and v_a.starts_at > now() then
    raise exception 'Só depois do horário do atendimento.' using errcode = 'P0001', hint = 'not_started';
  end if;

  update public.appointments set status = p_to where id = p_id;
  insert into public.appointment_events (appointment_id, organization_id, from_status, to_status, actor_user_id, reason)
  values (p_id, v_a.organization_id, v_a.status, p_to, auth.uid(), nullif(btrim(left(p_reason, 200)), ''));
end;
$$;

-- Ocupação de toda a clínica sem detalhes (para o profissional ver "Ocupado" na agenda dos outros).
create function public.schedule_busy(p_org uuid, p_from timestamptz, p_to timestamptz)
returns table (id uuid, professional_id uuid, starts_at timestamptz, ends_at timestamptz, status public.appointment_status)
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app.has_perm(p_org, 'schedule.view_all') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_to - p_from > interval '400 days' then
    raise exception 'Período longo demais.' using errcode = 'P0001', hint = 'range_too_long';
  end if;
  return query
    select a.id, a.professional_id, a.starts_at, a.ends_at, a.status
    from public.appointments a
    where a.organization_id = p_org
      and a.starts_at < p_to and a.ends_at > p_from
      and a.status in ('requested', 'confirmed', 'completed', 'no_show');
end;
$$;

-- Exclusão de paciente: lógica, auditada, e só sem atendimentos futuros marcados.
create function public.delete_patient(p_id uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  select organization_id into v_org from public.patients where id = p_id and deleted_at is null;
  if v_org is null or not app.has_perm(v_org, 'patients.delete') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if exists (select 1 from public.appointments where patient_id = p_id and status in ('requested', 'confirmed') and starts_at > now()) then
    raise exception 'O paciente tem agendamentos futuros. Cancele-os antes.' using errcode = 'P0001', hint = 'has_future_appointments';
  end if;
  update public.patients set deleted_at = now() where id = p_id;
end;
$$;

-- Privilégios das funções (o padrão do projeto não dá EXECUTE a ninguém: 0001).
grant execute on function app.is_my_professional(uuid), app.is_my_patient(uuid), app.fits_schedule(uuid, timestamptz, timestamptz),
  app.can_write_schedule(uuid, uuid), app.can_see_patient(uuid, uuid), app.check_professional_user()
  to authenticated;
grant execute on function public.set_weekly_availability(uuid, jsonb),
  public.create_appointment(uuid, uuid, uuid, uuid, timestamptz, text),
  public.reschedule_appointment(uuid, timestamptz, uuid),
  public.set_appointment_status(uuid, public.appointment_status, text),
  public.schedule_busy(uuid, timestamptz, timestamptz),
  public.delete_patient(uuid)
  to authenticated;
