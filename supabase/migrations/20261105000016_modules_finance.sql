-- 0016 — Módulos por clínica e Financeiro (docs/19, decisão D-26).
--
-- Módulos: cada clínica escolhe no onboarding o que usa (Agenda, Oportunidades, Financeiro) e a
-- gestão muda depois. Oportunidades depende da Agenda. Clínicas que já existiam ficam com tudo ligado.
--
-- Financeiro: lançamentos de receita e despesa, categorias, formas de pagamento, repetição mensal e
-- parcelas, recebimento a partir do atendimento e relatório. Regras de acesso (matriz em docs/04):
--   • gestão: tudo (lança receitas e despesas, vê totais e relatório);
--   • recepção: lança e recebe RECEITAS; não vê despesas, totais nem relatório;
--   • profissional: só lê as receitas dos próprios atendimentos.
-- Escrita só por funções; valores em centavos; cancelado nunca é apagado.

-- Módulos ---------------------------------------------------------------------------------------
create table public.organization_features (
  organization_id uuid not null references public.organizations (id) on delete cascade,
  feature text not null check (feature in ('schedule', 'opportunities', 'finance')),
  enabled boolean not null default true,
  updated_at timestamptz not null default now(),
  primary key (organization_id, feature)
);

insert into public.organization_features (organization_id, feature, enabled)
select o.id, f, true from public.organizations o, unnest(array['schedule', 'opportunities', 'finance']) f
on conflict do nothing;

-- Sem nenhuma linha para a clínica (criada fora de create_organization), tudo ligado — como a tela.
create function app.module_enabled(p_org uuid, p_feature text) returns boolean
language sql stable security definer
set search_path = ''
as $
  select coalesce((select f.enabled from public.organization_features f
                   where f.organization_id = p_org and f.feature = p_feature),
                  not exists (select 1 from public.organization_features f where f.organization_id = p_org));
$;

-- Financeiro: tipos e tabelas --------------------------------------------------------------------
create type public.fin_type as enum ('income', 'expense');
create type public.fin_status as enum ('pending', 'paid', 'cancelled');

create table public.financial_categories (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.fin_type not null,
  name text not null check (length(btrim(name)) between 2 and 60),
  active boolean not null default true,
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint financial_categories_id_org unique (id, organization_id)
);
create unique index financial_categories_name on public.financial_categories (organization_id, type, lower(name));

create table public.financial_entries (
  id uuid primary key default gen_random_uuid(),
  organization_id uuid not null references public.organizations (id) on delete cascade,
  type public.fin_type not null,
  category_id uuid not null,
  description text not null check (length(btrim(description)) between 2 and 160),
  amount_cents bigint not null check (amount_cents between 1 and 10000000000),
  due_date date not null check (due_date between date '2000-01-01' and date '2100-12-31'),
  paid_at date check (paid_at is null or paid_at between date '2000-01-01' and date '2100-12-31'),
  status public.fin_status not null default 'pending',
  payment_method text check (payment_method is null
                             or payment_method in ('pix', 'cash', 'debit', 'credit', 'transfer', 'boleto', 'other')),
  patient_id uuid,
  professional_id uuid,
  appointment_id uuid,
  notes text check (notes is null or length(notes) <= 300),
  series_id uuid,          -- repetição mensal ou parcelas criadas juntas
  repeat_kind text check (repeat_kind is null or repeat_kind in ('monthly', 'installments')),
  installment smallint,
  installments smallint,
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  cancelled_at timestamptz,
  check ((status = 'paid') = (paid_at is not null)),
  check ((status = 'cancelled') = (cancelled_at is not null)),
  check (installment is null or (installments is not null and installment between 1 and installments)),
  check (appointment_id is null or type = 'income'),
  constraint financial_entries_id_org unique (id, organization_id),
  foreign key (category_id, organization_id) references public.financial_categories (id, organization_id),
  foreign key (patient_id, organization_id) references public.patients (id, organization_id),
  foreign key (professional_id, organization_id) references public.professionals (id, organization_id),
  foreign key (appointment_id, organization_id) references public.appointments (id, organization_id)
);
create index on public.financial_entries (organization_id, due_date);
create index on public.financial_entries (organization_id, paid_at) where status = 'paid';
create index on public.financial_entries (series_id) where series_id is not null;
-- Um recebimento ativo por atendimento (evita receber duas vezes o mesmo).
create unique index financial_entries_one_per_appointment on public.financial_entries (appointment_id)
  where appointment_id is not null and status <> 'cancelled';
