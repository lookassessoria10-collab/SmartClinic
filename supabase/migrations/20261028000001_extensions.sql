-- 0001 — Extensões e schema privado `app`.
-- `app` guarda funções auxiliares de autorização. Ele NÃO está na lista de schemas expostos
-- pela API (supabase/config.toml → [api].schemas), então não pode ser chamado de fora.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists citext with schema extensions;
create extension if not exists btree_gist with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
-- As políticas RLS chamam funções de `app`; o papel `authenticated` precisa enxergar o schema.
grant usage on schema app to authenticated;

-- Nada criado daqui em diante fica acessível sem um GRANT explícito na própria migração.
-- O Supabase concede, por padrão, acesso de anon/authenticated a objetos novos em `public`;
-- revogar só de PUBLIC não basta, por isso os papéis são citados um a um.
alter default privileges in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges in schema app revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke execute on functions from public, anon, authenticated;
alter default privileges for role postgres in schema public revoke all on tables from anon, authenticated;
alter default privileges for role postgres in schema public revoke all on sequences from anon, authenticated;

-- Atualiza `updated_at` em qualquer tabela que tenha a coluna.
create function app.touch_updated_at() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;
