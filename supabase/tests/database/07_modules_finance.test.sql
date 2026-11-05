-- Módulos por clínica e Financeiro (migração 0016, docs/19).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Pessoas: g = gestora A, r = recepção A, p = profissional A, x = gestor B.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000007a1', 'g@fin.test', now(), '{"full_name":"Gestora A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007a2', 'r@fin.test', now(), '{"full_name":"Recepção A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007a3', 'p@fin.test', now(), '{"full_name":"Prof A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000007b1', 'x@fin.test', now(), '{"full_name":"Gestor B"}', 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, segment, status, timezone) values
  ('70000000-0000-0000-0000-00000000000a', 'Fin A', 'fin-teste-a', 'other', 'active', 'America/Sao_Paulo'),
  ('70000000-0000-0000-0000-00000000000b', 'Fin B', 'fin-teste-b', 'other', 'active', 'America/Sao_Paulo');
insert into public.memberships (organization_id, user_id, role, status) values
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a1', 'manager', 'active'),
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a2', 'reception', 'active'),
  ('70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a3', 'professional', 'active'),
  ('70000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000007b1', 'manager', 'active');
insert into public.organization_features (organization_id, feature, enabled)
select o, f, true from unnest(array['70000000-0000-0000-0000-00000000000a', '70000000-0000-0000-0000-00000000000b']::uuid[]) o,
       unnest(array['schedule', 'opportunities', 'finance']) f;
select app.seed_finance_categories('70000000-0000-0000-0000-00000000000a');
select app.seed_finance_categories('70000000-0000-0000-0000-00000000000b');

insert into public.professionals (id, organization_id, user_id, display_name) values
  ('71000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000007a3', 'Prof A');
insert into public.services (id, organization_id, name, duration_min, price_cents) values
  ('72000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', 'Consulta', 30, 15000);
insert into public.professional_services (organization_id, professional_id, service_id) values
  ('70000000-0000-0000-0000-00000000000a', '71000000-0000-0000-0000-0000000000a1', '72000000-0000-0000-0000-0000000000a1');
insert into public.patients (id, organization_id, full_name, phone_e164, created_by) values
  ('73000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', 'Paciente Um', '+5511900007001', '00000000-0000-0000-0000-0000000007a2');
-- Atendimento concluído ontem (para "Registrar recebimento").
insert into public.appointments (id, organization_id, professional_id, service_id, patient_id, starts_at, ends_at, status) values
  ('74000000-0000-0000-0000-0000000000a1', '70000000-0000-0000-0000-00000000000a', '71000000-0000-0000-0000-0000000000a1',
   '72000000-0000-0000-0000-0000000000a1', '73000000-0000-0000-0000-0000000000a1', now() - interval '1 day', now() - interval '1 day' + interval '30 minutes', 'completed');

-- Ids de categoria e "hoje" no fuso da clínica (funções só desta transação).
create function public.t_cat(p_org uuid, p_name text) returns uuid language sql stable set search_path = '' as $$
  select id from public.financial_categories where organization_id = p_org and name = p_name
$$;
create function public.t_today() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date
$$;
grant execute on function public.t_cat(uuid, text), public.t_today() to authenticated;

set local role authenticated;

-- Módulos no onboarding ----------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_organization('Só Financeiro', 'so-financeiro-teste', 'other', '{}', true, null, 'America/Sao_Paulo', array['finance']) $$,
  'cria clínica só com o Financeiro');
select is(
  (select array_agg(f.feature order by f.feature) from public.organization_features f
     join public.organizations o on o.id = f.organization_id where o.slug = 'so-financeiro-teste' and f.enabled),
  array['finance'], 'só o Financeiro fica ligado');
select is(
  (select count(*)::int from public.professionals p join public.organizations o on o.id = p.organization_id where o.slug = 'so-financeiro-teste'),
  0, 'sem Agenda não cria profissional, mesmo marcando que atende');
select ok(
  (select count(*) from public.financial_categories c join public.organizations o on o.id = c.organization_id where o.slug = 'so-financeiro-teste') > 0,
  'categorias iniciais criadas com o Financeiro');
select throws_ok(
  $$ select public.create_organization('Só Opp', 'so-opp-teste', 'other', '{}', false, null, 'America/Sao_Paulo', array['opportunities']) $$,
  'P0001', 'Oportunidades usa a Agenda: ligue a Agenda também.', 'Oportunidades sem Agenda é recusado');
select throws_ok(
  $$ select public.create_organization('Nada', 'nada-teste', 'other', '{}', false, null, 'America/Sao_Paulo', '{}'::text[]) $$,
  'P0001', 'Escolha ao menos um módulo.', 'precisa de ao menos um módulo');
select lives_ok(
  $$ select public.create_organization('Padrão', 'padrao-teste', 'other') $$,
  'chamada antiga (sem módulos) continua funcionando');
select is(
  (select count(*)::int from public.organization_features f join public.organizations o on o.id = f.organization_id
    where o.slug = 'padrao-teste' and f.enabled), 3, 'sem escolher, todos os módulos ficam ligados (como antes)');

-- Lançamentos (gestora) ----------------------------------------------------------------------------
select lives_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'expense',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Aluguel'), 'Aluguel da sala', 250000, public.t_today(), public.t_today(), 'transfer') $$,
  'gestora lança despesa paga');
