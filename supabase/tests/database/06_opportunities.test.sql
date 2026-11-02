-- Módulo Oportunidades (migrações 0014 e 0015, docs/17).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Pessoas: m = gestora A, r = recepção A, p1/p2 = profissionais A, x = gestor B.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000006a1', 'm@opp.test',  now(), '{"full_name":"Gestora A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006a2', 'r@opp.test',  now(), '{"full_name":"Recepção A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006a3', 'p1@opp.test', now(), '{"full_name":"Prof Um"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006a4', 'p2@opp.test', now(), '{"full_name":"Prof Dois"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000006b1', 'x@opp.test',  now(), '{"full_name":"Gestor B"}', 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, segment, status, timezone) values
  ('60000000-0000-0000-0000-00000000000a', 'Opp A', 'opp-teste-a', 'medical_clinic', 'active', 'America/Sao_Paulo'),
  ('60000000-0000-0000-0000-00000000000b', 'Opp B', 'opp-teste-b', 'other', 'active', 'America/Sao_Paulo');
insert into public.memberships (organization_id, user_id, role, status) values
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a1', 'manager', 'active'),
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a2', 'reception', 'active'),
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a3', 'professional', 'active'),
  ('60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a4', 'professional', 'active'),
  ('60000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000006b1', 'manager', 'active');

insert into public.professionals (id, organization_id, user_id, display_name) values
  ('61000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a3', 'Prof Um'),
  ('61000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000006a4', 'Prof Dois'),
  ('61000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000006b1', 'Prof B');

-- Consulta (30 min, R$ 200) com o Prof Um; Avaliação (60 min, sem preço) com o Prof Dois.
insert into public.services (id, organization_id, name, duration_min, buffer_after_min, price_cents) values
  ('62000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-00000000000a', 'Consulta', 30, 0, 20000),
  ('62000000-0000-0000-0000-0000000000a3', '60000000-0000-0000-0000-00000000000a', 'Avaliação', 60, 0, null),
  ('62000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-00000000000b', 'Consulta B', 30, 0, 10000);
insert into public.professional_services (organization_id, professional_id, service_id) values
  ('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1'),
  ('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a2', '62000000-0000-0000-0000-0000000000a3'),
  ('60000000-0000-0000-0000-00000000000b', '61000000-0000-0000-0000-0000000000b1', '62000000-0000-0000-0000-0000000000b1');

insert into public.patients (id, organization_id, full_name, phone_e164, created_by) values
  ('63000000-0000-0000-0000-0000000000a1', '60000000-0000-0000-0000-00000000000a', 'Paciente Um',   '+5511900006001', '00000000-0000-0000-0000-0000000006a2'),
  ('63000000-0000-0000-0000-0000000000a2', '60000000-0000-0000-0000-00000000000a', 'Paciente Dois', '+5511900006002', '00000000-0000-0000-0000-0000000006a2'),
  ('63000000-0000-0000-0000-0000000000a3', '60000000-0000-0000-0000-00000000000a', 'Paciente Três', '+5511900006003', '00000000-0000-0000-0000-0000000006a2'),
  ('63000000-0000-0000-0000-0000000000b1', '60000000-0000-0000-0000-00000000000b', 'Paciente B',    '+5511900006004', '00000000-0000-0000-0000-0000000006b1');

-- Dia de referência: daqui a 3 dias (o único dia da semana com atendimento numa janela de 7).
create function public.t_day() returns date language sql stable set search_path = '' as $$
  select (now() at time zone 'America/Sao_Paulo')::date + 3
$$;
create function public.t_at(p text) returns timestamptz language sql stable set search_path = '' as $$
  select (public.t_day() + p::time) at time zone 'America/Sao_Paulo'
$$;
grant execute on function public.t_day(), public.t_at(text) to authenticated;

-- Prof Um: 08:00–12:00 (8 consultas de 30 min). Prof Dois: 14:00–16:00 (2 avaliações de 60 min).
insert into public.availability_rules (organization_id, professional_id, weekday, start_time, end_time) values
  ('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a1', extract(dow from public.t_day())::smallint, '08:00', '12:00'),
  ('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a2', extract(dow from public.t_day())::smallint, '14:00', '16:00');
insert into public.opportunity_settings (organization_id, slot_horizon_days)
values ('60000000-0000-0000-0000-00000000000a', 7);

set local role authenticated;

-- Horários livres e valores ---------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);

select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_force => true) -> 'summary' ->> 'free_slots')::int, 10,
  'horários livres = 8 consultas (Prof Um) + 2 avaliações (Prof Dois), dentro do horário de atendimento');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'at_risk_cents')::bigint, 160000::bigint,
  'gestora: valor em risco = 8 × R$ 200 (serviço sem preço não entra na soma)');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'at_risk_unpriced')::int, 1,
  'dia com serviço sem preço aparece como "valor indisponível", nunca como zero inventado');