create trigger financial_entries_touch before update on public.financial_entries
  for each row execute function app.touch_updated_at();

-- Categoria do mesmo tipo do lançamento; paciente ativo.
create function app.check_financial_entry() returns trigger
language plpgsql security definer
set search_path = ''
as $$
begin
  if not exists (select 1 from public.financial_categories c where c.id = new.category_id and c.type = new.type) then
    raise exception 'A categoria não é do mesmo tipo do lançamento.' using errcode = 'P0001', hint = 'invalid_category';
  end if;
  if tg_op = 'INSERT' and new.patient_id is not null
     and exists (select 1 from public.patients where id = new.patient_id and deleted_at is not null) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0001', hint = 'invalid_patient';
  end if;
  return new;
end;
$$;
create trigger financial_entries_check before insert or update on public.financial_entries
  for each row execute function app.check_financial_entry();

create trigger audit_financial_categories after insert or update or delete on public.financial_categories
  for each row execute function app.audit_row();
-- Lançamento pode citar paciente: auditoria só com os nomes dos campos.
create trigger audit_financial_entries after insert or update or delete on public.financial_entries
  for each row execute function app.audit_row_fields_only();

-- Categorias iniciais (editáveis em Financeiro → Categorias).
create function app.seed_finance_categories(p_org uuid) returns void
language sql security definer
set search_path = ''
as $$
  insert into public.financial_categories (organization_id, type, name, position)
  select p_org, t::public.fin_type, n, row_number() over (partition by t order by ord)::smallint - 1
  from (values
    ('income', 'Atendimentos', 1), ('income', 'Procedimentos', 2), ('income', 'Venda de produtos', 3), ('income', 'Outras receitas', 4),
    ('expense', 'Aluguel', 1), ('expense', 'Salários e pró-labore', 2), ('expense', 'Materiais e insumos', 3),
    ('expense', 'Impostos e taxas', 4), ('expense', 'Marketing', 5), ('expense', 'Contas de consumo', 6), ('expense', 'Outras despesas', 7)
  ) v (t, n, ord)
  where not exists (select 1 from public.financial_categories c where c.organization_id = p_org);
$$;

select app.seed_finance_categories(o.id) from public.organizations o;

-- Módulos: regras e funções -------------------------------------------------------------------------

-- Grava a escolha (as três linhas sempre existem). Oportunidades exige Agenda; ao menos um módulo.
create function app.apply_modules(p_org uuid, p_modules text[]) returns void
language plpgsql security definer
set search_path = ''
as $$
declare
  v_modules text[] := coalesce(p_modules, '{}');
begin
  if cardinality(v_modules) = 0 then
    raise exception 'Escolha ao menos um módulo.' using errcode = 'P0001', hint = 'no_modules';
  end if;
  if exists (select 1 from unnest(v_modules) m where m not in ('schedule', 'opportunities', 'finance')) then
    raise exception 'Módulo desconhecido.' using errcode = 'P0001', hint = 'invalid_module';
  end if;
  if 'opportunities' = any (v_modules) and not 'schedule' = any (v_modules) then
    raise exception 'Oportunidades usa a Agenda: ligue a Agenda também.' using errcode = 'P0001', hint = 'opportunities_needs_schedule';
  end if;
  insert into public.organization_features (organization_id, feature, enabled, updated_at)
  select p_org, f, f = any (v_modules), now() from unnest(array['schedule', 'opportunities', 'finance']) f
  on conflict (organization_id, feature) do update set enabled = excluded.enabled, updated_at = now();
  if 'finance' = any (v_modules) then
    perform app.seed_finance_categories(p_org);
  end if;
end;
$$;

create function public.set_organization_modules(p_org uuid, p_modules text[]) returns void
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
  perform app.apply_modules(p_org, p_modules);
  insert into public.audit_logs (organization_id, actor_user_id, actor_kind, action, entity, entity_id, changes)
  values (p_org, auth.uid(), 'member', 'organization_features.update', 'organization_features', p_org,
          jsonb_build_object('modules', p_modules));
end;
$$;

