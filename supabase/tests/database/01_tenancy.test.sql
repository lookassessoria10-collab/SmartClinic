-- Isolamento entre clínicas, matriz de papéis e regras da Fase 3 (docs/12 §8–9).
-- Tudo roda numa transação desfeita no final: nenhum dado fica no banco.
--
-- Para "entrar" como alguém:   set local role authenticated; + request.jwt.claims com o `sub`.
-- Para voltar a ser o admin:   reset role;
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

-- ---------------------------------------------------------------------------------------
-- Apoio aos testes (descartado no rollback)
-- ---------------------------------------------------------------------------------------
create schema tests;
create table tests.vals (k text primary key, v text);
grant usage on schema tests to authenticated, anon;
grant all on tests.vals to authenticated, anon;

-- Usuários fictícios (domínio .test reservado)
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('00000000-0000-0000-0000-0000000000a1', 'ana@clinica-a.test',    now(), '{"full_name":"Ana Gestora"}',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a2', 'bruno@clinica-a.test',  now(), '{"full_name":"Bruno Recepção"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000a3', 'carla@clinica-a.test',  now(), '{"full_name":"Carla Prof"}',     'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000b1', 'beto@clinica-b.test',   now(), '{"full_name":"Beto Gestor"}',    'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000c1', 'fora@exemplo.test',     now(), '{"full_name":"Pessoa de Fora"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000d1', 'semconfirmar@exemplo.test', null, '{"full_name":"Sem Confirmar"}', 'authenticated', 'authenticated'),
  ('00000000-0000-0000-0000-0000000000e1', 'suporte@plataforma.test', now(), '{"full_name":"Suporte"}',      'authenticated', 'authenticated');
insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000e1');

select is((select count(*)::int from public.profiles), 7, 'perfil criado automaticamente para cada usuário');

-- ---------------------------------------------------------------------------------------
-- Criação de clínicas
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000d1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.create_organization('Sem Email', 'sem-email', 'other') $$,
  '42501', null, 'sem e-mail confirmado não cria clínica');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.create_organization('Admin', 'admin', 'other') $$,
  'P0001', 'Este endereço já está em uso ou não é permitido.', 'slug reservado é recusado');
select throws_ok(
  $$ select public.create_organization('Errado', 'Com Espaço', 'other') $$,
  'P0001', 'Este endereço já está em uso ou não é permitido.', 'slug fora do formato é recusado');
select lives_ok(
  $$ insert into tests.vals select 'org_a', public.create_organization('Clínica A', 'clinica-a', 'dental_clinic', '{"need":"schedule"}', true, 'Dentista')::text $$,
  'gestora cria a clínica A');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000b1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into tests.vals select 'org_b', public.create_organization('Clínica B', 'clinica-b', 'aesthetic_clinic')::text $$,
  'gestor cria a clínica B');
select throws_ok(
  $$ select public.create_organization('Copia', 'clinica-a', 'other') $$,
  'P0001', 'Este endereço já está em uso ou não é permitido.', 'slug de outra clínica é recusado');

reset role;
select is((select count(*)::int from public.units where organization_id = (select v::uuid from tests.vals where k = 'org_a') and is_default), 1,
  'clínica nasce com uma unidade padrão (RN-01)');