select lives_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Procedimentos'), 'Tratamento', 10000, public.t_today(),
       null, null, '73000000-0000-0000-0000-0000000000a1', '71000000-0000-0000-0000-0000000000a1', null, 'installments', 3) $$,
  'receita parcelada em 3 vezes');
select is(
  (select array_agg(amount_cents order by installment) from public.financial_entries where description = 'Tratamento'),
  array[3334, 3333, 3333]::bigint[], 'parcelas somam o total; o resto dos centavos vai na primeira');
select is(
  (select max(due_date) from public.financial_entries where description = 'Tratamento'),
  (public.t_today() + interval '2 months')::date, 'parcelas vencem mês a mês');
select lives_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'expense',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Contas de consumo'), 'Internet', 12000, public.t_today(),
       null, null, null, null, null, 'monthly', 3) $$,
  'despesa repetida todo mês');
select is((select count(*)::int from public.financial_entries where description = 'Internet' and amount_cents = 12000), 3,
  'repetição mensal cria um lançamento por mês, com o mesmo valor');
select throws_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Aluguel'), 'Errado', 100, public.t_today()) $$,
  'P0001', 'Escolha uma categoria válida.', 'categoria de despesa não serve para receita');
select lives_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Outras receitas'), 'Receita atrasada', 7000, public.t_today() - 5) $$,
  'receita pendente vencida há 5 dias');

-- Pagar e cancelar ----------------------------------------------------------------------------------
select is(
  public.set_financial_entry_status((select id from public.financial_entries where description = 'Tratamento' and installment = 1),
                                    'paid', public.t_today(), 'pix'), 1, 'primeira parcela paga');
select is((select status::text || '/' || payment_method from public.financial_entries where description = 'Tratamento' and installment = 1),
  'paid/pix', 'pagamento guarda data e forma');
select is(
  public.set_financial_entry_status((select id from public.financial_entries where description = 'Tratamento' and installment = 1),
                                    'cancelled', null, null, true), 3, 'cancelar esta e as próximas parcelas');
select is((select count(*)::int from public.financial_entries where description = 'Tratamento' and status = 'cancelled'), 3,
  'cancelado fica registrado (não é apagado)');
select throws_ok(
  $$ select public.set_financial_entry_status((select id from public.financial_entries where description = 'Tratamento' and installment = 1), 'paid') $$,
  'P0001', 'Mudança de status não permitida.', 'cancelado não volta a pago');

-- Recepção: só receitas, sem despesas nem relatório ---------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Atendimentos'), 'Consulta avulsa', 20000, public.t_today()) $$,
  'recepção lança receita');
select throws_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'expense',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Aluguel'), 'Tentativa', 100, public.t_today()) $$,
  '42501', null, 'recepção não lança despesa');
select is((select count(*)::int from public.financial_entries where type = 'expense'), 0, 'recepção não vê despesas');
select ok((select count(*) from public.financial_entries where type = 'income') > 0, 'recepção vê receitas');
select throws_ok($$ select public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) $$,
  '42501', null, 'recepção não vê o relatório');

