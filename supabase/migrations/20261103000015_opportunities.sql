-- 0015 — Módulo Oportunidades (docs/17): detecção, fluxo de trabalho e configurações.
--
-- Garantias no banco:
--   • a detecção roda aqui (função security definer): ninguém grava uma oportunidade "inventada";
--   • `dedupe_key` única por clínica: a mesma situação nunca vira duas oportunidades;
--   • valores só saem do banco para quem pode vê-los (o feed devolve nulo para os demais);
--   • horários livres descontam bloqueios, agendamentos ativos, reservas válidas e horários já
--     liberados por cancelamento (que viram oportunidade própria): nenhum horário conta duas vezes;
--   • nada é agendado sozinho: agendar passa por create_appointment (GiST + fits_schedule).
--
-- Atualização sob demanda (decisão O-3): ao abrir a tela, se algo mudou na agenda/retornos/
-- orçamentos (marca `stale`) ou se a última atualização passou de 10 min. Sem cron e sem Realtime.

create type public.opportunity_kind as enum
  ('free_slots', 'cancelled_slot', 'follow_up_due', 'proposal_stale', 'no_show', 'cancelled_appointment');
create type public.opportunity_status as enum ('new', 'in_progress', 'resolved', 'dismissed', 'expired');

-- Prioridade ajustada pela clínica: {"proposal_stale": 1, ...} com 1 = alta, 2 = média, 3 = baixa.
create function app.valid_priority_overrides(p jsonb) returns boolean
language sql immutable
set search_path = ''
as $$
  select jsonb_typeof(p) = 'object'
     and not exists (
       select 1 from jsonb_each(p) e
       where e.key <> all (array['free_slots', 'cancelled_slot', 'follow_up_due', 'proposal_stale', 'no_show', 'cancelled_appointment'])
          or jsonb_typeof(e.value) <> 'number'
          or e.value::text not in ('1', '2', '3'));
$$;

-- Configuração por clínica (uma linha, criada na primeira atualização com os padrões).
create table public.opportunity_settings (
  organization_id uuid primary key references public.organizations (id) on delete cascade,
  enabled_kinds public.opportunity_kind[] not null default enum_range(null::public.opportunity_kind),
  proposal_stale_days smallint not null default 7 check (proposal_stale_days between 1 and 90),
  slot_horizon_days smallint not null default 14 check (slot_horizon_days between 1 and 30),
  follow_up_lead_days smallint not null default 14 check (follow_up_lead_days between 0 and 90),
  priority_overrides jsonb not null default '{}' check (app.valid_priority_overrides(priority_overrides)),
  excluded_professional_ids uuid[] not null default '{}',
  reception_sees_values boolean not null default false,
  professionals_see_own boolean not null default true,
  stale boolean not null default true,
  last_refreshed_at timestamptz,
  updated_by uuid references auth.users (id) on delete set null,
  updated_at timestamptz not null default now()
);

create table public.opportunities (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  kind public.opportunity_kind not null,
  dedupe_key text not null check (length(dedupe_key) <= 200),
  status public.opportunity_status not null default 'new',
  priority smallint not null check (priority between 1 and 3),
  professional_id uuid,
  patient_id uuid,
  service_id uuid,
  appointment_id uuid,
  follow_up_id uuid,
  proposal_id uuid,
  window_start timestamptz,
  window_end timestamptz,
  free_ranges tstzmultirange,        -- trechos livres (tipos de agenda), para sugerir a lista de espera
  slot_count integer check (slot_count is null or slot_count >= 0),
  value_cents bigint check (value_cents is null or value_cents >= 0),
  value_basis jsonb,                 -- como o valor foi calculado (mostrado em "Como calculamos")
  assigned_to uuid references auth.users (id) on delete set null,
  detected_at timestamptz not null default now(),
  refreshed_at timestamptz not null default now(),
  expires_at timestamptz,
  resolved_at timestamptz,
  resolved_by uuid references auth.users (id) on delete set null,
  resolution text check (resolution in ('auto', 'manual')),
  dismiss_reason text check (dismiss_reason is null or length(dismiss_reason) between 3 and 200),
  reopened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check ((status in ('resolved', 'dismissed', 'expired')) = (resolved_at is not null)),
  check (status <> 'dismissed' or dismiss_reason is not null),
  constraint opportunities_id_org unique (id, organization_id),
  constraint opportunities_dedupe unique (organization_id, dedupe_key),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade,
  foreign key (patient_id, organization_id) references public.patients (id, organization_id) on delete cascade,
  foreign key (service_id, organization_id) references public.services (id, organization_id) on delete cascade,
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id) on delete cascade,
  foreign key (follow_up_id, organization_id) references public.follow_ups (id, organization_id) on delete cascade,
  foreign key (proposal_id, organization_id) references public.proposals (id, organization_id) on delete cascade
);
create index on public.opportunities (organization_id, status, kind);
create index on public.opportunities (organization_id, professional_id) where status in ('new', 'in_progress');
create index on public.opportunities (proposal_id) where proposal_id is not null;
create trigger opportunities_touch before update on public.opportunities
  for each row execute function app.touch_updated_at();

-- Histórico imutável: quem fez o quê (ator nulo = sistema).
create table public.opportunity_actions (
  id bigint generated always as identity primary key,
  opportunity_id uuid not null,
  organization_id uuid not null,
  kind text not null check (kind in ('detected', 'reopened', 'contact', 'assigned', 'status', 'booked', 'resolved_auto', 'expired')),
  from_status public.opportunity_status,
  to_status public.opportunity_status,
  outcome text check (outcome in ('no_answer', 'call_back', 'scheduled', 'not_now', 'other')),
  note text check (note is null or length(note) <= 300),
  assigned_to uuid,
  appointment_id uuid,
  actor_user_id uuid,
  created_at timestamptz not null default now(),
  foreign key (opportunity_id, organization_id) references public.opportunities (id, organization_id) on delete cascade
);
create index on public.opportunity_actions (opportunity_id);

-- Funções auxiliares --------------------------------------------------------------------------

create function app.opportunity_category(p_kind public.opportunity_kind) returns text
language sql immutable
set search_path = ''
as $$
  select case p_kind
    when 'free_slots' then 'agenda'
    when 'cancelled_slot' then 'agenda'
    when 'proposal_stale' then 'financeiro'
    else 'pacientes'
  end;
$$;

