-- Fases 4–5: serviços, pacientes, horários e agenda (migrações 0011 e 0012).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- Pessoas: m = gestora A, r = recepção A, p1/p2 = profissionais A, x = gestor B.
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000004a1', 'm@agenda.test',  now(), '{"full_name":"Gestora A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004a2', 'r@agenda.test',  now(), '{"full_name":"Recepção A"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004a3', 'p1@agenda.test', now(), '{"full_name":"Prof Um"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004a4', 'p2@agenda.test', now(), '{"full_name":"Prof Dois"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000004b1', 'x@agenda.test',  now(), '{"full_name":"Gestor B"}', 'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, segment, status, timezone) values
  ('40000000-0000-0000-0000-00000000000a', 'Agenda A', 'agenda-teste-a', 'other', 'active', 'America/Sao_Paulo'),
  ('40000000-0000-0000-0000-00000000000b', 'Agenda B', 'agenda-teste-b', 'other', 'active', 'America/Sao_Paulo');
insert into public.memberships (organization_id, user_id, role, status) values
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a1', 'manager', 'active'),
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a2', 'reception', 'active'),
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a3', 'professional', 'active'),
  ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a4', 'professional', 'active'),
  ('40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000004b1', 'manager', 'active');

insert into public.professionals (id, organization_id, user_id, display_name) values
  ('41000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a3', 'Prof Um'),
  ('41000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004a4', 'Prof Dois'),
  ('41000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000004b1', 'Prof B');

select throws_ok(
  $$ insert into public.professionals (organization_id, user_id, display_name)
     values ('40000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000004b1', 'Intruso') $$,
  'P0001', 'A pessoa precisa fazer parte da equipe da clínica.',
  'profissional só pode ser ligado a alguém da equipe da própria clínica');

insert into public.services (id, organization_id, name, duration_min, buffer_after_min) values
  ('42000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-00000000000a', 'Consulta A', 30, 15),
  ('42000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-00000000000b', 'Consulta B', 30, 0);
insert into public.professional_services (organization_id, professional_id, service_id) values
  ('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1', '42000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a2', '42000000-0000-0000-0000-0000000000a1'),
  ('40000000-0000-0000-0000-00000000000b', '41000000-0000-0000-0000-0000000000b1', '42000000-0000-0000-0000-0000000000b1');

select throws_ok(
  $$ insert into public.professional_services (organization_id, professional_id, service_id)
     values ('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1', '42000000-0000-0000-0000-0000000000b1') $$,
  '23503', null, 'serviço de outra clínica não pode ser ligado ao profissional (chave composta)');

-- Atendem todos os dias, 08:00–18:00 (horário de São Paulo).
insert into public.availability_rules (organization_id, professional_id, weekday, start_time, end_time)
select '40000000-0000-0000-0000-00000000000a', p, d, '08:00', '18:00'
from unnest(array['41000000-0000-0000-0000-0000000000a1', '41000000-0000-0000-0000-0000000000a2']::uuid[]) p,
     generate_series(0, 6) d;

-- Pacientes: pa1/pa2/pa3 da clínica A (cadastrados pela recepção), pb da clínica B.
insert into public.patients (id, organization_id, full_name, phone_e164, created_by) values
  ('43000000-0000-0000-0000-0000000000a1', '40000000-0000-0000-0000-00000000000a', 'Paciente Um',   '+5511900002001', '00000000-0000-0000-0000-0000000004a2'),
  ('43000000-0000-0000-0000-0000000000a2', '40000000-0000-0000-0000-00000000000a', 'Paciente Dois', '+5511900002002', '00000000-0000-0000-0000-0000000004a2'),
  ('43000000-0000-0000-0000-0000000000a3', '40000000-0000-0000-0000-00000000000a', 'Paciente Três', '+5511900002003', '00000000-0000-0000-0000-0000000004a2'),
  ('43000000-0000-0000-0000-0000000000b1', '40000000-0000-0000-0000-00000000000b', 'Paciente B',    '+5511900002004', '00000000-0000-0000-0000-0000000004b1');

-- Horário de referência: daqui a 7 dias, 10:00 em São Paulo (função só desta transação).
create function public.t_ref() returns timestamptz language sql stable set search_path = '' as $$
  select ((current_date + 7) + time '10:00') at time zone 'America/Sao_Paulo'
$$;
grant execute on function public.t_ref() to authenticated;

set local role authenticated;

-- Recepção A ------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a2","role":"authenticated"}', true);

select lives_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', public.t_ref()) $$,
  'recepção agenda dentro do horário');