select is((select role::text from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'), 'manager',
  'quem cria vira gestor');
select is((select count(*)::int from public.professionals where user_id = '00000000-0000-0000-0000-0000000000a1'), 1,
  'gestora que atende vira profissional (D-05)');
select is((select count(*)::int from public.professionals where user_id = '00000000-0000-0000-0000-0000000000b1'), 0,
  'gestor que não atende não vira profissional');
select ok(exists (select 1 from public.audit_logs where action = 'organizations.insert'
                  and organization_id = (select v::uuid from tests.vals where k = 'org_a')),
  'criação da clínica aparece na auditoria');

-- ---------------------------------------------------------------------------------------
-- Convites
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok(
  $$ insert into tests.vals select 'inv_bruno', public.create_invitation((select v::uuid from tests.vals where k = 'org_a'), 'Bruno@Clinica-A.test', 'reception') $$,
  'gestora convida a recepção (e-mail normalizado)');
select lives_ok(
  $$ insert into tests.vals select 'inv_carla_old', public.create_invitation((select v::uuid from tests.vals where k = 'org_a'), 'carla@clinica-a.test', 'professional') $$,
  'gestora convida a profissional');
select lives_ok(
  $$ insert into tests.vals select 'inv_carla', public.create_invitation((select v::uuid from tests.vals where k = 'org_a'), 'carla@clinica-a.test', 'professional') $$,
  'reenviar convite gera outro token');
select is((select count(*)::int from public.invitations where email = 'carla@clinica-a.test' and revoked_at is null), 1,
  'reenvio revoga o convite anterior');
select throws_ok(
  $$ select public.create_invitation((select v::uuid from tests.vals where k = 'org_b'), 'x@exemplo.test', 'manager') $$,
  '42501', null, 'gestora de A não convida para B');
select throws_ok(
  $$ select token_hash from public.invitations $$,
  '42501', null, 'token_hash não é legível');

-- Pessoa errada tenta usar o convite da recepção
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.accept_invitation((select v from tests.vals where k = 'inv_bruno')) $$,
  'P0001', 'Este convite foi enviado para outro e-mail.', 'convite só vale para o e-mail convidado');
select throws_ok(
  $$ select public.accept_invitation('token-inventado') $$,
  'P0001', 'Convite inválido ou expirado.', 'token inexistente recebe mensagem genérica');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select throws_ok(
  $$ select public.accept_invitation((select v from tests.vals where k = 'inv_carla_old')) $$,
  'P0001', 'Convite inválido ou expirado.', 'convite revogado não funciona');
select lives_ok(
  $$ select public.accept_invitation((select v from tests.vals where k = 'inv_carla')) $$,
  'profissional aceita o convite atual');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select lives_ok(
  $$ select public.accept_invitation((select v from tests.vals where k = 'inv_bruno')) $$,
  'recepção aceita o convite');
select throws_ok(
  $$ select public.accept_invitation((select v from tests.vals where k = 'inv_bruno')) $$,
  'P0001', 'Convite inválido ou expirado.', 'convite não pode ser reutilizado');

-- Convite vencido
reset role;
update public.invitations set expires_at = now() - interval '1 minute' where email = 'carla@clinica-a.test' and accepted_at is null;
insert into public.invitations (organization_id, email, role, token_hash, invited_by, expires_at)
values ((select v::uuid from tests.vals where k = 'org_a'), 'fora@exemplo.test', 'reception',
        extensions.digest('token-vencido', 'sha256'), '00000000-0000-0000-0000-0000000000a1', now() - interval '1 day');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.accept_invitation('token-vencido') $$,
  'P0001', 'Convite inválido ou expirado.', 'convite vencido não funciona');

-- ---------------------------------------------------------------------------------------
-- Isolamento: gestora de A tentando ver/alterar B
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select results_eq($$ select slug::text from public.organizations $$, array['clinica-a'], 'A vê só a própria clínica');
select is((select count(*)::int from public.units where organization_id = (select v::uuid from tests.vals where k = 'org_b')), 0, 'A não vê unidades de B');
select is((select count(*)::int from public.memberships where organization_id = (select v::uuid from tests.vals where k = 'org_b')), 0, 'A não vê membros de B');
select is((select count(*)::int from public.professionals where organization_id = (select v::uuid from tests.vals where k = 'org_b')), 0, 'A não vê profissionais de B');
select is((select count(*)::int from public.audit_logs where organization_id = (select v::uuid from tests.vals where k = 'org_b')), 0, 'A não vê auditoria de B');
select is((select count(*)::int from public.profiles where user_id = '00000000-0000-0000-0000-0000000000b1'), 0, 'A não vê o perfil de quem só está em B');
select is((select count(*)::int from public.memberships where organization_id = (select v::uuid from tests.vals where k = 'org_a')), 3, 'A vê a própria equipe (3 pessoas)');