-- create_organization ganha os módulos escolhidos (padrão: todos, como antes).
drop function public.create_organization(text, text, public.org_segment, jsonb, boolean, text, text);
create function public.create_organization(
  p_name text,
  p_slug text,
  p_segment public.org_segment,
  p_onboarding jsonb default '{}',
  p_attends boolean default false,
  p_specialty text default null,
  p_timezone text default 'America/Sao_Paulo',
  p_modules text[] default array['schedule', 'opportunities', 'finance']
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

  -- Profissional só faz sentido com agenda.
  if p_attends and 'schedule' = any (coalesce(p_modules, '{}')) then
    select full_name into v_name from public.profiles where user_id = v_uid;
    insert into public.professionals (organization_id, user_id, display_name, specialty)
    values (v_org, v_uid, coalesce(v_name, 'Profissional'), nullif(btrim(p_specialty), ''));
  end if;

  perform app.apply_modules(v_org, p_modules);
  return v_org;
end;
$$;

-- Financeiro: permissões e funções ---------------------------------------------------------------

create function app.can_read_finance_entry(p_org uuid, p_type public.fin_type, p_professional uuid) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'finance.read')
      or (p_type = 'income' and app.has_perm(p_org, 'finance.write'))
      or (p_type = 'income' and p_professional is not null and app.has_perm(p_org, 'finance.read_own')
          and app.is_my_professional(p_professional));
$$;

-- Gestão escreve receitas e despesas; recepção, só receitas.
create function app.can_write_finance(p_org uuid, p_type public.fin_type) returns boolean
language sql stable security definer
set search_path = ''
as $$
  select app.has_perm(p_org, 'finance.write') and (p_type = 'income' or app.has_perm(p_org, 'finance.read'));
$$;

create function app.finance_guard(p_org uuid) returns void
language plpgsql stable security definer
set search_path = ''
as $$
begin
  if not app.module_enabled(p_org, 'finance') then
    raise exception 'O módulo Financeiro está desligado nesta clínica.' using errcode = 'P0001', hint = 'module_disabled';
  end if;
  if not app.org_writable(p_org) then
    raise exception 'Clínica em modo somente leitura.' using errcode = 'P0001', hint = 'org_read_only';
  end if;
end;
$$;

create function app.org_today(p_org uuid) returns date
language sql stable security definer
set search_path = ''
as $$
  select (now() at time zone (select timezone from public.organizations where id = p_org))::date;
$$;

-- Cria (com repetição mensal ou parcelas) ou edita um lançamento. Devolve o id do primeiro.
create function public.save_financial_entry(
  p_org uuid,
  p_id uuid,
  p_type public.fin_type,
  p_category uuid,
  p_description text,
  p_amount_cents bigint,
  p_due_date date,
  p_paid_at date default null,
  p_method text default null,
  p_patient uuid default null,
  p_professional uuid default null,
  p_notes text default null,
  p_repeat text default 'none',
  p_count integer default 1
) returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_old public.financial_entries;
  v_first uuid;
  v_id uuid;
  v_series uuid;
  v_n integer := case when coalesce(p_repeat, 'none') = 'none' then 1 else coalesce(p_count, 1) end;
  v_amount bigint;
  v_i integer;
