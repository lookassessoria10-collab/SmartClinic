-- Dados fictícios para desenvolvimento LOCAL (docs/09 S12: nunca dados reais).
-- Aplicado por `npm run db:reset`. Não é usado em staging nem produção.
--
-- Usuários de teste (senha de todos: Teste@12345 — só existe no banco local):
--   ana@clinica-aurora.test     Gestora e dentista da Clínica Aurora (gestora + profissional)
--   bruno@clinica-aurora.test   Recepção da Clínica Aurora
--   carla@clinica-aurora.test   Profissional (esteticista) da Clínica Aurora
--   beto@espaco-lumi.test       Gestor do Espaço Lumi (outra clínica, para testar isolamento)
--   suporte@plataforma.test     Administrador da plataforma (sem acesso a dados das clínicas)

-- Usuários do Supabase Auth. Os campos de token vazios ('') são exigidos pelo serviço de login.
with u (id, email, full_name) as (values
  ('11111111-1111-4111-8111-000000000001'::uuid, 'ana@clinica-aurora.test',   'Dra. Ana Ribeiro'),
  ('11111111-1111-4111-8111-000000000002'::uuid, 'bruno@clinica-aurora.test', 'Bruno Costa'),
  ('11111111-1111-4111-8111-000000000003'::uuid, 'carla@clinica-aurora.test', 'Carla Souza'),
  ('11111111-1111-4111-8111-000000000004'::uuid, 'beto@espaco-lumi.test',     'Beto Almeida'),
  ('11111111-1111-4111-8111-000000000005'::uuid, 'suporte@plataforma.test',   'Equipe de Suporte')
)
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change, email_change_token_new
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('Teste@12345', extensions.gen_salt('bf')), now(),
  '{"provider":"email","providers":["email"]}', jsonb_build_object('full_name', u.full_name), now(), now(),
  '', '', '', ''
from u;

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), id, id::text,
       jsonb_build_object('sub', id::text, 'email', email, 'email_verified', true),
       'email', now(), now(), now()
from auth.users
where id::text like '11111111-1111-4111-8111-%';

insert into public.platform_admins (user_id) values ('11111111-1111-4111-8111-000000000005');

-- Clínicas, unidades, equipe e profissionais (o mesmo que create_organization + convites fariam).
insert into public.organizations (id, name, slug, segment, status, phone, created_by, onboarding) values
  ('22222222-2222-4222-8222-000000000001', 'Clínica Aurora', 'clinica-aurora', 'multidisciplinary', 'active',
   '+551130000000', '11111111-1111-4111-8111-000000000001', '{"size":"2 a 5","need":"online_booking"}'),
  ('22222222-2222-4222-8222-000000000002', 'Espaço Lumi', 'espaco-lumi', 'aesthetic_clinic', 'trial',
   '+551130000001', '11111111-1111-4111-8111-000000000004', '{"size":"Só eu","need":"schedule"}');

insert into public.units (organization_id, name, is_default) values
  ('22222222-2222-4222-8222-000000000001', 'Unidade principal', true),
  ('22222222-2222-4222-8222-000000000002', 'Unidade principal', true);

insert into public.memberships (organization_id, user_id, role, status, invited_by) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'manager',      'active', null),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000002', 'reception',    'active', '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000003', 'professional', 'active', '11111111-1111-4111-8111-000000000001'),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000004', 'manager',      'active', null);

insert into public.professionals (id, organization_id, user_id, display_name, specialty, color) values
  ('33333333-3333-4333-8333-000000000001', '22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Dra. Ana Ribeiro', 'Dentista — clínica geral', 1),
  ('33333333-3333-4333-8333-000000000002', '22222222-2222-4222-8222-000000000001', null,                                   'Dr. Marcos Lima',  'Dentista — endodontia',    6),
  ('33333333-3333-4333-8333-000000000003', '22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000003', 'Carla Souza',      'Esteticista',              5),
  ('33333333-3333-4333-8333-000000000004', '22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000004', 'Beto Almeida',     'Esteticista',              2);

-- Fase 4: serviços e quem atende cada um.
insert into public.services (id, organization_id, name, category, duration_min, buffer_after_min, price_cents, show_price_publicly) values
  ('44444444-4444-4444-8444-000000000001', '22222222-2222-4222-8222-000000000001', 'Avaliação odontológica', 'Consulta',     30,  0, 15000, true),
  ('44444444-4444-4444-8444-000000000002', '22222222-2222-4222-8222-000000000001', 'Limpeza',                'Procedimento', 45, 15, 22000, true),
  ('44444444-4444-4444-8444-000000000003', '22222222-2222-4222-8222-000000000001', 'Tratamento de canal',    'Procedimento', 90,  0, 120000, false),
  ('44444444-4444-4444-8444-000000000004', '22222222-2222-4222-8222-000000000001', 'Limpeza de pele',        'Sessão',       60,  0, 18000, true),
  ('44444444-4444-4444-8444-000000000005', '22222222-2222-4222-8222-000000000002', 'Avaliação estética',     'Consulta',     30,  0, null,  false);