-- Prioridade padrão por segmento (docs/17 §5), a menos que a clínica tenha ajustado o tipo.
create function app.opportunity_priority(
  p_segment public.org_segment, p_kind public.opportunity_kind, p_urgent boolean, p_overrides jsonb
) returns smallint
language sql stable
set search_path = ''
as $$
  select coalesce(
    (p_overrides ->> p_kind::text)::smallint,
    case
      when p_kind = 'cancelled_slot' then 1
      when p_kind = 'free_slots' then
        case when p_urgent and p_segment in ('medical_clinic', 'medical_office', 'aesthetic_clinic', 'aesthetic_office') then 1 else 2 end
      when p_kind = 'follow_up_due' then
        case when p_urgent and p_segment in ('medical_clinic', 'medical_office') then 1 else 2 end
      when p_kind = 'proposal_stale' then
        case when p_segment in ('dental_clinic', 'dental_office', 'aesthetic_clinic', 'aesthetic_office') then 1
             when p_segment in ('medical_clinic', 'medical_office') then 3
             else 2 end
      when p_kind = 'no_show' then
        case when p_segment in ('medical_clinic', 'medical_office') then 1 else 2 end
      else 2
    end
  )::smallint;
$$;

-- Quem vê a oportunidade: gestão/recepção todas; profissional as próprias (se a clínica permitir).
create function app.can_see_opportunity(p_org uuid, p_professional uuid, p_patient uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select (app.has_perm(p_org, 'opportunities.read')
          or (p_professional is not null and app.has_perm(p_org, 'opportunities.read_own')
              and app.is_my_professional(p_professional)
              and coalesce((select s.professionals_see_own from public.opportunity_settings s where s.organization_id = p_org), true)))
     and (p_patient is null or app.can_see_patient(p_org, p_patient));
$$;

create function app.can_work_opportunity(p_org uuid, p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'opportunities.work')
      or (p_professional is not null and app.has_perm(p_org, 'opportunities.work_own')
          and app.is_my_professional(p_professional)
          and coalesce((select s.professionals_see_own from public.opportunity_settings s where s.organization_id = p_org), true));
$$;

-- Quem vê valores (decisão O-2): gestão; profissional nos próprios; recepção se a clínica ligar;
-- orçamento para quem já lê orçamentos (o valor faz parte da proposta).
create function app.can_see_opportunity_values(p_org uuid, p_professional uuid, p_kind public.opportunity_kind) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'finance.read')
      or (p_professional is not null and app.has_perm(p_org, 'finance.read_own') and app.is_my_professional(p_professional))
      or (app.has_perm(p_org, 'opportunities.read')
          and coalesce((select s.reception_sees_values from public.opportunity_settings s where s.organization_id = p_org), false))
      or (p_kind = 'proposal_stale'
          and (app.has_perm(p_org, 'proposals.read')
               or (p_professional is not null and app.has_perm(p_org, 'proposals.read_own') and app.is_my_professional(p_professional))));
$$;