select lives_ok(
  $$ select public.receive_appointment('74000000-0000-0000-0000-0000000000a1', 15000, null, 'pix') $$,
  'recepção registra o recebimento do atendimento');
select is((select professional_id from public.financial_entries where appointment_id = '74000000-0000-0000-0000-0000000000a1'),
  '71000000-0000-0000-0000-0000000000a1'::uuid, 'recebimento ligado ao profissional e ao atendimento');
select throws_ok($$ select public.receive_appointment('74000000-0000-0000-0000-0000000000a1', 15000, null, 'pix') $$,
  'P0001', 'Este atendimento já tem um recebimento registrado.', 'o mesmo atendimento não é recebido duas vezes');
select throws_ok($$ select public.set_organization_modules('70000000-0000-0000-0000-00000000000a', array['schedule']) $$,
  '42501', null, 'recepção não muda os módulos');

-- Profissional: só receitas dos próprios atendimentos --------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a3","role":"authenticated"}', true);
select is((select count(*)::int from public.financial_entries where professional_id is distinct from '71000000-0000-0000-0000-0000000000a1'), 0,
  'profissional não vê lançamentos de outros nem despesas');
select ok((select count(*) from public.financial_entries where appointment_id = '74000000-0000-0000-0000-0000000000a1') = 1,
  'profissional vê o recebimento do próprio atendimento');

-- Clínica B não vê nada da A ---------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007b1","role":"authenticated"}', true);
select is((select count(*)::int from public.financial_entries where organization_id = '70000000-0000-0000-0000-00000000000a'), 0,
  'clínica B não vê lançamentos da A');
select throws_ok($$ select public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) $$,
  '42501', null, 'clínica B não vê o relatório da A');
select throws_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000b', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Atendimentos'), 'Cruzado', 100, public.t_today()) $$,
  'P0001', 'Escolha uma categoria válida.', 'não usa categoria de outra clínica');

-- Relatório (gestora) ------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000007a1","role":"authenticated"}', true);
select is(
  (public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) -> 'realized' ->> 'income')::bigint,
  15000::bigint, 'realizado: só o que foi pago no período (cancelado não conta)');
select is(
  (public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) -> 'realized' ->> 'expense')::bigint,
  250000::bigint, 'despesas pagas no período');
select is(
  (public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) -> 'overdue' ->> 'income')::bigint,
  7000::bigint, 'em atraso: receita pendente vencida');
select is(
  (public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today() - 30, public.t_today()) -> 'by_method' -> 0 ->> 'method'),
  'pix', 'quebra por forma de pagamento');
select throws_ok($$ select public.finance_report('70000000-0000-0000-0000-00000000000a', public.t_today(), public.t_today() - 1) $$,
  'P0001', 'Período inválido (até 2 anos).', 'período invertido é recusado');

-- Categorias e módulo desligado ----------------------------------------------------------------------
select lives_ok(
  $$ select public.save_financial_category('70000000-0000-0000-0000-00000000000a', null, 'expense', 'Manutenção') $$,
  'gestora cria categoria');
select throws_ok(
  $$ select public.save_financial_category('70000000-0000-0000-0000-00000000000a', null, 'expense', 'manutenção') $$,
  'P0001', 'Já existe uma categoria com esse nome.', 'nome repetido (sem diferenciar maiúsculas) é recusado');
select throws_ok($$ select public.set_organization_modules('70000000-0000-0000-0000-00000000000a', array['opportunities']) $$,
  'P0001', 'Oportunidades usa a Agenda: ligue a Agenda também.', 'gestão também não liga Oportunidades sem Agenda');
select lives_ok($$ select public.set_organization_modules('70000000-0000-0000-0000-00000000000a', array['schedule', 'opportunities']) $$,
  'gestora desliga o Financeiro');
select throws_ok(
  $$ select public.save_financial_entry('70000000-0000-0000-0000-00000000000a', null, 'income',
       public.t_cat('70000000-0000-0000-0000-00000000000a', 'Atendimentos'), 'Depois', 100, public.t_today()) $$,
  'P0001', 'O módulo Financeiro está desligado nesta clínica.', 'com o módulo desligado, nada é lançado');
select ok((select count(*) from public.financial_entries) > 0, 'desligar o módulo não apaga os lançamentos');

select * from finish();
rollback;
