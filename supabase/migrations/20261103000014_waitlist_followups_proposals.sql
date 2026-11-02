-- 0014 — Estruturas mínimas usadas pelo módulo Oportunidades (docs/17 §4):
-- lista de espera, retornos registrados e orçamentos. Só dados ADMINISTRATIVOS: nenhum campo
-- clínico, e observações curtas com aviso na tela para não registrar informação de saúde.
--
-- Garantias no banco:
--   • chaves compostas por organização: nada aponta para paciente, profissional, serviço ou
--     agendamento de outra clínica;
--   • profissional precisa oferecer o serviço escolhido;
--   • mudanças de status que dependem de agendamento (lista de espera "agendado", retorno
--     "agendado") só pelas funções do sistema, nunca por UPDATE direto;
--   • orçamento só por função (itens e total na mesma transação).

-- Outras tabelas passam a apontar para agendamentos da mesma clínica.
alter table public.appointments add constraint appointments_id_org unique (id, organization_id);

-- Permissões novas: gestão e recepção em tudo; profissional só no que é seu.
insert into public.role_permissions (role, permission)
select r::public.member_role, p from (values
  ('manager', 'opportunities.read'), ('manager', 'opportunities.work'),
  ('manager', 'proposals.read'), ('manager', 'proposals.write'),
  ('reception', 'opportunities.read'), ('reception', 'opportunities.work'),
  ('reception', 'proposals.read'), ('reception', 'proposals.write'),
  ('professional', 'opportunities.read_own'), ('professional', 'opportunities.work_own'),
  ('professional', 'proposals.read_own'), ('professional', 'proposals.write_own')
) v (r, p);

-- Pode ver itens da agenda ligados a este profissional ('appointments.read' ou o próprio)?
create function app.can_read_schedule(p_org uuid, p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'appointments.read')
      or (p_professional is not null and app.has_perm(p_org, 'appointments.read_own')
          and app.is_my_professional(p_professional));
$$;

-- Validações comuns: paciente ativo e profissional que oferece o serviço.
create function app.check_admin_refs() returns trigger
language plpgsql security definer
set search_path = ''
as $$
declare
  v jsonb := to_jsonb(new);
  v_patient uuid := (v ->> 'patient_id')::uuid;
  v_professional uuid := (v ->> 'professional_id')::uuid;
  v_service uuid := (v ->> 'service_id')::uuid;
begin
  if tg_op = 'INSERT' and v_patient is not null
     and exists (select 1 from public.patients where id = v_patient and deleted_at is not null) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0001', hint = 'invalid_patient';
  end if;
  if v_professional is not null and v_service is not null
     and not exists (select 1 from public.professional_services
                      where professional_id = v_professional and service_id = v_service) then
    raise exception 'Este profissional não oferece este serviço.' using errcode = 'P0001', hint = 'invalid_service';
  end if;
  return new;
end;
$$;

-- Lista de espera -----------------------------------------------------------------------------
create type public.waiting_status as enum ('waiting', 'booked', 'removed');

create table public.waiting_list (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null,
  service_id uuid,       -- vazio = qualquer serviço do profissional
  professional_id uuid,  -- vazio = qualquer profissional
  weekdays smallint[] check (weekdays is null or (cardinality(weekdays) between 1 and 7
                                                  and weekdays <@ array[0, 1, 2, 3, 4, 5, 6]::smallint[])),
  periods text[] check (periods is null or (cardinality(periods) between 1 and 3
                                            and periods <@ array['morning', 'afternoon', 'evening'])),
  earliest_date date,
  latest_date date,
  notes text check (notes is null or length(notes) <= 300),
  status public.waiting_status not null default 'waiting',
  appointment_id uuid,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (latest_date is null or earliest_date is null or latest_date >= earliest_date),
  check ((status = 'booked') = (appointment_id is not null)),
  constraint waiting_list_id_org unique (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients (id, organization_id) on delete cascade,
  foreign key (service_id, organization_id) references public.services (id, organization_id) on delete cascade,
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade,
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id)
);
-- Um pedido ativo por paciente + serviço + profissional (evita a mesma pessoa duas vezes).
create unique index waiting_list_one_active on public.waiting_list (
  organization_id, patient_id,
  coalesce(service_id, '00000000-0000-0000-0000-000000000000'::uuid),
  coalesce(professional_id, '00000000-0000-0000-0000-000000000000'::uuid)
) where status = 'waiting';
create index on public.waiting_list (organization_id, status);
create trigger waiting_list_touch before update on public.waiting_list
  for each row execute function app.touch_updated_at();