-- Regras de detecção ----------------------------------------------------------------------------
-- Uma linha por oportunidade que DEVE existir agora. Regras em docs/17 §5; todas no fuso da clínica.
create function app.opportunity_candidates(p_org uuid)
returns table (
  kind public.opportunity_kind, dedupe_key text, priority smallint,
  professional_id uuid, patient_id uuid, service_id uuid,
  appointment_id uuid, follow_up_id uuid, proposal_id uuid,
  window_start timestamptz, window_end timestamptz, free_ranges tstzmultirange, slot_count integer,
  value_cents bigint, value_basis jsonb, expires_at timestamptz
)
language sql stable security definer
set search_path = ''
as $$
  with cfg as (
    select o.id as org, o.segment, o.timezone as tz,
           coalesce(s.enabled_kinds, enum_range(null::public.opportunity_kind)) as kinds,
           coalesce(s.proposal_stale_days, 7)::int as stale_days,
           coalesce(s.slot_horizon_days, 14)::int as horizon,
           coalesce(s.follow_up_lead_days, 14)::int as lead_days,
           coalesce(s.priority_overrides, '{}'::jsonb) as overrides,
           coalesce(s.excluded_professional_ids, '{}'::uuid[]) as excluded,
           (now() at time zone o.timezone)::date as today
    from public.organizations o
    left join public.opportunity_settings s on s.organization_id = o.id
    where o.id = p_org
  ),
  pros as (
    select p.id from public.professionals p, cfg
    where p.organization_id = cfg.org and p.active and p.id <> all (cfg.excluded)
  ),
  -- Ocupam a agenda: confirmados e solicitações com reserva ainda válida.
  busy as (
    select a.professional_id, tstzrange(a.starts_at, a.ends_at, '[)') as r
    from public.appointments a, cfg
    where a.organization_id = cfg.org and a.ends_at > now()
      and (a.status = 'confirmed' or (a.status = 'requested' and a.hold_expires_at > now()))
  ),
  -- B. Horário liberado por cancelamento, ainda livre e ainda dentro do horário de atendimento.
  cancelled as (
    select a.id, a.professional_id, a.service_id, a.starts_at, a.ends_at
    from public.appointments a, cfg
    where a.organization_id = cfg.org and a.status = 'cancelled'
      and a.starts_at > now()
      and a.starts_at < ((cfg.today + cfg.horizon)::timestamp at time zone cfg.tz)
      and a.professional_id in (select id from pros)
      and not exists (select 1 from busy b
                      where b.professional_id = a.professional_id and b.r && tstzrange(a.starts_at, a.ends_at, '[)'))
      and app.fits_schedule(a.professional_id, a.starts_at, a.ends_at)
      -- Dois cancelamentos no mesmo horário contam uma vez só (fica o mais recente).
      and not exists (select 1 from public.appointments c
                      where c.professional_id = a.professional_id and c.status = 'cancelled' and c.id <> a.id
                        and c.starts_at > now()
                        and tstzrange(c.starts_at, c.ends_at, '[)') && tstzrange(a.starts_at, a.ends_at, '[)')
                        and (c.updated_at, c.id) > (a.updated_at, a.id))
  ),
  days as (
    select cfg.today + g as d from cfg, generate_series(0, cfg.horizon - 1) g
  ),
  -- A. Horário de atendimento de cada profissional em cada dia...
  wm as (
    select r.professional_id, dd.d,
           range_agg(tstzrange((dd.d + r.start_time) at time zone cfg.tz, (dd.d + r.end_time) at time zone cfg.tz, '[)')) as m
    from public.availability_rules r
    join pros on pros.id = r.professional_id
    cross join cfg
    join days dd on extract(dow from dd.d) = r.weekday
    where r.organization_id = cfg.org
    group by r.professional_id, dd.d
  ),
  -- ... menos bloqueios (pausa, folga, férias, feriado), ocupação, horários liberados (já contados
  -- em B) e o que já passou.
  free as (
    select wm.professional_id, wm.d,
           wm.m
             - coalesce(blk.m, '{}'::tstzmultirange)
             - coalesce(bz.m, '{}'::tstzmultirange)
             - coalesce(cx.m, '{}'::tstzmultirange)
             - tstzmultirange(tstzrange(null, now(), '[)')) as m
    from wm
    left join lateral (
      select range_agg(tstzrange(b.starts_at, b.ends_at, '[)')) as m
      from public.schedule_blocks b
      where b.organization_id = p_org
        and (b.professional_id is null or b.professional_id = wm.professional_id)
        and tstzrange(b.starts_at, b.ends_at, '[)') && range_merge(wm.m)
    ) blk on true
    left join lateral (
      select range_agg(x.r) as m from busy x
      where x.professional_id = wm.professional_id and x.r && range_merge(wm.m)
    ) bz on true
    left join lateral (
      select range_agg(tstzrange(c.starts_at, c.ends_at, '[)')) as m from cancelled c
      where c.professional_id = wm.professional_id and tstzrange(c.starts_at, c.ends_at, '[)') && range_merge(wm.m)
    ) cx on true
  ),
  -- Serviço de referência do profissional: o mais agendado em 90 dias; sem histórico, o mais curto.
  ref as (
    select distinct on (ps.professional_id)
           ps.professional_id, s.id as service_id, s.name, (s.duration_min + s.buffer_after_min) as total_min,
           s.price_cents, h.n > 0 as by_history
    from public.professional_services ps
    join pros on pros.id = ps.professional_id
    join public.services s on s.id = ps.service_id and s.active
    cross join lateral (
      select count(*) as n from public.appointments a
      where a.professional_id = ps.professional_id and a.service_id = s.id
        and a.status in ('confirmed', 'completed') and a.starts_at > now() - interval '90 days'
    ) h
    order by ps.professional_id, h.n desc, s.duration_min + s.buffer_after_min, s.name
  ),
  -- Horários SEM sobreposição que cabem em cada trecho livre (duração + intervalo do serviço).
  slots as (
    select f.professional_id, f.d, f.m, ref.service_id, ref.name, ref.total_min, ref.price_cents, ref.by_history,
           (select coalesce(sum(floor(extract(epoch from upper(x) - lower(x)) / 60 / ref.total_min)), 0)::int
              from unnest(f.m) x) as n,
           (select coalesce(sum(extract(epoch from upper(x) - lower(x)) / 60), 0)::int
              from unnest(f.m) x) as free_min
    from free f
    join ref on ref.professional_id = f.professional_id
    where not isempty(f.m)
  )
  -- A. Horários livres (um por profissional e dia).
  select 'free_slots'::public.opportunity_kind,
         'slots:' || s.professional_id || ':' || to_char(s.d, 'YYYY-MM-DD'),
         app.opportunity_priority(cfg.segment, 'free_slots', s.d < cfg.today + 2, cfg.overrides),
         s.professional_id, null::uuid, s.service_id, null::uuid, null::uuid, null::uuid,
         lower(s.m), upper(s.m), s.m, s.n,
         s.n * s.price_cents,
         jsonb_build_object('method', 'free_slots', 'slots', s.n, 'free_minutes', s.free_min, 'slot_minutes', s.total_min,
                            'service_id', s.service_id, 'service_name', s.name, 'unit_price_cents', s.price_cents,
                            'reference', case when s.by_history then 'most_booked' else 'shortest' end),
         ((s.d + 1)::timestamp at time zone cfg.tz)
  from slots s cross join cfg
  where s.n > 0 and 'free_slots' = any (cfg.kinds)

  union all
  -- B. Horário liberado por cancelamento.
  select 'cancelled_slot', 'cancel:' || c.id,
         app.opportunity_priority(cfg.segment, 'cancelled_slot', true, cfg.overrides),
         c.professional_id, null, c.service_id, c.id, null, null,
         c.starts_at, c.ends_at, tstzmultirange(tstzrange(c.starts_at, c.ends_at, '[)')), 1,
         sv.price_cents,
         jsonb_build_object('method', 'cancelled_slot', 'slots', 1,
                            'slot_minutes', (extract(epoch from c.ends_at - c.starts_at) / 60)::int,
                            'service_id', sv.id, 'service_name', sv.name, 'unit_price_cents', sv.price_cents),
         c.starts_at
  from cancelled c
  join public.services sv on sv.id = c.service_id
  cross join cfg
  where 'cancelled_slot' = any (cfg.kinds)

  union all
  -- C. Retorno cadastrado, vencido ou perto do prazo, sem agendamento futuro com o profissional.
  select 'follow_up_due', 'return:' || f.id,
         app.opportunity_priority(cfg.segment, 'follow_up_due', f.due_date < cfg.today, cfg.overrides),
         f.professional_id, f.patient_id, f.service_id, null, f.id, null,
         null, null, null, null,
         sv.price_cents,
         jsonb_build_object('method', 'follow_up', 'due_date', f.due_date,
                            'service_id', sv.id, 'service_name', sv.name, 'unit_price_cents', sv.price_cents),
         null
  from public.follow_ups f
  join public.patients pt on pt.id = f.patient_id and pt.deleted_at is null
  left join public.services sv on sv.id = f.service_id
  cross join cfg
  where f.organization_id = cfg.org and f.status = 'pending'
    and f.professional_id in (select id from pros)
    and f.due_date <= cfg.today + cfg.lead_days
    and not exists (select 1 from public.appointments a
                    where a.patient_id = f.patient_id and a.professional_id = f.professional_id
                      and (f.service_id is null or a.service_id = f.service_id)
                      and a.status in ('confirmed', 'requested') and a.starts_at >= now())
    and 'follow_up_due' = any (cfg.kinds)

  union all
  -- D. Orçamento aberto sem atualização há N dias (a oportunidade aberta continua até ele fechar).
  select 'proposal_stale',
         coalesce(op.dedupe_key, 'proposal:' || p.id || ':' || to_char(p.last_activity_at at time zone 'UTC', 'YYYYMMDDHH24MISS')),
         app.opportunity_priority(cfg.segment, 'proposal_stale', false, cfg.overrides),
         p.professional_id, p.patient_id, null, null, null, p.id,
         null, null, null, null,
         p.total_cents,
         jsonb_build_object('method', 'proposal', 'total_cents', p.total_cents, 'last_activity_at', p.last_activity_at,
                            'valid_until', p.valid_until,
                            'items', (select count(*) from public.proposal_items i where i.proposal_id = p.id)),
         case when p.valid_until is null then null else ((p.valid_until + 1)::timestamp at time zone cfg.tz) end
  from public.proposals p
  join public.patients pt on pt.id = p.patient_id and pt.deleted_at is null
  cross join cfg
  left join lateral (
    select o.dedupe_key from public.opportunities o
    where o.organization_id = p.organization_id and o.proposal_id = p.id and o.kind = 'proposal_stale'
      and o.status in ('new', 'in_progress')
    limit 1
  ) op on true
  where p.organization_id = cfg.org and p.status = 'open'
    and (p.valid_until is null or p.valid_until >= cfg.today)
    and (p.professional_id is null or p.professional_id <> all (cfg.excluded))
    and (op.dedupe_key is not null or p.last_activity_at < now() - make_interval(days => cfg.stale_days))
    and 'proposal_stale' = any (cfg.kinds)

  union all
  -- E. Falta ou cancelamento nos últimos 30 dias, sem novo agendamento do paciente. Uma por
  -- paciente (a situação mais recente). Sem valor somado: o horário em si já está em A/B.
  select e.kind, e.dedupe_key,
         app.opportunity_priority(cfg.segment, e.kind, false, cfg.overrides),
         e.professional_id, e.patient_id, e.service_id, e.id, null, null,
         e.starts_at, e.ends_at, null, null,
         null,
         jsonb_build_object('method', 'none', 'service_id', e.service_id, 'service_name', e.service_name),
         e.updated_at + interval '30 days'
  from (
    select distinct on (a.patient_id)
           case when a.status = 'no_show' then 'no_show'::public.opportunity_kind
                else 'cancelled_appointment'::public.opportunity_kind end as kind,
           case when a.status = 'no_show' then 'no_show:' else 'cancelled:' end || a.id as dedupe_key,
           a.id, a.professional_id, a.patient_id, a.service_id, a.starts_at, a.ends_at, a.updated_at,
           sv.name as service_name
    from public.appointments a
    join public.patients pt on pt.id = a.patient_id and pt.deleted_at is null
    join public.services sv on sv.id = a.service_id
    cross join cfg
    where a.organization_id = cfg.org and a.status in ('no_show', 'cancelled')
      and a.updated_at > now() - interval '30 days'
      and a.professional_id <> all (cfg.excluded)
      and ((a.status = 'no_show' and 'no_show' = any (cfg.kinds))
           or (a.status = 'cancelled' and 'cancelled_appointment' = any (cfg.kinds)))
      and not exists (select 1 from public.appointments b
                      where b.patient_id = a.patient_id and b.id <> a.id
                        and b.status in ('requested', 'confirmed', 'completed')
                        and (b.created_at >= a.updated_at or (b.status in ('requested', 'confirmed') and b.starts_at >= now())))
    order by a.patient_id, a.updated_at desc, a.starts_at desc
  ) e
  cross join cfg;
