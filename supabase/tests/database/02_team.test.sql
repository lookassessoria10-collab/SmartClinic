-- Leituras da gestão de equipe e do aceite de convite (migração 0008).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

insert into auth.users (id, email, email_confirmed_at, encrypted_password, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'gestora@a.test',  now(), 'hash-qualquer', '{"full_name":"Gestora A"}',  'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'recep@a.test',    now(), 'hash-qualquer', '{"full_name":"Recepção A"}', 'authenticated', 'authenticated'),
  -- Conta criada pelo convite: o Supabase grava senha aleatória; a marca é o metadado.
  ('00000000-0000-0000-0000-0000000000c1', 'convidada@x.test', now(), 'hash-aleatorio', '{"full_name":"Convidada","needs_password":true}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c2', 'outra@x.test',    now(), 'hash-qualquer', '{"full_name":"Outra"}',      'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'gestor@b.test',   now(), 'hash-qualquer', '{"full_name":"Gestor B"}',   'authenticated', 'authenticated');

insert into public.organizations (id, name, slug, segment, status) values
  ('10000000-0000-0000-0000-00000000000a', 'Clínica A', 'clinica-a', 'other', 'active'),
  ('10000000-0000-0000-0000-00000000000b', 'Clínica B', 'clinica-b', 'other', 'active');
insert into public.memberships (organization_id, user_id, role, status) values
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a1', 'manager', 'active'),
  ('10000000-0000-0000-0000-00000000000a', '00000000-0000-0000-0000-0000000000a2', 'reception', 'active'),
  ('10000000-0000-0000-0000-00000000000b', '00000000-0000-0000-0000-0000000000b1', 'manager', 'active');
insert into public.invitations (organization_id, email, role, token_hash, invited_by) values
  ('10000000-0000-0000-0000-00000000000a', 'convidada@x.test', 'professional',
   extensions.digest('token-certo', 'sha256'), '00000000-0000-0000-0000-0000000000a1');

-- ---------------------------------------------------------------------------------------
-- get_my_invitation
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select results_eq(
  $$ select organization_name, role::text, invited_by_name, needs_password from public.get_my_invitation('token-certo') $$,
  $$ values ('Clínica A'::text, 'professional'::text, 'Gestora A'::text, true) $$,
  'convidada vê clínica, papel e quem convidou; conta nova precisa criar senha');
select is((select count(*)::int from public.get_my_invitation('token-errado')), 0, 'token errado não devolve nada');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.get_my_invitation('token-certo')), 0,
  'outra pessoa com o token não vê o convite (e-mail diferente)');

reset role;
update public.invitations set revoked_at = now() where email = 'convidada@x.test';
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.get_my_invitation('token-certo')), 0, 'convite revogado não aparece');

-- ---------------------------------------------------------------------------------------
-- list_team
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000a')), 2, 'gestora vê a equipe de A');
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000a') where email is not null), 2,
  'gestora vê os e-mails da equipe');
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000b')), 0, 'gestora de A não vê a equipe de B');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000a')), 2, 'recepção vê nomes da equipe');
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000a') where email is not null), 0,
  'recepção não vê e-mails (dado pessoal)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c2","role":"authenticated"}', true);
select is((select count(*)::int from public.list_team('10000000-0000-0000-0000-00000000000a')), 0, 'quem não é membro não vê a equipe');

select throws_ok($$ select public.invitation_email_for_token('token-certo') $$, '42501', null,
  'usuário logado não descobre o e-mail de um convite pelo código');

reset role;
set local role anon;
select throws_ok($$ select public.invitation_email_for_token('token-certo') $$, '42501', null,
  'anon não descobre o e-mail de um convite pelo código');
select throws_ok($$ select * from public.list_team('10000000-0000-0000-0000-00000000000a') $$, '42501', null, 'anon não chama list_team');
select throws_ok($$ select * from public.get_my_invitation('token-certo') $$, '42501', null, 'anon não chama get_my_invitation');

select * from finish();
rollback;
