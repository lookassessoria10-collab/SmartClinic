-- MFA aplicado no banco (migração 0010).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000f1', 'com-mfa@m.test', now(), '{"full_name":"Com MFA"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f2', 'sem-mfa@m.test', now(), '{"full_name":"Sem MFA"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000f3', 'admin@m.test',   now(), '{"full_name":"Admin"}',   'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000f3');

insert into public.organizations (id, name, slug, segment, status) values
  ('20000000-0000-0000-0000-00000000000a', 'Clínica MFA', 'clinica-mfa', 'other', 'active');
insert into public.memberships (organization_id, user_id, role, status) values
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f1', 'manager', 'active'),
  ('20000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000f2', 'manager', 'active');

-- f1 tem um fator TOTP verificado; um fator só "não verificado" não conta.
insert into auth.mfa_factors (id, user_id, friendly_name, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f1', 'Celular', 'totp', 'verified', now(), now()),
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f2', 'Rascunho', 'totp', 'unverified', now(), now());

set local role authenticated;

-- Com MFA ativado, sessão só com senha (aal1): nada.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.organizations where slug = 'clinica-mfa'), 0, 'com MFA e só a senha: não vê a clínica');
select is((select count(*)::int from public.memberships), 0, 'com MFA e só a senha: não vê nem o próprio vínculo');
select is((select count(*)::int from public.profiles), 0, 'com MFA e só a senha: não vê nem o próprio perfil');
select throws_ok(
  $$ select public.create_invitation('20000000-0000-0000-0000-00000000000a', 'x@m.test', 'reception') $$,
  '42501', null, 'com MFA e só a senha: não convida (funções de escrita também exigem o segundo passo)');

-- Depois do código (aal2): acesso normal.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f1","role":"authenticated","aal":"aal2"}', true);
select is((select count(*)::int from public.organizations where slug = 'clinica-mfa'), 1, 'com MFA e código: vê a clínica');
select lives_ok(
  $$ select public.create_invitation('20000000-0000-0000-0000-00000000000a', 'x@m.test', 'reception') $$,
  'com MFA e código: convida');

-- Sem MFA verificado (só rascunho): aal1 basta, como antes.
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f2","role":"authenticated","aal":"aal1"}', true);
select is((select count(*)::int from public.organizations where slug = 'clinica-mfa'), 1, 'sem MFA ativado: a senha basta');

-- Admin da plataforma: MFA obrigatório (D-19).
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated","aal":"aal1"}', true);
select ok(not app.is_platform_admin(), 'admin sem o segundo passo não é tratado como admin');
select is((select count(*)::int from public.organizations where slug = 'clinica-mfa'), 0, 'admin sem o segundo passo não vê clínicas');
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000f3","role":"authenticated","aal":"aal2"}', true);
select ok(app.is_platform_admin(), 'admin com o segundo passo é admin');

select * from finish();
rollback;