$$;

-- Atualização: sincroniza retornos e orçamentos vencidos, grava o que surgiu, resolve o que
-- deixou de existir e expira o que passou. Idempotente; uma por clínica de cada vez.
create function app.refresh_opportunities(p_org uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_now timestamptz := clock_timestamp();
  v_tz text;
  v_kinds public.opportunity_kind[];
  v_excluded uuid[];
begin
  if not pg_try_advisory_xact_lock(hashtextextended('opportunities:' || p_org::text, 0)) then
    return;
  end if;
  select timezone into v_tz from public.organizations where id = p_org;
  if v_tz is null then
    return;
  end if;
  insert into public.opportunity_settings (organization_id) values (p_org) on conflict do nothing;
  select enabled_kinds, excluded_professional_ids into v_kinds, v_excluded
    from public.opportunity_settings where organization_id = p_org;

  -- Retorno agendado cujo atendimento foi cancelado volta a pendente; o concluído fica feito.
  update public.follow_ups f
     set status = case when a.status = 'completed' then 'done'::public.follow_up_status else 'pending'::public.follow_up_status end,
         appointment_id = case when a.status = 'completed' then f.appointment_id end
    from public.appointments a
   where f.organization_id = p_org and f.status = 'scheduled' and a.id = f.appointment_id
     and a.status in ('completed', 'cancelled', 'no_show', 'declined', 'expired');

  -- Retorno pendente com atendimento marcado depois do cadastro passa a "agendado" (ou "feito").
  update public.follow_ups f
     set status = case when m.status = 'completed' then 'done'::public.follow_up_status else 'scheduled'::public.follow_up_status end,
         appointment_id = m.aid
    from (
      select distinct on (f2.id) f2.id as fid, a.id as aid, a.status
      from public.follow_ups f2
      join public.appointments a
        on a.patient_id = f2.patient_id and a.professional_id = f2.professional_id
       and (f2.service_id is null or a.service_id = f2.service_id)
       and a.status in ('requested', 'confirmed', 'completed')
       and a.starts_at >= f2.created_at
       and a.id is distinct from f2.source_appointment_id
      where f2.organization_id = p_org and f2.status = 'pending'
      order by f2.id, a.starts_at
    ) m
   where f.id = m.fid;

  update public.proposals
     set status = 'expired', closed_at = now()
   where organization_id = p_org and status = 'open' and valid_until < (now() at time zone v_tz)::date;

  -- Grava as detectadas. Encerrada pelo sistema volta a "nova" se a situação voltar; encerrada
  -- por alguém da equipe não é tocada.
  with up as (
    insert into public.opportunities as o (
      organization_id, kind, dedupe_key, priority, professional_id, patient_id, service_id,
      appointment_id, follow_up_id, proposal_id, window_start, window_end, free_ranges, slot_count,
      value_cents, value_basis, expires_at, detected_at, refreshed_at)
    select p_org, c.kind, c.dedupe_key, c.priority, c.professional_id, c.patient_id, c.service_id,
           c.appointment_id, c.follow_up_id, c.proposal_id, c.window_start, c.window_end, c.free_ranges, c.slot_count,
           c.value_cents, c.value_basis, c.expires_at, v_now, v_now
    from app.opportunity_candidates(p_org) c
    on conflict (organization_id, dedupe_key) do update set
      priority = excluded.priority,
      service_id = excluded.service_id,
      window_start = excluded.window_start,
      window_end = excluded.window_end,
      free_ranges = excluded.free_ranges,
      slot_count = excluded.slot_count,
      value_cents = excluded.value_cents,
      value_basis = excluded.value_basis,
      expires_at = excluded.expires_at,
      refreshed_at = v_now,
      status = case when o.status in ('resolved', 'expired') then 'new'::public.opportunity_status else o.status end,
      resolved_at = case when o.status in ('resolved', 'expired') then null else o.resolved_at end,
      resolved_by = case when o.status in ('resolved', 'expired') then null else o.resolved_by end,
      resolution = case when o.status in ('resolved', 'expired') then null else o.resolution end,
      reopened_at = case when o.status in ('resolved', 'expired') then v_now else o.reopened_at end
    where o.status in ('new', 'in_progress') or (o.resolution = 'auto' and o.status in ('resolved', 'expired'))
    returning o.id, o.status, (xmax = 0) as inserted, (o.reopened_at = v_now) as reopened
  )
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, to_status)
  select up.id, p_org, case when up.inserted then 'detected' else 'reopened' end, up.status
  from up
  where up.inserted or up.reopened;

  -- Abertas que não apareceram nesta rodada: a situação acabou (resolvida) ou o prazo passou (expirada).
  with gone as (
    update public.opportunities o
       set status = case when o.expires_at is not null and o.expires_at <= v_now
                         then 'expired'::public.opportunity_status else 'resolved'::public.opportunity_status end,
           resolved_at = v_now, resolved_by = null, resolution = 'auto'
     where o.organization_id = p_org and o.status in ('new', 'in_progress')
       and ((o.refreshed_at < v_now and o.kind = any (v_kinds)
             and (o.professional_id is null or o.professional_id <> all (v_excluded)))
            or (o.expires_at is not null and o.expires_at <= v_now))
    returning o.id, o.status
  )
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, to_status)
  select gone.id, p_org, case when gone.status = 'expired' then 'expired' else 'resolved_auto' end, gone.status
  from gone;

  update public.opportunity_settings set stale = false, last_refreshed_at = v_now where organization_id = p_org;