begin
  if not app.can_write_finance(p_org, p_type) then
    raise exception 'Sem permissão para este lançamento.' using errcode = '42501';
  end if;
  perform app.finance_guard(p_org);
  if coalesce(p_repeat, 'none') not in ('none', 'monthly', 'installments') or v_n not between 1 and 60
     or (p_repeat in ('monthly', 'installments') and v_n < 2) then
    raise exception 'Repetição inválida (de 2 a 60 vezes).' using errcode = 'P0001', hint = 'invalid_repeat';
  end if;
  if not exists (select 1 from public.financial_categories c
                 where c.id = p_category and c.organization_id = p_org and c.type = p_type and c.active) then
    raise exception 'Escolha uma categoria válida.' using errcode = 'P0001', hint = 'invalid_category';
  end if;
  if p_patient is not null and (
       not exists (select 1 from public.patients where id = p_patient and organization_id = p_org and deleted_at is null)
       or not app.can_see_patient(p_org, p_patient)) then
    raise exception 'Paciente não encontrado.' using errcode = 'P0001', hint = 'invalid_patient';
  end if;
  if p_professional is not null
     and not exists (select 1 from public.professionals where id = p_professional and organization_id = p_org) then
    raise exception 'Profissional de outra clínica.' using errcode = 'P0001', hint = 'invalid_professional';
  end if;
  if p_amount_cents is null or p_amount_cents < v_n then
    raise exception 'Informe um valor maior que zero.' using errcode = 'P0001', hint = 'invalid_amount';
  end if;

  -- Edição: um lançamento por vez; tipo, atendimento e série não mudam.
  if p_id is not null then
    select * into v_old from public.financial_entries where id = p_id and organization_id = p_org for update;
    if v_old.id is null or v_old.type <> p_type or not app.can_write_finance(p_org, v_old.type) then
      raise exception 'Lançamento não encontrado.' using errcode = 'P0001', hint = 'not_found';
    end if;
    if v_old.status = 'cancelled' then
      raise exception 'Lançamento cancelado não pode ser editado.' using errcode = 'P0001', hint = 'invalid_status';
    end if;
    update public.financial_entries
       set category_id = p_category, description = btrim(p_description), amount_cents = p_amount_cents,
           due_date = p_due_date, paid_at = p_paid_at,
           status = case when p_paid_at is null then 'pending'::public.fin_status else 'paid'::public.fin_status end,
           payment_method = case when p_paid_at is null then null else p_method end,
           patient_id = p_patient, professional_id = p_professional, notes = nullif(btrim(p_notes), '')
     where id = p_id;
    return p_id;
  end if;

  v_series := case when v_n > 1 then gen_random_uuid() end;
  for v_i in 0 .. v_n - 1 loop
    -- Parcelas dividem o total (o resto dos centavos vai na primeira); repetição mensal repete o valor.
    v_amount := case when p_repeat = 'installments'
                     then p_amount_cents / v_n + case when v_i = 0 then p_amount_cents % v_n else 0 end
                     else p_amount_cents end;
    insert into public.financial_entries (
      organization_id, type, category_id, description, amount_cents, due_date, paid_at, status, payment_method,
      patient_id, professional_id, notes, series_id, repeat_kind, installment, installments)
    values (
      p_org, p_type, p_category, btrim(p_description), v_amount,
      (p_due_date + make_interval(months => v_i))::date,
      case when v_i = 0 then p_paid_at end,
      case when v_i = 0 and p_paid_at is not null then 'paid'::public.fin_status else 'pending'::public.fin_status end,
      case when v_i = 0 and p_paid_at is not null then p_method end,
      p_patient, p_professional, nullif(btrim(p_notes), ''), v_series,
      case when v_n > 1 then p_repeat end,
      case when v_n > 1 then v_i + 1 end,
      case when v_n > 1 then v_n end)
    returning id into v_id;
    if v_i = 0 then v_first := v_id; end if;
  end loop;
  return v_first;
end;
$$;

-- Pagar (com data e forma), voltar a pendente ou cancelar (opcional: os próximos da série).
create function public.set_financial_entry_status(
  p_id uuid,
  p_status public.fin_status,
  p_paid_at date default null,
  p_method text default null,
  p_following boolean default false
) returns integer
language plpgsql security definer
set search_path = ''
as $$
declare
  v_e public.financial_entries;
  v_count integer;
begin
  select * into v_e from public.financial_entries where id = p_id for update;
  if v_e.id is null or not app.can_write_finance(v_e.organization_id, v_e.type) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform app.finance_guard(v_e.organization_id);
  if p_method is not null and p_method not in ('pix', 'cash', 'debit', 'credit', 'transfer', 'boleto', 'other') then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001', hint = 'invalid_method';
  end if;

  if p_status = 'paid' and v_e.status = 'pending' then
    update public.financial_entries
       set status = 'paid', paid_at = coalesce(p_paid_at, app.org_today(v_e.organization_id)), payment_method = p_method
     where id = p_id;
    return 1;
  elsif p_status = 'pending' and v_e.status = 'paid' then
    update public.financial_entries set status = 'pending', paid_at = null, payment_method = null where id = p_id;
    return 1;
  elsif p_status = 'cancelled' and v_e.status <> 'cancelled' then
    update public.financial_entries
       set status = 'cancelled', paid_at = null, cancelled_at = now()
     where id = p_id
        or (p_following and v_e.series_id is not null and series_id = v_e.series_id
            and installment > v_e.installment and status = 'pending');
    get diagnostics v_count = row_count;
    return v_count;
  end if;
  raise exception 'Mudança de status não permitida.' using errcode = 'P0001', hint = 'invalid_transition';
end;
$$;

-- Recebimento de um atendimento: receita paga, ligada ao atendimento, paciente e profissional.
create function public.receive_appointment(p_appointment uuid, p_amount_cents bigint, p_paid_at date, p_method text)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_a public.appointments;
  v_cat uuid;
  v_id uuid;