select is(
  (select ends_at - starts_at from public.appointments where professional_id = '41000000-0000-0000-0000-0000000000a1'),
  interval '45 minutes', 'fim do atendimento inclui o intervalo do serviço (30 + 15 min)');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a2', (public.t_ref() + interval '30 minutes')) $$,
  'P0001', 'Esse horário acabou de ser ocupado.', 'sobreposição com o mesmo profissional é recusada pelo banco');
select lives_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a2', (public.t_ref() + interval '45 minutes')) $$,
  'encostar no fim do anterior não é conflito');
select lives_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a2',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a3', public.t_ref()) $$,
  'outro profissional no mesmo horário: permitido');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', (public.t_ref() - interval '3 hours')) $$,
  'P0001', 'Fora do horário de atendimento ou em um bloqueio.', 'fora do horário de atendimento é recusado');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', now() - interval '1 day') $$,
  'P0001', 'Não é possível agendar no passado.', 'passado é recusado');

-- Bloqueio da clínica inteira (feriado) impede agendar.
insert into public.schedule_blocks (organization_id, kind, starts_at, ends_at, reason)
select '40000000-0000-0000-0000-00000000000a', 'holiday', public.t_ref() + interval '1 day' - interval '2 hours', public.t_ref() + interval '1 day' + interval '8 hours', 'Feriado';
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', (public.t_ref() + interval '1 day')) $$,
  'P0001', 'Fora do horário de atendimento ou em um bloqueio.', 'bloqueio impede agendar');

-- Nada cruza de clínica.
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000b1', '43000000-0000-0000-0000-0000000000a1', (public.t_ref() + interval '2 hours')) $$,
  'P0001', 'Este profissional não oferece este serviço.', 'serviço de outra clínica é recusado');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000b1', (public.t_ref() + interval '2 hours')) $$,
  'P0001', 'Paciente não encontrado.', 'paciente de outra clínica é recusado');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000b', '41000000-0000-0000-0000-0000000000b1',
       '42000000-0000-0000-0000-0000000000b1', '43000000-0000-0000-0000-0000000000b1', public.t_ref()) $$,
  '42501', null, 'recepção de A não agenda na clínica B');
select throws_ok(
  $$ insert into public.appointments (organization_id, professional_id, service_id, patient_id, starts_at, ends_at, status)
     select '40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1', '42000000-0000-0000-0000-0000000000a1',
            '43000000-0000-0000-0000-0000000000a1', public.t_ref() + interval '3 hours', public.t_ref() + interval '4 hours', 'confirmed' $$,
  '42501', null, 'escrita direta na tabela de agendamentos é negada (só pelas funções)');
select throws_ok(
  $$ insert into public.patients (organization_id, full_name) values ('40000000-0000-0000-0000-00000000000b', 'Intruso') $$,
  '42501', null, 'recepção de A não cadastra paciente na clínica B');
select is((select count(*)::int from public.patients where organization_id = '40000000-0000-0000-0000-00000000000a'), 3,
  'recepção vê todos os pacientes da clínica');
select throws_ok(
  $$ select public.delete_patient('43000000-0000-0000-0000-0000000000a2') $$,
  '42501', null, 'recepção não exclui paciente');

-- Status.
select throws_ok(
  $$ select public.set_appointment_status((select id from public.appointments where patient_id = '43000000-0000-0000-0000-0000000000a1' limit 1), 'completed') $$,
  'P0001', 'Só depois do horário do atendimento.', 'não conclui atendimento futuro');
select lives_ok(
  $$ select public.set_appointment_status((select id from public.appointments where patient_id = '43000000-0000-0000-0000-0000000000a1' limit 1), 'cancelled', 'Paciente desmarcou') $$,
  'cancela');
select throws_ok(
  $$ select public.set_appointment_status((select id from public.appointments where patient_id = '43000000-0000-0000-0000-0000000000a1' limit 1), 'confirmed') $$,
  'P0001', 'Mudança de status não permitida.', 'cancelado não volta a confirmado');
select is((select count(*)::int from public.appointment_events e join public.appointments a on a.id = e.appointment_id
           where a.patient_id = '43000000-0000-0000-0000-0000000000a1'), 2, 'histórico registra criação e cancelamento');
select lives_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a1',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', public.t_ref()) $$,
  'horário cancelado volta a ficar livre');
select throws_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where patient_id = '43000000-0000-0000-0000-0000000000a2'),
       (public.t_ref() + interval '15 minutes')) $$,
  'P0001', 'Esse horário já está ocupado.', 'remarcar para cima de outro atendimento é recusado');
select lives_ok(
  $$ select public.reschedule_appointment((select id from public.appointments where patient_id = '43000000-0000-0000-0000-0000000000a2'),
       (public.t_ref() + interval '4 hours')) $$,
  'remarca para horário livre');

-- Profissional Um ---------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a3","role":"authenticated"}', true);

