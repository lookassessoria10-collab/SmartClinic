-- 0013 — Limite de tentativas de login mais justo (corrige ADR-021).
--
-- Antes: 5 falhas por e-mail em 15 min bloqueavam o login, contando falhas de ANTES de a conta
-- existir e sem liberar depois de a senha ser trocada — quem errou o e-mail no cadastro e
-- depois criou a conta ficava travado mesmo com a senha certa.
-- Agora a contagem por e-mail começa no mais recente entre: 15 min atrás, criação da conta,
-- último login com sucesso e última troca de senha. Limite: 8 por e-mail, 30 por IP.

create index if not exists audit_logs_auth_recent on public.audit_logs (action, created_at desc)
  where entity = 'auth';

create function public.login_throttled(p_email text, p_ip_hash bytea) returns boolean
language plpgsql stable security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
  v_hash text := encode(extensions.digest(v_email, 'sha256'), 'hex');
  v_since timestamptz;
  v_by_email int;
  v_by_ip int;
begin
  select greatest(
           now() - interval '15 minutes',
           (select u.created_at from auth.users u where lower(u.email) = v_email limit 1),
           (select max(a.created_at) from public.audit_logs a
             where a.entity = 'auth' and a.action in ('auth.login', 'auth.password_changed')
               and a.changes ->> 'email_hash' = v_hash)
         )
    into v_since;

  select count(*) into v_by_email from public.audit_logs a
   where a.entity = 'auth' and a.action = 'auth.login_failed'
     and a.created_at > v_since and a.changes ->> 'email_hash' = v_hash;

  select count(*) into v_by_ip from public.audit_logs a
   where a.entity = 'auth' and a.action = 'auth.login_failed'
     and a.created_at > now() - interval '15 minutes' and a.ip_hash = p_ip_hash;

  return v_by_email >= 8 or v_by_ip >= 30;
end;
$$;

-- Só o servidor (chave secreta) consulta: não revela a ninguém se um e-mail tem conta.
revoke execute on function public.login_throttled(text, bytea) from public, anon, authenticated;
grant execute on function public.login_throttled(text, bytea) to service_role;