end;
$$;

-- Qualquer mudança que afete as regras marca a clínica para atualizar na próxima abertura.
create function app.mark_opportunities_stale() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v_org uuid;
begin
  if tg_op = 'DELETE' then
    v_org := old.organization_id;
  else
    v_org := new.organization_id;
  end if;
  update public.opportunity_settings set stale = true where organization_id = v_org and not stale;
  return null;
end;
$$;

create trigger opportunities_stale after insert or update or delete on public.appointments
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.schedule_blocks
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.availability_rules
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.services
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.professional_services
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.professionals
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.follow_ups
  for each row execute function app.mark_opportunities_stale();
create trigger opportunities_stale after insert or update or delete on public.proposals
  for each row execute function app.mark_opportunities_stale();

-- Pacientes da lista de espera que cabem num horário livre (sugestão; nunca agenda sozinho):
-- mesmo profissional (ou "qualquer um"), serviço que ele oferece, dia da semana, período e datas.
create function app.waiting_matches(p_opp uuid)
returns table (entry_id uuid, patient_id uuid, service_id uuid, starts_at timestamptz)
language sql stable security definer
set search_path = ''
as $$
  with o as (
    select x.organization_id, x.professional_id, x.service_id, x.free_ranges, org.timezone as tz,
           (lower(x.free_ranges) at time zone org.timezone)::date as d
    from public.opportunities x
    join public.organizations org on org.id = x.organization_id
    where x.id = p_opp and x.kind in ('free_slots', 'cancelled_slot') and x.free_ranges is not null
      and x.status in ('new', 'in_progress')
  ),
  cand as (
    select w.id, w.patient_id, s.id as service_id, (s.duration_min + s.buffer_after_min) as need,
           w.periods, w.created_at, o.free_ranges, o.tz, o.d
    from o
    join public.waiting_list w on w.organization_id = o.organization_id and w.status = 'waiting'
    join public.patients pt on pt.id = w.patient_id and pt.deleted_at is null
    join public.services s on s.id = coalesce(w.service_id, o.service_id) and s.active
    where (w.professional_id is null or w.professional_id = o.professional_id)
      and exists (select 1 from public.professional_services ps
                  where ps.professional_id = o.professional_id and ps.service_id = s.id)
      and (w.weekdays is null or extract(dow from o.d)::smallint = any (w.weekdays))
      and (w.earliest_date is null or w.earliest_date <= o.d)
      and (w.latest_date is null or w.latest_date >= o.d)
  )
  select c.id, c.patient_id, c.service_id, fit.s
  from cand c
  cross join lateral (
    select min(lower(r)) as s
    from unnest(c.free_ranges * coalesce(
           (select range_agg(tstzrange((c.d + p.a) at time zone c.tz, (c.d + p.b) at time zone c.tz, '[)'))
              from (values ('morning', time '00:00', time '12:00'), ('afternoon', time '12:00', time '18:00'),
                           ('evening', time '18:00', time '24:00')) p (k, a, b)
             where p.k = any (c.periods)),
           '{(,)}'::tstzmultirange)) r
    where upper(r) - lower(r) >= make_interval(mins => c.need)
  ) fit
  where fit.s is not null
  order by c.created_at, c.id;
$$;

-- Liga um agendamento à oportunidade (o horário ou o paciente precisam bater).
create function app.record_opportunity_booking(p_id uuid, p_appointment uuid) returns boolean
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
  v_a public.appointments;
  v_to public.opportunity_status;
begin
  select * into v_o from public.opportunities where id = p_id for update;
  select * into v_a from public.appointments where id = p_appointment;
  if v_o.id is null or v_a.id is null or v_a.organization_id <> v_o.organization_id
     or v_o.status not in ('new', 'in_progress') then
    return false;
  end if;
  if v_o.kind in ('free_slots', 'cancelled_slot') then
    if v_a.professional_id <> v_o.professional_id or v_o.free_ranges is null
       or not (v_o.free_ranges && tstzrange(v_a.starts_at, v_a.ends_at, '[)')) then
      return false;
    end if;
  elsif v_o.patient_id is distinct from v_a.patient_id then
    return false;
  end if;

  -- Um dia de horários livres continua aberto (podem sobrar outros); os demais tipos se resolvem.
  v_to := case when v_o.kind = 'free_slots' then 'in_progress'::public.opportunity_status else 'resolved'::public.opportunity_status end;
  update public.opportunities
     set status = v_to,
         resolved_at = case when v_to = 'resolved' then now() end,
         resolved_by = case when v_to = 'resolved' then auth.uid() end,
         resolution = case when v_to = 'resolved' then 'manual' end
   where id = p_id;
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, from_status, to_status, appointment_id, actor_user_id)
  values (p_id, v_o.organization_id, 'booked', v_o.status, v_to, p_appointment, auth.uid());
  return true;
end;
$$;

-- Carrega e trava a oportunidade para uma ação da equipe, conferindo permissão.
create function app.opportunity_for_work(p_id uuid) returns public.opportunities
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
begin
  select * into v_o from public.opportunities where id = p_id for update;
  if v_o.id is null
     or not app.can_see_opportunity(v_o.organization_id, v_o.professional_id, v_o.patient_id)
     or not app.can_work_opportunity(v_o.organization_id, v_o.professional_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_o.organization_id) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  return v_o;
end;
$$;