update public.organizations set name = 'Invadida' where id = (select v::uuid from tests.vals where k = 'org_b');
update public.units set name = 'Invadida' where organization_id = (select v::uuid from tests.vals where k = 'org_b');
select throws_ok(
  $$ insert into public.units (organization_id, name) values ((select v::uuid from tests.vals where k = 'org_b'), 'Intrusa') $$,
  '42501', null, 'A não cria unidade em B');
select throws_ok(
  $$ insert into public.professionals (organization_id, display_name) values ((select v::uuid from tests.vals where k = 'org_b'), 'Intruso') $$,
  '42501', null, 'A não cria profissional em B');
select throws_ok(
  $$ update public.organizations set status = 'active' $$,
  '42501', null, 'status da clínica não é alterável pelo cliente');
select throws_ok(
  $$ update public.organizations set slug = 'outra' $$,
  '42501', null, 'slug só muda pela função change_slug');
select throws_ok(
  $$ update public.memberships set role = 'manager' $$,
  '42501', null, 'membros não são alteráveis diretamente');
select throws_ok(
  $$ delete from public.memberships $$,
  '42501', null, 'membros não são apagáveis diretamente');
select throws_ok(
  $$ insert into public.audit_logs (actor_kind, action) values ('member', 'forjado') $$,
  '42501', null, 'auditoria não aceita inserção do cliente');
select throws_ok(
  $$ insert into public.platform_admins (user_id) values ('00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'ninguém se promove a admin da plataforma');

reset role;
select is((select name from public.organizations where slug = 'clinica-b'), 'Clínica B', 'nome de B continua intacto');
select is((select name from public.units where organization_id = (select v::uuid from tests.vals where k = 'org_b')), 'Unidade principal', 'unidade de B continua intacta');

-- ---------------------------------------------------------------------------------------
-- Pessoa de fora, anon e admin da plataforma
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 0, 'pessoa sem vínculo não vê clínicas');
select is((select count(*)::int from public.memberships), 0, 'pessoa sem vínculo não vê membros');
select is((select count(*)::int from public.professionals), 0, 'pessoa sem vínculo não vê profissionais');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000e1","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 2, 'admin da plataforma vê as clínicas (plano/status)');
select is((select count(*)::int from public.professionals), 0, 'admin da plataforma não vê dados internos das clínicas');
select is((select count(*)::int from public.audit_logs), 0, 'admin da plataforma não lê auditoria das clínicas');

reset role;
set local role anon;
select set_config('request.jwt.claims', '{"role":"anon"}', true);
select throws_ok($$ select * from public.organizations $$, '42501', null, 'anon não lê clínicas');
select throws_ok($$ select * from public.memberships $$, '42501', null, 'anon não lê membros');
select throws_ok($$ select public.slug_available('qualquer') $$, '42501', null, 'anon não chama funções');

-- ---------------------------------------------------------------------------------------
-- Matriz de papéis dentro de A
-- ---------------------------------------------------------------------------------------
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select ok(not app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'members.manage'), 'recepção não gerencia membros');
select ok(app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'patients.read_all'), 'recepção lê todos os pacientes');
select ok(not app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'finance.read'), 'recepção não vê o resumo financeiro (D-06)');
select throws_ok(
  $$ select public.create_invitation((select v::uuid from tests.vals where k = 'org_a'), 'z@exemplo.test', 'manager') $$,
  '42501', null, 'recepção não convida');
update public.organizations set name = 'Mudada pela recepção' where slug = 'clinica-a';
select is((select count(*)::int from public.invitations), 0, 'recepção não vê convites');
select is((select count(*)::int from public.audit_logs), 0, 'recepção não lê a auditoria');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select ok(app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'patients.read_own'), 'profissional lê os próprios pacientes');
select ok(not app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'patients.read_all'), 'profissional não lê todos os pacientes (D-06)');
select ok(not app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'org.settings'), 'profissional não altera configurações');