select is((select x -> 'basis' ->> 'slot_minutes'
             from jsonb_array_elements(public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'items') i (x)
            where x ->> 'professional_id' = '61000000-0000-0000-0000-0000000000a1'), '30',
  'cálculo explicado: duração do serviço de referência');

select public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_force => true);
select is((select count(id)::int from public.opportunities where kind = 'free_slots'), 2,
  'atualizar de novo não duplica: uma oportunidade por profissional e dia');

-- Recepção não vê valores (O-2); coluna de valor não é legível direto.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select is(public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' -> 'at_risk_cents', 'null'::jsonb,
  'recepção não recebe o valor em risco');
select is((select count(*)::int from jsonb_array_elements(public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'items') i
            where i ->> 'value_cents' is not null), 0,
  'recepção não recebe valor em nenhum cartão');
select throws_ok($$ select value_cents from public.opportunities $$, '42501', null,
  'a coluna de valor não é legível diretamente (só pelo feed, que confere a permissão)');

-- Profissional vê só os próprios, com valor (finance.read_own).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a3","role":"authenticated"}', true);
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'free_slots')::int, 8,
  'profissional vê só os próprios horários livres');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'at_risk_cents')::bigint, 160000::bigint,
  'profissional vê o valor das próprias oportunidades');

-- Clínica B não acessa nada da A.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006b1","role":"authenticated"}', true);
select throws_ok($$ select public.opportunities_feed('60000000-0000-0000-0000-00000000000a') $$, '42501', null,
  'clínica B não lê o feed da clínica A');
select is((select count(id)::int from public.opportunities), 0, 'clínica B não enxerga nenhuma oportunidade da A');
select throws_ok(
  $$ select public.opportunity_detail((select id from public.opportunities limit 1)) $$, 'P0001', null,
  'clínica B não abre o detalhe de uma oportunidade da A');

-- Cancelamento e lista de espera -----------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.create_appointment('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a1',
       '62000000-0000-0000-0000-0000000000a1', '63000000-0000-0000-0000-0000000000a1', public.t_at('09:00')) $$,
  'recepção agenda o Paciente Um às 09:00');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'free_slots')::int, 9,
  'agendamento ocupa um horário (a mudança na agenda força a atualização)');
select lives_ok(
  $$ select public.set_appointment_status(
       (select id from public.appointments where patient_id = '63000000-0000-0000-0000-0000000000a1' and starts_at = public.t_at('09:00')),
       'cancelled', 'Paciente pediu') $$,
  'recepção cancela o agendamento');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'free_slots')::int, 10,
  'cancelamento libera o horário');
select is((select count(id)::int from public.opportunities where kind = 'cancelled_slot' and status = 'new'), 1,
  'horário liberado vira oportunidade própria');
select is((select count(id)::int from public.opportunities where kind = 'cancelled_appointment' and patient_id = '63000000-0000-0000-0000-0000000000a1'), 1,
  'cancelamento sem remarcação vira acompanhamento do paciente');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'at_risk_cents')::bigint, 160000::bigint,
  'sem dupla contagem: 7 horários livres + 1 liberado = 8 × R$ 200 (o acompanhamento do paciente não soma)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id, periods)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a2', '62000000-0000-0000-0000-0000000000a1', array['morning']) $$,
  'recepção põe o Paciente Dois na lista de espera (manhã)');
select lives_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id, periods)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a3', '62000000-0000-0000-0000-0000000000a1', array['evening']) $$,
  'Paciente Três prefere a noite');
select throws_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a2', '62000000-0000-0000-0000-0000000000a1') $$,
  '23505', null, 'o mesmo paciente não entra duas vezes para o mesmo serviço');
select throws_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id, professional_id)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1',
             '61000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'Este profissional não oferece este serviço.', 'lista de espera confere se o profissional oferece o serviço');

select is(jsonb_array_length(public.opportunity_detail((select id from public.opportunities where kind = 'cancelled_slot')) -> 'matches'), 1,
  'só quem combina com o horário liberado é sugerido (período da manhã)');