insert into public.professional_services (organization_id, professional_id, service_id) values
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000001', '44444444-4444-4444-8444-000000000001'),
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000001', '44444444-4444-4444-8444-000000000002'),
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000002', '44444444-4444-4444-8444-000000000001'),
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000002', '44444444-4444-4444-8444-000000000003'),
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000003', '44444444-4444-4444-8444-000000000004'),
  ('22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000004', '44444444-4444-4444-8444-000000000005');

-- Fase 5: horário de atendimento (seg–sex; Carla também sábado de manhã).
insert into public.availability_rules (organization_id, professional_id, weekday, start_time, end_time)
select '22222222-2222-4222-8222-000000000001', p, d, s, e
from (values
  ('33333333-3333-4333-8333-000000000001'::uuid, '08:00'::time, '12:00'::time),
  ('33333333-3333-4333-8333-000000000001'::uuid, '13:00'::time, '18:00'::time),
  ('33333333-3333-4333-8333-000000000002'::uuid, '09:00'::time, '12:00'::time),
  ('33333333-3333-4333-8333-000000000002'::uuid, '13:00'::time, '18:00'::time),
  ('33333333-3333-4333-8333-000000000003'::uuid, '09:00'::time, '13:00'::time),
  ('33333333-3333-4333-8333-000000000003'::uuid, '14:00'::time, '19:00'::time)
) as v(p, s, e), generate_series(1, 5) d;
insert into public.availability_rules (organization_id, professional_id, weekday, start_time, end_time) values
  ('22222222-2222-4222-8222-000000000001', '33333333-3333-4333-8333-000000000003', 6, '09:00', '13:00'),
  ('22222222-2222-4222-8222-000000000002', '33333333-3333-4333-8333-000000000004', 2, '10:00', '18:00');

-- Pacientes fictícios (telefones na faixa +55 11 90000-1xxx, e-mails .test).
insert into public.patients (id, organization_id, full_name, phone_e164, email, created_by)
select ('55555555-5555-4555-8555-' || lpad(i::text, 12, '0'))::uuid,
       '22222222-2222-4222-8222-000000000001', n, '+55119000010' || lpad(i::text, 2, '0'),
       case when i % 3 = 0 then 'paciente' || i || '@exemplo.test' end,
       '11111111-1111-4111-8111-000000000002'
from unnest(array['Mariana Alves', 'João Pereira', 'Beatriz Santos', 'Rafael Oliveira', 'Fernanda Costa',
                  'Lucas Martins', 'Juliana Rocha', 'Pedro Carvalho']) with ordinality as t(n, i);

-- Alguns atendimentos nos próximos dias úteis (sempre no futuro, em horário de atendimento).
with dia as (
  select (d::date + time '00:00') at time zone 'America/Sao_Paulo' as base, row_number() over () as n
  from generate_series(current_date + 1, current_date + 10, interval '1 day') d
  where extract(dow from d) between 1 and 5
  limit 4
)
insert into public.appointments (organization_id, professional_id, service_id, patient_id, starts_at, ends_at, status, origin, created_by)
select '22222222-2222-4222-8222-000000000001', v.prof, v.svc, v.pat,
       dia.base + v.ini, dia.base + v.ini + v.dur, 'confirmed', 'staff', '11111111-1111-4111-8111-000000000002'
from dia
cross join (values
  ('33333333-3333-4333-8333-000000000001'::uuid, '44444444-4444-4444-8444-000000000001'::uuid, '55555555-5555-4555-8555-000000000001'::uuid, interval '9 hours',  interval '30 minutes'),
  ('33333333-3333-4333-8333-000000000001'::uuid, '44444444-4444-4444-8444-000000000002'::uuid, '55555555-5555-4555-8555-000000000002'::uuid, interval '14 hours', interval '60 minutes'),
  ('33333333-3333-4333-8333-000000000003'::uuid, '44444444-4444-4444-8444-000000000004'::uuid, '55555555-5555-4555-8555-000000000003'::uuid, interval '10 hours', interval '60 minutes')
) as v(prof, svc, pat, ini, dur)
where dia.n <= 3 or v.prof = '33333333-3333-4333-8333-000000000003';