-- RLS ---------------------------------------------------------------------------------------------
alter table public.opportunity_settings enable row level security;
alter table public.opportunities enable row level security;
alter table public.opportunity_actions enable row level security;

revoke all on public.opportunity_settings, public.opportunities, public.opportunity_actions from anon, authenticated;

grant select on public.opportunity_settings to authenticated;
create policy opportunity_settings_select on public.opportunity_settings for select to authenticated
  using (app.is_member(organization_id));

-- Sem as colunas de valor: valores só pelo feed, que confere a permissão (O-2).
grant select (id, organization_id, kind, dedupe_key, status, priority, professional_id, patient_id, service_id,
              appointment_id, follow_up_id, proposal_id, window_start, window_end, free_ranges, slot_count,
              assigned_to, detected_at, refreshed_at, expires_at, resolved_at, resolved_by, resolution,
              dismiss_reason, created_at, updated_at)
  on public.opportunities to authenticated;
create policy opportunities_select on public.opportunities for select to authenticated
  using (app.can_see_opportunity(organization_id, professional_id, patient_id));

grant select on public.opportunity_actions to authenticated;
create policy opportunity_actions_select on public.opportunity_actions for select to authenticated
  using (exists (select 1 from public.opportunities o where o.id = opportunity_id));

-- Funções chamadas pela aplicação ------------------------------------------------------------------

-- Lista paginada + indicadores. Atualiza antes se estiver desatualizado (ou se p_force).
-- p_view: 'open' (novas e em andamento) ou 'closed' (resolvidas, descartadas, expiradas).
create function public.opportunities_feed(
  p_org uuid,
  p_view text default 'open',
  p_category text default null,
  p_professional uuid default null,
  p_days integer default 14,
  p_sort text default 'priority',
  p_limit integer default 50,
  p_offset integer default 0,
  p_force boolean default false
) returns jsonb
language plpgsql security definer
set search_path = ''
as $$
declare
  v_s public.opportunity_settings;
  v_read_all boolean := app.has_perm(p_org, 'opportunities.read');
  v_read_own boolean := app.has_perm(p_org, 'opportunities.read_own');
  v_patients_all boolean := app.has_perm(p_org, 'patients.read_all');
  v_values_own boolean := app.has_perm(p_org, 'finance.read_own');
  v_proposals_all boolean := app.has_perm(p_org, 'proposals.read');
  v_proposals_own boolean := app.has_perm(p_org, 'proposals.read_own');
  v_values_all boolean;
  v_mine uuid[];
  v_until timestamptz := now() + make_interval(days => p_days);
  v_since timestamptz := now() - make_interval(days => p_days);
  v_result jsonb;