begin
  select * into v_a from public.appointments where id = p_appointment;
  if v_a.id is null or not app.can_write_finance(v_a.organization_id, 'income')
     or not (app.has_perm(v_a.organization_id, 'appointments.read')
             or (app.has_perm(v_a.organization_id, 'appointments.read_own') and app.is_my_professional(v_a.professional_id))) then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform app.finance_guard(v_a.organization_id);
  if v_a.status not in ('confirmed', 'completed') then
    raise exception 'Só atendimentos confirmados ou concluídos podem ser recebidos.' using errcode = 'P0001', hint = 'invalid_status';
  end if;
  if p_amount_cents is null or p_amount_cents < 1 then
    raise exception 'Informe um valor maior que zero.' using errcode = 'P0001', hint = 'invalid_amount';
  end if;
  if p_method is not null and p_method not in ('pix', 'cash', 'debit', 'credit', 'transfer', 'boleto', 'other') then
    raise exception 'Forma de pagamento inválida.' using errcode = 'P0001', hint = 'invalid_method';
  end if;
  perform app.seed_finance_categories(v_a.organization_id);
  select c.id into v_cat from public.financial_categories c
   where c.organization_id = v_a.organization_id and c.type = 'income' and c.active
   order by (lower(c.name) = 'atendimentos') desc, c.position, c.name
   limit 1;
  if v_cat is null then
    raise exception 'Cadastre uma categoria de receita.' using errcode = 'P0001', hint = 'invalid_category';
  end if;

  begin
    insert into public.financial_entries (
      organization_id, type, category_id, description, amount_cents, due_date, paid_at, status, payment_method,
      patient_id, professional_id, appointment_id)
    values (
      v_a.organization_id, 'income', v_cat,
      coalesce((select s.name from public.services s where s.id = v_a.service_id), 'Atendimento'),
      p_amount_cents, coalesce(p_paid_at, app.org_today(v_a.organization_id)),
      coalesce(p_paid_at, app.org_today(v_a.organization_id)), 'paid', p_method,
      v_a.patient_id, v_a.professional_id, v_a.id)
    returning id into v_id;
  exception when unique_violation then
    raise exception 'Este atendimento já tem um recebimento registrado.' using errcode = 'P0001', hint = 'already_received';
  end;
  return v_id;
end;
$$;

-- Categorias (gestão).
create function public.save_financial_category(p_org uuid, p_id uuid, p_type public.fin_type, p_name text, p_active boolean default true)
returns uuid
language plpgsql security definer
set search_path = ''
as $$
declare
  v_id uuid := p_id;
begin
  if not app.has_perm(p_org, 'finance.read') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  perform app.finance_guard(p_org);
  begin
    if v_id is null then
      insert into public.financial_categories (organization_id, type, name, position)
      values (p_org, p_type, btrim(p_name),
              coalesce((select max(position) + 1 from public.financial_categories where organization_id = p_org and type = p_type), 0))
      returning id into v_id;
    else
      update public.financial_categories set name = btrim(p_name), active = coalesce(p_active, true)
       where id = v_id and organization_id = p_org and type = p_type;
      if not found then
        raise exception 'Categoria não encontrada.' using errcode = 'P0001', hint = 'not_found';
      end if;
    end if;
  exception when unique_violation then
    raise exception 'Já existe uma categoria com esse nome.' using errcode = 'P0001', hint = 'duplicate';
  end;
  return v_id;
end;
$$;

-- Relatório do período (gestão): realizado (pelo pagamento), previsto (pelo vencimento), em atraso,
-- e quebras por categoria, forma de pagamento, profissional e mês. Cancelados não contam.
create function public.finance_report(p_org uuid, p_from date, p_to date) returns jsonb
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_today date;
  v_result jsonb;