create trigger waiting_list_refs before insert or update on public.waiting_list
  for each row execute function app.check_admin_refs();

-- Pela tela: só "retirar" e "voltar para a fila". "Agendado" é sempre pela função de agendamento.
create function app.waiting_list_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if current_user = 'authenticated'
       and not ((old.status = 'waiting' and new.status = 'removed') or (old.status = 'removed' and new.status = 'waiting')) then
      raise exception 'Mudança não permitida na lista de espera.' using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    new.closed_at := case when new.status = 'waiting' then null else now() end;
  end if;
  return new;
end;
$$;
create trigger waiting_list_guard before update on public.waiting_list
  for each row execute function app.waiting_list_guard();

-- Retornos registrados ------------------------------------------------------------------------
-- Só o que alguém cadastrou ("retorno em 30 dias"). Nada é inferido do histórico (docs/17 §5 C).
create type public.follow_up_status as enum ('pending', 'scheduled', 'done', 'cancelled');

create table public.follow_ups (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null,
  professional_id uuid not null,
  service_id uuid,
  due_date date not null check (due_date between date '2000-01-01' and date '2100-12-31'),
  status public.follow_up_status not null default 'pending',
  appointment_id uuid,         -- agendamento que cumpre o retorno (ligado pelo sistema)
  source_appointment_id uuid,  -- atendimento em que o retorno foi combinado (opcional)
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  check (status <> 'scheduled' or appointment_id is not null),
  constraint follow_ups_id_org unique (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients (id, organization_id) on delete cascade,
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id) on delete cascade,
  foreign key (service_id, organization_id) references public.services (id, organization_id) on delete set null (service_id),
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id),
  foreign key (source_appointment_id, organization_id) references public.appointments (id, organization_id)
);
create index on public.follow_ups (organization_id, status, due_date);
create index on public.follow_ups (patient_id);
create trigger follow_ups_touch before update on public.follow_ups
  for each row execute function app.touch_updated_at();
create trigger follow_ups_refs before insert or update on public.follow_ups
  for each row execute function app.check_admin_refs();

-- Pela tela: concluir ou cancelar um pendente, ou reabrir um cancelado. "Agendado" é do sistema.
create function app.follow_up_guard() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.status is distinct from old.status then
    if current_user = 'authenticated'
       and not ((old.status = 'pending' and new.status in ('done', 'cancelled')) or (old.status = 'cancelled' and new.status = 'pending')) then
      raise exception 'Mudança não permitida no retorno.' using errcode = 'P0001', hint = 'invalid_transition';
    end if;
    new.closed_at := case when new.status in ('pending', 'scheduled') then null else now() end;
  end if;
  return new;
end;
$$;
create trigger follow_ups_guard before update on public.follow_ups
  for each row execute function app.follow_up_guard();

-- Orçamentos ------------------------------------------------------------------------------------
-- Estrutura administrativa e independente de prontuário. Proposta aberta NÃO é receita perdida.
create type public.proposal_status as enum ('open', 'accepted', 'declined', 'cancelled', 'expired');

create table public.proposals (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  patient_id uuid not null,
  professional_id uuid,
  title text not null check (length(btrim(title)) between 2 and 120),
  status public.proposal_status not null default 'open',
  valid_until date,
  total_cents bigint not null default 0 check (total_cents between 0 and 10000000000),
  last_activity_at timestamptz not null default now(),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  closed_at timestamptz,
  constraint proposals_id_org unique (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients (id, organization_id) on delete cascade,
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id)
);
create index on public.proposals (organization_id, status);
create index on public.proposals (patient_id);
create trigger proposals_touch before update on public.proposals
  for each row execute function app.touch_updated_at();
create trigger proposals_refs before insert or update on public.proposals
  for each row execute function app.check_admin_refs();

create table public.proposal_items (
  id uuid primary key default gen_random_uuid(),
  proposal_id uuid not null,
  organization_id uuid not null,
  service_id uuid,
  description text not null check (length(btrim(description)) between 1 and 120),
  quantity integer not null check (quantity between 1 and 999),
  unit_price_cents bigint not null check (unit_price_cents between 0 and 100000000),
  position smallint not null default 0,
  foreign key (proposal_id, organization_id) references public.proposals (id, organization_id) on delete cascade,
  foreign key (service_id, organization_id) references public.services (id, organization_id)
);
create index on public.proposal_items (proposal_id);

-- Auditoria: tudo cita paciente, então só os nomes dos campos (como em patients e appointments).
create trigger audit_waiting_list after insert or update or delete on public.waiting_list
  for each row execute function app.audit_row_fields_only();