select is(public.opportunity_detail((select id from public.opportunities where kind = 'cancelled_slot')) -> 'matches' -> 0 ->> 'patient_id',
  '63000000-0000-0000-0000-0000000000a2', 'sugestão: Paciente Dois');

select lives_ok(
  $$ select public.book_from_waiting_list(
       (select id from public.waiting_list where patient_id = '63000000-0000-0000-0000-0000000000a2'),
       '61000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1', public.t_at('09:00'),
       (select id from public.opportunities where kind = 'cancelled_slot')) $$,
  'recepção agenda o Paciente Dois no horário liberado');
select is((select status::text from public.waiting_list where patient_id = '63000000-0000-0000-0000-0000000000a2'), 'booked',
  'pedido sai da lista como agendado, na mesma transação');
select is((select status::text from public.opportunities where kind = 'cancelled_slot'), 'resolved',
  'horário liberado resolvido por quem agendou');
select is((select count(*)::int from public.opportunity_actions a join public.opportunities o on o.id = a.opportunity_id
            where o.kind = 'cancelled_slot' and a.kind = 'booked' and a.actor_user_id = '00000000-0000-0000-0000-0000000006a2'), 1,
  'histórico registra quem agendou');

select throws_ok(
  $$ select public.book_from_waiting_list(
       (select id from public.waiting_list where patient_id = '63000000-0000-0000-0000-0000000000a3'),
       '61000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1', public.t_at('09:00')) $$,
  'P0001', 'Esse horário acabou de ser ocupado.', 'horário sobreposto não é confirmado (restrição no banco)');
select is((select status::text from public.waiting_list where patient_id = '63000000-0000-0000-0000-0000000000a3'), 'waiting',
  'pedido continua na lista quando o horário já foi ocupado');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a4","role":"authenticated"}', true);
select throws_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id, professional_id)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1',
             '61000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'profissional não mexe na lista de espera de outro profissional');

-- Retornos ----------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select lives_ok(
  $$ insert into public.follow_ups (organization_id, patient_id, professional_id, due_date)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a3', '61000000-0000-0000-0000-0000000000a1',
             (now() at time zone 'America/Sao_Paulo')::date - 1) $$,
  'recepção registra um retorno do Paciente Três (prazo vencido ontem)');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_category => 'pacientes') -> 'summary' ->> 'pacientes')::int, 2,
  'Pacientes: retorno pendente + acompanhamento do cancelamento do Paciente Um');
select is((select priority::int from public.opportunities where kind = 'follow_up_due'), 1,
  'medicina: retorno vencido tem prioridade alta');
select throws_ok(
  $$ update public.follow_ups set status = 'scheduled' where patient_id = '63000000-0000-0000-0000-0000000000a3' $$,
  'P0001', 'Mudança não permitida no retorno.', '"agendado" só pelo sistema, ligado a um agendamento');

select lives_ok(
  $$ select public.create_appointment('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a1',
       '62000000-0000-0000-0000-0000000000a1', '63000000-0000-0000-0000-0000000000a3', public.t_at('11:00')) $$,
  'recepção agenda o Paciente Três às 11:00');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'pacientes')::int, 1,
  'paciente com retorno já marcado não aparece como pendente');
select is((select status::text from public.follow_ups where patient_id = '63000000-0000-0000-0000-0000000000a3'), 'scheduled',
  'retorno passa a "agendado", ligado ao agendamento');
select is((select status::text from public.opportunities where kind = 'follow_up_due'), 'resolved', 'oportunidade do retorno resolvida');

select lives_ok(
  $$ select public.set_appointment_status(
       (select id from public.appointments where patient_id = '63000000-0000-0000-0000-0000000000a3' and starts_at = public.t_at('11:00')),
       'cancelled') $$,
  'o agendamento do retorno é cancelado');
select public.opportunities_feed('60000000-0000-0000-0000-00000000000a');
select is((select status::text from public.follow_ups where patient_id = '63000000-0000-0000-0000-0000000000a3'), 'pending',
  'retorno volta a pendente quando o agendamento é cancelado');
select is((select status::text from public.opportunities where kind = 'follow_up_due'), 'new',
  'a oportunidade do retorno é reaberta (a regra justifica)');
select is((select count(*)::int from public.opportunity_actions a join public.opportunities o on o.id = a.opportunity_id
            where o.kind = 'follow_up_due' and a.kind = 'reopened' and a.actor_user_id is null), 1,
  'reabertura registrada como ação do sistema');