select is((select count(*)::int from public.appointments where professional_id = '41000000-0000-0000-0000-0000000000a2'), 0,
  'profissional não lê os atendimentos de outro profissional');
select ok((select count(*) from public.schedule_busy('40000000-0000-0000-0000-00000000000a', now(), now() + interval '30 days')
           where professional_id = '41000000-0000-0000-0000-0000000000a2') = 1,
  'mas vê a ocupação do outro (sem paciente nem serviço)');
select ok(exists (select 1 from public.patients where id = '43000000-0000-0000-0000-0000000000a1'),
  'profissional vê o paciente que atende');
select ok(not exists (select 1 from public.patients where id = '43000000-0000-0000-0000-0000000000a3'),
  'profissional não vê paciente só de outro profissional');
select throws_ok(
  $$ select public.create_appointment('40000000-0000-0000-0000-00000000000a', '41000000-0000-0000-0000-0000000000a2',
       '42000000-0000-0000-0000-0000000000a1', '43000000-0000-0000-0000-0000000000a1', (public.t_ref() + interval '5 hours')) $$,
  '42501', null, 'profissional não agenda na agenda de outro');
select lives_ok(
  $$ insert into public.patients (organization_id, full_name, phone_e164)
     values ('40000000-0000-0000-0000-00000000000a', 'Paciente do Prof Um', '+5511900002009') $$,
  'profissional cadastra paciente');
select ok(exists (select 1 from public.patients where full_name = 'Paciente do Prof Um'),
  'e vê o paciente que cadastrou');
select lives_ok(
  $$ select public.set_weekly_availability('41000000-0000-0000-0000-0000000000a1',
       '[{"weekday":1,"start":"08:00","end":"12:00"},{"weekday":1,"start":"13:00","end":"18:00"}]') $$,
  'profissional ajusta o próprio horário');
select throws_ok(
  $$ select public.set_weekly_availability('41000000-0000-0000-0000-0000000000a2', '[]') $$,
  '42501', null, 'profissional não mexe no horário de outro');
select throws_ok(
  $$ select public.set_weekly_availability('41000000-0000-0000-0000-0000000000a1',
       '[{"weekday":2,"start":"08:00","end":"12:00"},{"weekday":2,"start":"11:00","end":"14:00"}]') $$,
  'P0001', 'Há faixas de horário sobrepostas no mesmo dia.', 'faixas sobrepostas são recusadas');
select throws_ok(
  $$ select public.set_weekly_availability('41000000-0000-0000-0000-0000000000a1', '[{"weekday":2,"start":"12:00","end":"08:00"}]') $$,
  'P0001', 'Horários inválidos.', 'faixa com fim antes do início é recusada');

-- Gestora A ------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004a1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.delete_patient('43000000-0000-0000-0000-0000000000a1') $$,
  'P0001', 'O paciente tem agendamentos futuros. Cancele-os antes.', 'não exclui paciente com agendamento futuro');
select lives_ok($$ select public.delete_patient((select id from public.patients where full_name = 'Paciente do Prof Um')) $$,
  'gestora exclui paciente sem agendamentos futuros');
select ok(not exists (select 1 from public.patients where full_name = 'Paciente do Prof Um'),
  'paciente excluído some das listas (exclusão lógica)');

-- Gestor B não enxerga nada de A ---------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000004b1","role":"authenticated"}', true);
select is((select count(*)::int from public.appointments where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê agendamentos de A');
select is((select count(*)::int from public.patients where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê pacientes de A');
select is((select count(*)::int from public.services where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê serviços de A');
select is((select count(*)::int from public.availability_rules where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê horários de A');
select is((select count(*)::int from public.schedule_blocks where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê bloqueios de A');
select is((select count(*)::int from public.appointment_events where organization_id = '40000000-0000-0000-0000-00000000000a'), 0, 'B não vê o histórico de A');
select throws_ok(
  $$ select * from public.schedule_busy('40000000-0000-0000-0000-00000000000a', now(), now() + interval '30 days') $$,
  '42501', null, 'B não consulta a ocupação de A');
select is((select count(*)::int from public.services where id = '42000000-0000-0000-0000-0000000000a1'), 0, 'nem por id');

-- Auditoria de paciente: só os nomes dos campos, nunca os valores --------------------------------
reset role;
select ok(
  not exists (select 1 from public.audit_logs where entity in ('patients', 'appointments') and changes::text like '%Paciente%'),
  'auditoria de pacientes e agendamentos não guarda nomes nem dados pessoais');
select ok(
  exists (select 1 from public.audit_logs where action = 'patients.update' and changes -> 'fields' ? 'deleted_at'),
  'exclusão do paciente fica registrada na auditoria');

select * from finish();
rollback;