create trigger audit_follow_ups after insert or update or delete on public.follow_ups
  for each row execute function app.audit_row_fields_only();
create trigger audit_proposals after insert or update or delete on public.proposals
  for each row execute function app.audit_row_fields_only();

-- RLS -------------------------------------------------------------------------------------------
alter table public.waiting_list enable row level security;
alter table public.follow_ups enable row level security;
alter table public.proposals enable row level security;
alter table public.proposal_items enable row level security;

revoke all on public.waiting_list, public.follow_ups, public.proposals, public.proposal_items from anon, authenticated;

-- Lista de espera: quem escreve na agenda do profissional (ou em qualquer uma, se vazio).
grant select on public.waiting_list to authenticated;
grant insert (organization_id, patient_id, service_id, professional_id, weekdays, periods, earliest_date, latest_date, notes)
  on public.waiting_list to authenticated;
grant update (service_id, professional_id, weekdays, periods, earliest_date, latest_date, notes, status)
  on public.waiting_list to authenticated;
create policy waiting_select on public.waiting_list for select to authenticated
  using (app.can_read_schedule(organization_id, professional_id) and app.can_see_patient(organization_id, patient_id));
create policy waiting_insert on public.waiting_list for insert to authenticated
  with check (
    app.org_writable(organization_id)
    and created_by = (select auth.uid())
    and status = 'waiting'
    and app.can_write_schedule(organization_id, professional_id)
    and app.can_see_patient(organization_id, patient_id)
  );
create policy waiting_update on public.waiting_list for update to authenticated
  using (app.can_write_schedule(organization_id, professional_id) and app.can_see_patient(organization_id, patient_id))
  with check (app.org_writable(organization_id) and app.can_write_schedule(organization_id, professional_id));

-- Retornos: mesma regra, sempre com profissional.
grant select on public.follow_ups to authenticated;
grant insert (organization_id, patient_id, professional_id, service_id, due_date, source_appointment_id)
  on public.follow_ups to authenticated;
grant update (service_id, due_date, status) on public.follow_ups to authenticated;
create policy follow_ups_select on public.follow_ups for select to authenticated
  using (app.can_read_schedule(organization_id, professional_id) and app.can_see_patient(organization_id, patient_id));
create policy follow_ups_insert on public.follow_ups for insert to authenticated
  with check (
    app.org_writable(organization_id)
    and created_by = (select auth.uid())
    and status = 'pending'
    and app.can_write_schedule(organization_id, professional_id)
    and app.can_see_patient(organization_id, patient_id)
  );
create policy follow_ups_update on public.follow_ups for update to authenticated
  using (app.can_write_schedule(organization_id, professional_id) and app.can_see_patient(organization_id, patient_id))
  with check (app.org_writable(organization_id) and app.can_write_schedule(organization_id, professional_id));

-- Orçamentos: leitura direta; escrita só pelas funções abaixo.
create function app.can_read_proposal(p_org uuid, p_professional uuid, p_created_by uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'proposals.read')
      or (app.has_perm(p_org, 'proposals.read_own')
          and ((p_professional is not null and app.is_my_professional(p_professional)) or p_created_by = (select auth.uid())));
$$;
create function app.can_write_proposal(p_org uuid, p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'proposals.write')
      or (p_professional is not null and app.has_perm(p_org, 'proposals.write_own') and app.is_my_professional(p_professional));
$$;

grant select on public.proposals, public.proposal_items to authenticated;
create policy proposals_select on public.proposals for select to authenticated
  using (app.can_read_proposal(organization_id, professional_id, created_by) and app.can_see_patient(organization_id, patient_id));
create policy proposal_items_select on public.proposal_items for select to authenticated
  using (exists (select 1 from public.proposals p where p.id = proposal_id));

-- Funções -----------------------------------------------------------------------------------