-- Fluxo de trabalho -----------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a4","role":"authenticated"}', true);
select throws_ok(
  $$ select public.opportunity_log_contact((select id from public.opportunities where kind = 'follow_up_due'), 'no_answer') $$,
  '42501', null, 'profissional não trabalha oportunidade de outro profissional');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.opportunity_log_contact((select id from public.opportunities where kind = 'follow_up_due'), 'no_answer', 'Ligar à tarde') $$,
  'recepção registra uma tentativa de contato');
select is((select status::text from public.opportunities where kind = 'follow_up_due'), 'in_progress', 'contato põe a oportunidade em andamento');
select throws_ok(
  $$ select public.opportunity_log_contact((select id from public.opportunities where kind = 'follow_up_due'), 'whatsapp_auto') $$,
  'P0001', 'Escolha o resultado do contato.', 'resultado de contato fora da lista é recusado');
select throws_ok(
  $$ select public.opportunity_assign((select id from public.opportunities where kind = 'follow_up_due'), '00000000-0000-0000-0000-0000000006b1') $$,
  'P0001', 'A pessoa precisa fazer parte da equipe da clínica.', 'responsável de outra clínica é recusado');
select lives_ok(
  $$ select public.opportunity_assign((select id from public.opportunities where kind = 'follow_up_due'), '00000000-0000-0000-0000-0000000006a1') $$,
  'recepção atribui à gestora');
select throws_ok(
  $$ select public.opportunity_set_status((select id from public.opportunities where kind = 'follow_up_due'), 'dismissed') $$,
  'P0001', 'Informe o motivo do descarte.', 'descartar exige motivo');
select lives_ok(
  $$ select public.opportunity_set_status((select id from public.opportunities where kind = 'follow_up_due'), 'dismissed', 'Paciente mudou de cidade') $$,
  'descarte com motivo');
select throws_ok(
  $$ select public.opportunity_set_status((select id from public.opportunities where kind = 'follow_up_due'), 'in_progress') $$,
  'P0001', 'Mudança de status não permitida.', 'descartada não é reaberta à mão');
select public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_force => true);
select is((select status::text from public.opportunities where kind = 'follow_up_due'), 'dismissed',
  'descartada pela equipe continua descartada mesmo com o retorno pendente');
select is((select count(*)::int from public.opportunity_actions a join public.opportunities o on o.id = a.opportunity_id
            where o.kind = 'follow_up_due' and a.actor_user_id = '00000000-0000-0000-0000-0000000006a2'), 3,
  'histórico: contato, atribuição e descarte, cada um com quem fez');
select is((select count(*)::int from jsonb_array_elements(
            public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_view => 'closed') -> 'items') i
            where i ->> 'status' = 'dismissed'), 1,
  'filtro "Resolvidas" mostra a descartada');
select is((select count(*)::int from jsonb_array_elements(
            public.opportunities_feed('60000000-0000-0000-0000-00000000000a', p_category => 'agenda') -> 'items') i
            where i ->> 'category' <> 'agenda'), 0,
  'filtro "Agenda" só traz itens de agenda');

-- Orçamentos -----------------------------------------------------------------------------------------
select lives_ok(
  $$ select public.save_proposal('60000000-0000-0000-0000-00000000000a', null, '63000000-0000-0000-0000-0000000000a2', null,
       'Plano de tratamento', null,
       '[{"service_id":"62000000-0000-0000-0000-0000000000a1","quantity":1,"unit_price_cents":20000},
         {"description":"Material","quantity":2,"unit_price_cents":5000}]'::jsonb) $$,
  'recepção cria um orçamento');
select is((select total_cents from public.proposals where patient_id = '63000000-0000-0000-0000-0000000000a2'), 30000::bigint,
  'total calculado pelo banco (1 × R$ 200 + 2 × R$ 50)');
select throws_ok(
  $$ select public.save_proposal('60000000-0000-0000-0000-00000000000a', null, '63000000-0000-0000-0000-0000000000a2', null,
       'Outro', null, '[{"service_id":"62000000-0000-0000-0000-0000000000b1","quantity":1,"unit_price_cents":100}]'::jsonb) $$,
  'P0001', 'Serviço de outra clínica.', 'orçamento não usa serviço de outra clínica');

reset role;
update public.proposals set last_activity_at = now() - interval '10 days' where patient_id = '63000000-0000-0000-0000-0000000000a2';
set local role authenticated;