begin
  if not app.has_perm(p_org, 'finance.read') then
    raise exception 'Sem permissão.' using errcode = '42501';
  end if;
  if p_from is null or p_to is null or p_to < p_from or p_to - p_from > 731 then
    raise exception 'Período inválido (até 2 anos).' using errcode = 'P0001', hint = 'invalid_period';
  end if;
  v_today := app.org_today(p_org);

  with e as (
    select f.*, c.name as category_name
    from public.financial_entries f
    join public.financial_categories c on c.id = f.category_id
    where f.organization_id = p_org and f.status <> 'cancelled'
  ),
  paid as (select * from e where status = 'paid' and paid_at between p_from and p_to),
  months as (
    select generate_series(date_trunc('month', p_from)::date, date_trunc('month', p_to)::date, interval '1 month')::date as m
  )
  select jsonb_build_object(
    'from', p_from, 'to', p_to, 'today', v_today,
    'realized', jsonb_build_object(
      'income', coalesce((select sum(amount_cents) from paid where type = 'income'), 0),
      'expense', coalesce((select sum(amount_cents) from paid where type = 'expense'), 0)),
    'forecast', jsonb_build_object(
      'income', coalesce((select sum(amount_cents) from e where status = 'pending' and type = 'income' and due_date between p_from and p_to), 0),
      'expense', coalesce((select sum(amount_cents) from e where status = 'pending' and type = 'expense' and due_date between p_from and p_to), 0)),
    'overdue', jsonb_build_object(
      'income', coalesce((select sum(amount_cents) from e where status = 'pending' and type = 'income' and due_date < v_today), 0),
      'income_count', (select count(*) from e where status = 'pending' and type = 'income' and due_date < v_today),
      'expense', coalesce((select sum(amount_cents) from e where status = 'pending' and type = 'expense' and due_date < v_today), 0),
      'expense_count', (select count(*) from e where status = 'pending' and type = 'expense' and due_date < v_today)),
    'by_category', coalesce((
      select jsonb_agg(jsonb_build_object('type', type, 'name', category_name, 'total', total, 'count', n) order by type, total desc)
      from (select type, category_name, sum(amount_cents) as total, count(*) as n from paid group by type, category_name) x), '[]'::jsonb),
    'by_method', coalesce((
      select jsonb_agg(jsonb_build_object('method', method, 'total', total, 'count', n) order by total desc)
      from (select coalesce(payment_method, 'unknown') as method, sum(amount_cents) as total, count(*) as n
            from paid where type = 'income' group by 1) x), '[]'::jsonb),
    'by_professional', coalesce((
      select jsonb_agg(jsonb_build_object('professional_id', professional_id, 'name', name, 'total', total, 'count', n) order by total desc)
      from (select p.professional_id, coalesce(pr.display_name, 'Sem profissional') as name, sum(p.amount_cents) as total, count(*) as n
            from paid p left join public.professionals pr on pr.id = p.professional_id
            where p.type = 'income' group by 1, 2) x), '[]'::jsonb),
    'by_month', coalesce((
      select jsonb_agg(jsonb_build_object(
               'month', to_char(m.m, 'YYYY-MM'),
               'income', coalesce((select sum(amount_cents) from paid where type = 'income' and date_trunc('month', paid_at) = m.m), 0),
               'expense', coalesce((select sum(amount_cents) from paid where type = 'expense' and date_trunc('month', paid_at) = m.m), 0))
             order by m.m)
      from months m), '[]'::jsonb)
  ) into v_result;
  return v_result;
end;
$$;

-- RLS --------------------------------------------------------------------------------------------
alter table public.organization_features enable row level security;
alter table public.financial_categories enable row level security;
alter table public.financial_entries enable row level security;

revoke all on public.organization_features, public.financial_categories, public.financial_entries from anon, authenticated;

grant select on public.organization_features to authenticated;
create policy organization_features_select on public.organization_features for select to authenticated
  using (app.is_member(organization_id));

grant select on public.financial_categories to authenticated;
create policy financial_categories_select on public.financial_categories for select to authenticated
  using (app.is_member(organization_id));

grant select on public.financial_entries to authenticated;
create policy financial_entries_select on public.financial_entries for select to authenticated
  using (app.can_read_finance_entry(organization_id, type, professional_id)
         and (patient_id is null or app.can_see_patient(organization_id, patient_id)));

-- Privilégios ------------------------------------------------------------------------------------
grant execute on function app.can_read_finance_entry(uuid, public.fin_type, uuid), app.module_enabled(uuid, text) to authenticated;
grant execute on function
  public.set_organization_modules(uuid, text[]),
  public.create_organization(text, text, public.org_segment, jsonb, boolean, text, text, text[]),
  public.save_financial_entry(uuid, uuid, public.fin_type, uuid, text, bigint, date, date, text, uuid, uuid, text, text, integer),
  public.set_financial_entry_status(uuid, public.fin_status, date, text, boolean),
  public.receive_appointment(uuid, bigint, date, text),
  public.save_financial_category(uuid, uuid, public.fin_type, text, boolean),
  public.finance_report(uuid, date, date)
  to authenticated;