-- Cria ou edita um orçamento aberto, trocando os itens e recalculando o total.
-- p_items: [{"service_id": "...", "description": "Limpeza", "quantity": 1, "unit_price_cents": 15000}, ...]
create function public.save_proposal(
  p_org uuid,
  p_id uuid,
  p_patient uuid,
  p_professional uuid,
  p_title text,
  p_valid_until date,
  p_items jsonb
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.proposals;
  v_id uuid := p_id;
  v_item jsonb;
  v_service_id uuid;
  v_service_name text;
  v_desc text;
  v_qty integer;
  v_price bigint;
  v_total bigint := 0;
  v_pos smallint := 0;
begin
  if not app.can_write_proposal(p_org, p_professional) then
    raise exception 'Sem permissão para criar este orçamento.' using errcode = '42501';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if p_patient is null
     or not exists (select 1 from public.patients where id = p_patient and organization_id = p_org and deleted_at is null)
     or not app.can_see_patient(p_org, p_patient) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0001', hint = 'invalid_patient';
  end if;
  if p_professional is not null
     and not exists (select 1 from public.professionals where id = p_professional and organization_id = p_org) then
    raise exception 'Profissional de outra clínica.' using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  if p_valid_until is not null and p_valid_until < (now() at time zone (select timezone from public.organizations where id = p_org))::date then
    raise exception 'A validade não pode estar no passado.' using errcode = 'P0001', hint = 'invalid_date';
  end if;
  if jsonb_typeof(p_items) is distinct from 'array' or jsonb_array_length(p_items) not between 1 and 50 then
    raise exception 'Inclua de 1 a 50 itens.' using errcode = 'P0001', hint = 'invalid_items';
  end if;

  if v_id is not null then
    select * into v_old from public.proposals where id = v_id and organization_id = p_org for update;
    if v_old.id is null or not app.can_write_proposal(p_org, v_old.professional_id) then
      raise exception 'Orçamento não encontrado.' using errcode = 'P0001', hint = 'not_found';
    end if;
    if v_old.status <> 'open' then
      raise exception 'Só orçamentos em aberto podem ser editados.' using errcode = 'P0001', hint = 'invalid_status';
    end if;
    update public.proposals
       set patient_id = p_patient, professional_id = p_professional, title = btrim(p_title),
           valid_until = p_valid_until, last_activity_at = now()
     where id = v_id;
    delete from public.proposal_items where proposal_id = v_id;
  else
    insert into public.proposals (organization_id, patient_id, professional_id, title, valid_until, created_by)
    values (p_org, p_patient, p_professional, btrim(p_title), p_valid_until, auth.uid())
    returning id into v_id;
  end if;

  for v_item in select * from jsonb_array_elements(p_items) loop
    v_service_id := null;
    v_service_name := null;
    if nullif(v_item ->> 'service_id', '') is not null then
      select s.id, s.name into v_service_id, v_service_name
      from public.services s where s.id = (v_item ->> 'service_id')::uuid and s.organization_id = p_org;
      if v_service_id is null then
        raise exception 'Serviço de outra clínica.' using errcode = 'P0001', hint = 'invalid_service';
      end if;
    end if;
    v_desc := coalesce(nullif(btrim(v_item ->> 'description'), ''), v_service_name);
    v_qty := coalesce((v_item ->> 'quantity')::integer, 1);
    v_price := (v_item ->> 'unit_price_cents')::bigint;
    if v_desc is null or v_price is null then
      raise exception 'Cada item precisa de descrição e valor.' using errcode = 'P0001', hint = 'invalid_items';
    end if;
    insert into public.proposal_items (proposal_id, organization_id, service_id, description, quantity, unit_price_cents, position)
    values (v_id, p_org, v_service_id, v_desc, v_qty, v_price, v_pos);
    v_total := v_total + v_qty * v_price;
    v_pos := v_pos + 1;
  end loop;

  update public.proposals set total_cents = v_total where id = v_id;
  return v_id;
end;
$$;

-- Aceito, recusado ou cancelado. "Vencido" é marcado pelo sistema quando passa a validade.
create function public.set_proposal_status(p_id uuid, p_status public.proposal_status) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_p public.proposals;
begin
  select * into v_p from public.proposals where id = p_id for update;
  if v_p.id is null or not app.can_write_proposal(v_p.organization_id, v_p.professional_id) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if not app.org_writable(v_p.organization_id) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
  if v_p.status <> 'open' or p_status not in ('accepted', 'declined', 'cancelled') then
    raise exception 'Mudança de status não permitida.' using errcode = 'P0001', hint = 'invalid_transition';
  end if;
  update public.proposals set status = p_status, closed_at = now(), last_activity_at = now() where id = p_id;
end;
$$;

grant execute on function app.can_read_schedule(uuid, uuid), app.can_read_proposal(uuid, uuid, uuid),
  app.can_write_proposal(uuid, uuid), app.check_admin_refs(), app.waiting_list_guard(), app.follow_up_guard()
  to authenticated;
grant execute on function public.save_proposal(uuid, uuid, uuid, uuid, text, date, jsonb),
  public.set_proposal_status(uuid, public.proposal_status)
  to authenticated;
