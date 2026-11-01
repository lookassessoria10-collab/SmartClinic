-- Limite de tentativas de login (migração 0013).
begin;
create extension if not exists pgtap with schema extensions;
select no_plan();

create function pg_temp.falhas(p_email text, n int, p_quando timestamptz default now()) returns void
language sql as $$
  insert into public.audit_logs (actor_kind, action, entity, changes, ip_hash, created_at)
  select 'public', 'auth.login_failed', 'auth',
         jsonb_build_object('email_hash', encode(extensions.digest(lower(p_email), 'sha256'), 'hex')),
         '\x01'::bytea, p_quando
  from generate_series(1, n);
$$;

select pg_temp.falhas('ninguem@limite.test', 7);
select ok(not public.login_throttled('ninguem@limite.test', '\x02'), '7 falhas: ainda pode tentar');
select pg_temp.falhas('ninguem@limite.test', 1);
select ok(public.login_throttled('NINGUEM@limite.test ', '\x02'), '8 falhas: pausa (sem diferença de maiúsculas/espaços)');

select pg_temp.falhas('antigo@limite.test', 10, now() - interval '20 minutes');
select ok(not public.login_throttled('antigo@limite.test', '\x02'), 'falhas de mais de 15 min não contam');

-- Falhas ANTES de a conta existir não travam a conta nova.
select pg_temp.falhas('nova@limite.test', 9, now() - interval '5 minutes');
insert into auth.users (id, email, raw_user_meta_data, aud, role, created_at)
values ('00000000-0000-0000-0000-0000000005a1', 'nova@limite.test', '{"full_name":"Conta Nova"}', 'authenticated', 'authenticated', now() - interval '1 minute');
select ok(not public.login_throttled('nova@limite.test', '\x02'), 'conta criada depois das falhas: liberada');

-- Troca de senha (ou login com sucesso) zera a contagem.
select pg_temp.falhas('trocou@limite.test', 9, now() - interval '5 minutes');
insert into public.audit_logs (actor_kind, action, entity, changes, created_at)
values ('member', 'auth.password_changed', 'auth',
        jsonb_build_object('email_hash', encode(extensions.digest('trocou@limite.test', 'sha256'), 'hex')), now() - interval '1 minute');
select ok(not public.login_throttled('trocou@limite.test', '\x02'), 'depois de trocar a senha: liberada');

-- Por IP: 30 falhas de e-mails diversos.
insert into public.audit_logs (actor_kind, action, entity, changes, ip_hash)
select 'public', 'auth.login_failed', 'auth', jsonb_build_object('email_hash', md5(g::text)), '\x09'::bytea
from generate_series(1, 30) g;
select ok(public.login_throttled('qualquer@limite.test', '\x09'), '30 falhas do mesmo IP: pausa');

-- Ninguém além do servidor consulta.
set local role authenticated;
select throws_ok($$ select public.login_throttled('x@limite.test', '\x01') $$, '42501', null, 'usuário logado não consulta');
reset role;
set local role anon;
select throws_ok($$ select public.login_throttled('x@limite.test', '\x01') $$, '42501', null, 'anônimo não consulta');
reset role;

select * from finish();
rollback;
