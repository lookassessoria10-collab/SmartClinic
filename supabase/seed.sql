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

insert into public.professionals (organization_id, user_id, display_name, specialty, color) values
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000001', 'Dra. Ana Ribeiro', 'Dentista — clínica geral', 1),
  ('22222222-2222-4222-8222-000000000001', null,                                   'Dr. Marcos Lima',  'Dentista — endodontia',    6),
  ('22222222-2222-4222-8222-000000000001', '11111111-1111-4111-8111-000000000003', 'Carla Souza',      'Esteticista',              5),
  ('22222222-2222-4222-8222-000000000002', '11111111-1111-4111-8111-000000000004', 'Beto Almeida',     'Esteticista',              2);