select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'financeiro')::int, 1,
  'orçamento sem atualização há mais de 7 dias aparece em Financeiro');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'proposals_cents')::bigint, 30000::bigint,
  'recepção vê o valor do orçamento (ela lê orçamentos), separado do valor em risco');
select is(public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' -> 'at_risk_cents', 'null'::jsonb,
  'e o orçamento não entra no valor em risco');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a4","role":"authenticated"}', true);
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'financeiro')::int, 0,
  'profissional sem vínculo com o orçamento não o vê');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.set_proposal_status((select id from public.proposals where patient_id = '63000000-0000-0000-0000-0000000000a2'), 'accepted') $$,
  'orçamento aceito');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'financeiro')::int, 0,
  'orçamento concluído deixa de aparecer como aberto');
select throws_ok(
  $$ select public.set_proposal_status((select id from public.proposals where patient_id = '63000000-0000-0000-0000-0000000000a2'), 'declined') $$,
  'P0001', 'Mudança de status não permitida.', 'orçamento fechado não muda mais');

-- Bloqueios -------------------------------------------------------------------------------------------
select lives_ok(
  $$ insert into public.waiting_list (organization_id, patient_id, service_id, professional_id)
     values ('60000000-0000-0000-0000-00000000000a', '63000000-0000-0000-0000-0000000000a1', '62000000-0000-0000-0000-0000000000a1',
             '61000000-0000-0000-0000-0000000000a1') $$,
  'Paciente Um entra na lista de espera do Prof Um (qualquer horário)');
select public.opportunities_feed('60000000-0000-0000-0000-00000000000a');
select is(jsonb_array_length(public.opportunity_detail(
            (select id from public.opportunities where kind = 'free_slots' and professional_id = '61000000-0000-0000-0000-0000000000a1')) -> 'matches'), 1,
  'Paciente Um é sugerido para os horários livres do Prof Um');
select lives_ok(
  $$ insert into public.schedule_blocks (organization_id, professional_id, kind, starts_at, ends_at)
     values ('60000000-0000-0000-0000-00000000000a', '61000000-0000-0000-0000-0000000000a1', 'vacation',
             public.t_at('00:00'), public.t_at('23:00')) $$,
  'recepção registra férias do Prof Um nesse dia');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'free_slots')::int, 2,
  'bloqueio tira os horários do Prof Um (sobram as 2 avaliações do Prof Dois)');
select is(jsonb_array_length(public.opportunity_detail(
            (select id from public.opportunities where kind = 'free_slots' and professional_id = '61000000-0000-0000-0000-0000000000a1')) -> 'matches'), 0,
  'bloqueio impede sugestão da lista de espera');

-- Configurações -----------------------------------------------------------------------------------------
select throws_ok(
  $$ select public.save_opportunity_settings('60000000-0000-0000-0000-00000000000a', array['free_slots']::public.opportunity_kind[],
       7, 7, 14, '{}'::jsonb, '{}'::uuid[], false, true) $$,
  '42501', null, 'recepção não altera as configurações');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.save_opportunity_settings('60000000-0000-0000-0000-00000000000a', null, 7, 7, 14, '{}'::jsonb,
       array['61000000-0000-0000-0000-0000000000b1']::uuid[], false, true) $$,
  'P0001', 'Profissional de outra clínica.', 'não exclui profissional de outra clínica');
select throws_ok(
  $$ select public.save_opportunity_settings('60000000-0000-0000-0000-00000000000a', null, 7, 7, 14, '{"free_slots": 9}'::jsonb,
       '{}'::uuid[], false, true) $$,
  '23514', null, 'prioridade fora de 1–3 é recusada');
select lives_ok(
  $$ select public.save_opportunity_settings('60000000-0000-0000-0000-00000000000a',
       array['free_slots', 'cancelled_slot', 'follow_up_due', 'proposal_stale', 'no_show', 'cancelled_appointment']::public.opportunity_kind[],
       7, 7, 14, '{}'::jsonb, array['61000000-0000-0000-0000-0000000000a2']::uuid[], true, true) $$,
  'gestora exclui o Prof Dois e libera valores para a recepção');
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') -> 'summary' ->> 'free_slots')::int, 0,
  'profissional excluído some das oportunidades');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000006a2","role":"authenticated"}', true);
select is((public.opportunities_feed('60000000-0000-0000-0000-00000000000a') ->> 'values_visible')::boolean, true,
  'com a opção ligada, a recepção passa a ver valores');

select * from finish();
rollback;