reset role;
select is((select name from public.organizations where slug = 'clinica-a'), 'Clínica A', 'recepção não conseguiu renomear a clínica');

-- ---------------------------------------------------------------------------------------
-- Último gestor, troca de papel e desativação
-- ---------------------------------------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select throws_ok(
  $$ select public.change_member_role((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'), 'reception') $$,
  'P0001', 'A clínica precisa de pelo menos um gestor ativo.', 'último gestor não pode deixar de ser gestor');
select throws_ok(
  $$ select public.set_member_status((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'), 'disabled') $$,
  'P0001', 'A clínica precisa de pelo menos um gestor ativo.', 'último gestor não pode ser desativado');
select throws_ok(
  $$ select public.change_member_role((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000b1'), 'reception') $$,
  '42501', null, 'gestora de A não mexe em membro de B');
select lives_ok(
  $$ select public.set_member_status((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a2'), 'disabled') $$,
  'gestora desativa a recepção');
select ok(exists (select 1 from public.audit_logs where action = 'memberships.update' and changes ? 'status'),
  'desativação aparece na auditoria');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a2","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 0, 'membro desativado perde acesso imediatamente');
select ok(not app.has_perm((select v::uuid from tests.vals where k = 'org_a'), 'patients.read_all'), 'membro desativado perde as permissões');

-- Promover outro gestor e só então rebaixar a primeira (troca de gestor)
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a1","role":"authenticated"}', true);
select lives_ok(
  $$ select public.change_member_role((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a3'), 'manager') $$,
  'gestora promove a profissional a gestora');
select lives_ok(
  $$ select public.change_member_role((select id from public.memberships where user_id = '00000000-0000-0000-0000-0000000000a1'), 'reception') $$,
  'com outro gestor ativo, a primeira pode mudar de papel');

-- ---------------------------------------------------------------------------------------
-- Slug
-- ---------------------------------------------------------------------------------------
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.change_slug((select v::uuid from tests.vals where k = 'org_a'), 'clinica-a-nova') $$,
  'gestora troca o slug');
select is((select slug::text from public.organization_slug_history where organization_id = (select v::uuid from tests.vals where k = 'org_a')),
  'clinica-a', 'slug antigo vai para o histórico (redirecionamento)');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000c1","role":"authenticated"}', true);
select ok(not public.slug_available('clinica-a'), 'slug antigo fica reservado por 90 dias');
select throws_ok(
  $$ select public.create_organization('Oportunista', 'clinica-a', 'other') $$,
  'P0001', 'Este endereço já está em uso ou não é permitido.', 'outra clínica não pega o slug antigo');
select ok(public.slug_available('clinica-livre'), 'slug livre aparece como disponível');

select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select lives_ok(
  $$ select public.change_slug((select v::uuid from tests.vals where k = 'org_a'), 'clinica-a') $$,
  'a própria clínica pode retomar o slug antigo');

-- ---------------------------------------------------------------------------------------
-- Clínica suspensa: leitura sim, escrita não (RN-72)
-- ---------------------------------------------------------------------------------------
reset role;
update public.organizations set status = 'suspended' where id = (select v::uuid from tests.vals where k = 'org_a');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"00000000-0000-0000-0000-0000000000a3","role":"authenticated"}', true);
select is((select count(*)::int from public.organizations), 1, 'clínica suspensa continua legível');
select throws_ok(
  $$ update public.organizations set name = 'Escrita bloqueada' where slug = 'clinica-a' $$,
  '42501', null, 'clínica suspensa não aceita alteração');
select throws_ok(
  $$ insert into public.units (organization_id, name) values ((select v::uuid from tests.vals where k = 'org_a'), 'Nova') $$,
  '42501', null, 'clínica suspensa não aceita nova unidade');
select throws_ok(
  $$ select public.create_invitation((select v::uuid from tests.vals where k = 'org_a'), 'novo@exemplo.test', 'reception') $$,
  'P0001', 'Clínica em modo somente leitura.', 'clínica suspensa não convida');

select * from finish();
rollback;