begin
  if not (v_read_all or v_read_own) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_view is null or p_view not in ('open', 'closed')
     or (p_category is not null and p_category not in ('agenda', 'pacientes', 'financeiro'))
     or p_sort is null or p_sort not in ('priority', 'value', 'date')
     or p_days is null or p_days not between 1 and 90
     or p_limit is null or p_limit not between 1 and 100
     or p_offset is null or p_offset < 0 then
    raise exception 'Filtro inválido.' using errcode = 'P0001', hint = 'invalid_filter';
  end if;

  select * into v_s from public.opportunity_settings where organization_id = p_org;
  if p_force or v_s.organization_id is null or v_s.stale or v_s.last_refreshed_at is null
     or v_s.last_refreshed_at < now() - interval '10 minutes' then
    perform app.refresh_opportunities(p_org);
    select * into v_s from public.opportunity_settings where organization_id = p_org;
  end if;

  v_values_all := app.has_perm(p_org, 'finance.read') or (v_read_all and coalesce(v_s.reception_sees_values, false));
  select coalesce(array_agg(id), '{}') into v_mine
    from public.professionals where organization_id = p_org and user_id = auth.uid();

  with vis as (
    select o.*, app.opportunity_category(o.kind) as category,
           (o.status in ('new', 'in_progress')) as is_open,
           (v_values_all
            or (v_values_own and o.professional_id = any (v_mine))
            or (o.kind = 'proposal_stale' and (v_proposals_all or (v_proposals_own and o.professional_id = any (v_mine)))))
             as values_ok
    from public.opportunities o
    where o.organization_id = p_org
      and o.kind = any (v_s.enabled_kinds)
      and (o.professional_id is null or o.professional_id <> all (v_s.excluded_professional_ids))
      and (v_read_all or (v_read_own and v_s.professionals_see_own and o.professional_id = any (v_mine)))
      and (o.patient_id is null or v_patients_all or app.can_see_patient(p_org, o.patient_id))
      and (p_professional is null or o.professional_id = p_professional)
  ),
  -- Período: tipos de agenda olham para a frente; encerradas, para trás.
  scoped as (
    select * from vis
    where case when p_view = 'open'
               then vis.is_open and (vis.category <> 'agenda' or vis.window_start < v_until)
               else not vis.is_open and vis.resolved_at >= v_since end
  ),
  ranked as (
    select s.*, row_number() over (order by
             case when p_sort = 'value' then (case when s.values_ok then s.value_cents end) end desc nulls last,
             case when p_sort = 'date' then coalesce(s.window_start, s.detected_at) end asc,
             case when p_view = 'closed' then s.resolved_at end desc,
             s.priority asc, coalesce(s.window_start, s.detected_at) asc, s.id) as ord
    from scoped s
    where p_category is null or s.category = p_category
  )
  select jsonb_build_object(
    'refreshed_at', v_s.last_refreshed_at,
    'horizon_days', v_s.slot_horizon_days,
    'values_visible', v_values_all or v_values_own,
    'summary', (
      select jsonb_build_object(
        'at_risk_cents', sum(v.value_cents) filter (where v.is_open and v.category = 'agenda' and v.window_start < v_until and v.values_ok),
        'at_risk_unpriced', count(*) filter (where v.is_open and v.category = 'agenda' and v.window_start < v_until and v.values_ok and v.value_cents is null),
        'at_risk_hidden', count(*) filter (where v.is_open and v.category = 'agenda' and v.window_start < v_until and not v.values_ok),
        'proposals_cents', sum(v.value_cents) filter (where v.is_open and v.kind = 'proposal_stale' and v.values_ok),
        'free_slots', coalesce(sum(v.slot_count) filter (where v.is_open and v.category = 'agenda' and v.window_start < v_until), 0),
        'open', count(*) filter (where v.is_open and (v.category <> 'agenda' or v.window_start < v_until)),
        'high', count(*) filter (where v.is_open and v.priority = 1 and (v.category <> 'agenda' or v.window_start < v_until)),
        'resolved', count(*) filter (where v.status = 'resolved' and v.resolved_at >= v_since),
        'agenda', count(*) filter (where v.is_open and v.category = 'agenda' and v.window_start < v_until),
        'pacientes', count(*) filter (where v.is_open and v.category = 'pacientes'),
        'financeiro', count(*) filter (where v.is_open and v.category = 'financeiro'))
      from vis v),
    'total', (select count(*) from ranked),
    'items', coalesce((
      select jsonb_agg(jsonb_build_object(
               'id', r.id, 'kind', r.kind, 'category', r.category, 'status', r.status, 'priority', r.priority,
               'professional_id', r.professional_id, 'patient_id', r.patient_id, 'service_id', r.service_id,
               'appointment_id', r.appointment_id, 'follow_up_id', r.follow_up_id, 'proposal_id', r.proposal_id,
               'window_start', r.window_start, 'window_end', r.window_end, 'slot_count', r.slot_count,
               'value_cents', case when r.values_ok then r.value_cents end,
               'value_visible', r.values_ok,
               'basis', case when r.values_ok then r.value_basis else r.value_basis - 'unit_price_cents' - 'total_cents' end,
               'assigned_to', r.assigned_to, 'detected_at', r.detected_at, 'expires_at', r.expires_at,
               'resolved_at', r.resolved_at, 'resolution', r.resolution, 'dismiss_reason', r.dismiss_reason,
               'matches', case when r.is_open and r.kind in ('free_slots', 'cancelled_slot') then (
                   select count(*) from app.waiting_matches(r.id) m
                   where v_patients_all or app.can_see_patient(p_org, m.patient_id)) end,
               'last_action_at', (select max(a.created_at) from public.opportunity_actions a where a.opportunity_id = r.id)
             ) order by r.ord)
      from ranked r
      where r.ord > p_offset and r.ord <= p_offset + p_limit), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- Detalhe: como foi calculado, trechos livres, histórico e sugestões da lista de espera.
create function public.opportunity_detail(p_id uuid) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
  v_patients_all boolean;
  v_values boolean;
begin
  select * into v_o from public.opportunities where id = p_id;
  if v_o.id is null or not app.can_see_opportunity(v_o.organization_id, v_o.professional_id, v_o.patient_id) then
    raise exception 'Oportunidade não encontrada.' using errcode = 'P0001', hint = 'not_found';
  end if;
  v_patients_all := app.has_perm(v_o.organization_id, 'patients.read_all');
  v_values := app.can_see_opportunity_values(v_o.organization_id, v_o.professional_id, v_o.kind);
  return jsonb_build_object(
    'id', v_o.id,
    'value_cents', case when v_values then v_o.value_cents end,
    'basis', case when v_values then v_o.value_basis else v_o.value_basis - 'unit_price_cents' - 'total_cents' end,
    'free_ranges', (select coalesce(jsonb_agg(jsonb_build_object('start', lower(r), 'end', upper(r)) order by lower(r)), '[]'::jsonb)
                      from unnest(v_o.free_ranges) r),
    'actions', (select coalesce(jsonb_agg(jsonb_build_object(
                   'kind', a.kind, 'from', a.from_status, 'to', a.to_status, 'outcome', a.outcome, 'note', a.note,
                   'at', a.created_at, 'appointment_id', a.appointment_id,
                   'actor', case when a.actor_user_id is null then null else coalesce(pr.full_name, 'Equipe') end,
                   'assigned', case when a.kind = 'assigned' then coalesce(ap.full_name, '') end
                 ) order by a.id), '[]'::jsonb)
                from public.opportunity_actions a
                left join public.profiles pr on pr.user_id = a.actor_user_id
                left join public.profiles ap on ap.user_id = a.assigned_to
                where a.opportunity_id = v_o.id),
    'matches', (select coalesce(jsonb_agg(jsonb_build_object(
                   'entry_id', m.entry_id, 'patient_id', m.patient_id, 'service_id', m.service_id, 'starts_at', m.starts_at)),
                 '[]'::jsonb)
                from app.waiting_matches(v_o.id) m
                where v_patients_all or app.can_see_patient(v_o.organization_id, m.patient_id))
  );
end;
$$;

-- Status pela equipe: nova → em andamento; aberta → resolvida ou descartada (com motivo).
-- Reabrir à mão não existe: só o sistema reabre, quando a situação volta (docs/17 §5).
create function public.opportunity_set_status(p_id uuid, p_status public.opportunity_status, p_reason text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
  v_reason text := nullif(btrim(p_reason), '');
begin
  v_o := app.opportunity_for_work(p_id);
  if not ((v_o.status = 'new' and p_status in ('in_progress', 'resolved', 'dismissed'))
          or (v_o.status = 'in_progress' and p_status in ('resolved', 'dismissed'))) then
    raise exception 'Mudança de status não permitida.' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  if p_status = 'dismissed' and (v_reason is null or length(v_reason) < 3) then
    raise exception 'Informe o motivo do descarte.' using errcode = 'P0001', hint = 'reason_required';
  end if;
  update public.opportunities
     set status = p_status,
         resolved_at = case when p_status in ('resolved', 'dismissed') then now() end,
         resolved_by = case when p_status in ('resolved', 'dismissed') then auth.uid() end,
         resolution = case when p_status in ('resolved', 'dismissed') then 'manual' end,
         dismiss_reason = case when p_status = 'dismissed' then left(v_reason, 200) end
   where id = p_id;
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, from_status, to_status, note, actor_user_id)
  values (p_id, v_o.organization_id, 'status', v_o.status, p_status, left(v_reason, 300), auth.uid());
  -- Encerrar um orçamento parado conta como atividade: o próximo ciclo começa daqui.
  if v_o.proposal_id is not null then
    update public.proposals set last_activity_at = now() where id = v_o.proposal_id;
  end if;
end;
$$;

-- Tentativa de contato (manual: telefone, mensagem). Nova passa a "em andamento".
create function public.opportunity_log_contact(p_id uuid, p_outcome text, p_note text default null)
returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
  v_to public.opportunity_status;
begin
  v_o := app.opportunity_for_work(p_id);
  if v_o.status not in ('new', 'in_progress') then
    raise exception 'Esta oportunidade já foi encerrada.' using errcode = 'P0001', hint = 'closed';
  end if;
  if p_outcome is null or p_outcome not in ('no_answer', 'call_back', 'scheduled', 'not_now', 'other') then
    raise exception 'Escolha o resultado do contato.' using errcode = 'P0001', hint = 'invalid_outcome';
  end if;
  v_to := 'in_progress';
  if v_o.status = 'new' then
    update public.opportunities set status = v_to where id = p_id;
  end if;
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, from_status, to_status, outcome, note, actor_user_id)
  values (p_id, v_o.organization_id, 'contact', v_o.status, v_to, p_outcome, left(nullif(btrim(p_note), ''), 300), auth.uid());
  if v_o.proposal_id is not null then
    update public.proposals set last_activity_at = now() where id = v_o.proposal_id;
  end if;
end;
$$;

-- Responsável: alguém ativo da mesma clínica (ou ninguém).
create function public.opportunity_assign(p_id uuid, p_user uuid) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_o public.opportunities;
begin
  v_o := app.opportunity_for_work(p_id);
  if v_o.status not in ('new', 'in_progress') then
    raise exception 'Esta oportunidade já foi encerrada.' using errcode = 'P0001', hint = 'closed';
  end if;
  if p_user is not null and not exists (
       select 1 from public.memberships m
       where m.organization_id = v_o.organization_id and m.user_id = p_user and m.status = 'active') then
    raise exception 'A pessoa precisa fazer parte da equipe da clínica.' using errcode = 'P0001', hint = 'invalid_member';
  end if;
  update public.opportunities set assigned_to = p_user where id = p_id;
  insert into public.opportunity_actions (opportunity_id, organization_id, kind, from_status, to_status, assigned_to, actor_user_id)
  values (p_id, v_o.organization_id, 'assigned', v_o.status, v_o.status, p_user, auth.uid());
end;
$$;

-- Agendamento feito a partir da oportunidade (o agendamento em si já passou por create_appointment).
create function public.opportunity_record_booking(p_id uuid, p_appointment uuid) returns boolean
language plpgsql security definer
set search_path = ''
as $$
begin
  perform app.opportunity_for_work(p_id);
  return app.record_opportunity_booking(p_id, p_appointment);
end;
$$;

-- Agenda um paciente da lista de espera: agendamento e baixa na lista na MESMA transação.
-- O conflito de horário continua barrado pela restrição GiST (dentro de create_appointment).
create function public.book_from_waiting_list(
  p_entry uuid, p_professional uuid, p_service uuid, p_starts_at timestamptz, p_opportunity uuid default null
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_w public.waiting_list;
  v_id uuid;
begin
  select * into v_w from public.waiting_list where id = p_entry for update;
  if v_w.id is null or v_w.status <> 'waiting'
     or not app.can_read_schedule(v_w.organization_id, coalesce(v_w.professional_id, p_professional))
     or not app.can_see_patient(v_w.organization_id, v_w.patient_id) then
    raise exception 'Pedido da lista de espera não encontrado.' using errcode = 'P0001', hint = 'not_found';
  end if;
  if v_w.professional_id is not null and v_w.professional_id <> p_professional then
    raise exception 'Este paciente pediu outro profissional.' using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  v_id := public.create_appointment(v_w.organization_id, p_professional, coalesce(p_service, v_w.service_id),
                                    v_w.patient_id, p_starts_at, null);
  update public.waiting_list set status = 'booked', appointment_id = v_id where id = p_entry;
  if p_opportunity is not null then
    perform app.record_opportunity_booking(p_opportunity, v_id);
  end if;
  return v_id;
end;
$$;

-- Configurações da clínica (gestão). Poucos campos, todos com padrão.
create function public.save_opportunity_settings(
  p_org uuid,
  p_enabled public.opportunity_kind[],
  p_stale_days integer,
  p_horizon_days integer,
  p_lead_days integer,
  p_priorities jsonb,
  p_excluded uuid[],
  p_reception_sees_values boolean,
  p_professionals_see_own boolean
) returns void
language plpgsql security definer
set search_path = ''
as $$
begin
  if not app.has_perm(p_org, 'org.settings') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if exists (select 1 from unnest(coalesce(p_excluded, '{}'::uuid[])) x
             where not exists (select 1 from public.professionals p where p.id = x and p.organization_id = p_org)) then
    raise exception 'Profissional de outra clínica.' using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  insert into public.opportunity_settings as s (
    organization_id, enabled_kinds, proposal_stale_days, slot_horizon_days, follow_up_lead_days, priority_overrides,
    excluded_professional_ids, reception_sees_values, professionals_see_own, stale, updated_by, updated_at)
  values (
    p_org, coalesce(p_enabled, '{}'), p_stale_days, p_horizon_days, p_lead_days, coalesce(p_priorities, '{}'::jsonb),
    coalesce(array(select distinct x from unnest(p_excluded) x), '{}'), coalesce(p_reception_sees_values, false),
    coalesce(p_professionals_see_own, true), true, auth.uid(), now())
  on conflict (organization_id) do update set
    enabled_kinds = excluded.enabled_kinds,
    proposal_stale_days = excluded.proposal_stale_days,
    slot_horizon_days = excluded.slot_horizon_days,
    follow_up_lead_days = excluded.follow_up_lead_days,
    priority_overrides = excluded.priority_overrides,
    excluded_professional_ids = excluded.excluded_professional_ids,
    reception_sees_values = excluded.reception_sees_values,
    professionals_see_own = excluded.professionals_see_own,
    stale = true,
    updated_by = excluded.updated_by,
    updated_at = now();
  -- A tabela também guarda marcas internas (stale, última atualização): auditoria só aqui.
  insert into public.audit_logs (organization_id, actor_user_id, actor_kind, action, entity, entity_id, changes)
  values (p_org, auth.uid(), 'member', 'opportunity_settings.update', 'opportunity_settings', p_org,
          jsonb_build_object('enabled_kinds', p_enabled, 'proposal_stale_days', p_stale_days, 'slot_horizon_days', p_horizon_days,
                             'follow_up_lead_days', p_lead_days, 'priority_overrides', p_priorities,
                             'excluded_professionals', cardinality(coalesce(p_excluded, '{}'::uuid[])),
                             'reception_sees_values', p_reception_sees_values, 'professionals_see_own', p_professionals_see_own));
end;
$$;

-- Privilégios (o padrão do projeto não dá EXECUTE a ninguém: 0001).
grant execute on function app.can_see_opportunity(uuid, uuid, uuid), app.valid_priority_overrides(jsonb)
  to authenticated;
grant execute on function
  public.opportunities_feed(uuid, text, text, uuid, integer, text, integer, integer, boolean),
  public.opportunity_detail(uuid),
  public.opportunity_set_status(uuid, public.opportunity_status, text),
  public.opportunity_log_contact(uuid, text, text),
  public.opportunity_assign(uuid, uuid),
  public.opportunity_record_booking(uuid, uuid),
  public.book_from_waiting_list(uuid, uuid, uuid, timestamptz, uuid),
  public.save_opportunity_settings(uuid, public.opportunity_kind[], integer, integer, integer, jsonb, uuid[], boolean, boolean)
  to authenticated;
