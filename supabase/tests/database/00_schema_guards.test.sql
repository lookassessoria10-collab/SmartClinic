-- Rede de segurança genérica: vale para as tabelas e funções que vierem nas próximas fases.
-- Se alguém criar uma tabela sem RLS ou expor algo ao `anon`, o CI falha aqui.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p') and not c.relrowsecurity),
  null::text[],
  'toda tabela de public tem RLS habilitada'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p', 'v', 'm')
      and (has_table_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE, DELETE, TRUNCATE')
           or has_any_column_privilege('anon', c.oid, 'SELECT, INSERT, UPDATE'))),
  null::text[],
  'anon não tem privilégio em nenhuma tabela ou coluna de public'
);

select is(
  (select array_agg(c.relname::text order by c.relname)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'DELETE, TRUNCATE')
      -- Exceções deliberadas (sem dado pessoal; apagar é a operação natural; ambas auditadas):
      -- vínculo profissional↔serviço e bloqueios de agenda (migrações 0011–0012).
      and c.relname not in ('professional_services', 'schedule_blocks')),
  null::text[],
  'authenticated não apaga nada diretamente (exclusão é lógica ou via função), salvo as exceções listadas'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app')
      and has_function_privilege('anon', p.oid, 'EXECUTE')
      and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')),
  null::text[],
  'anon não executa nenhuma função de public/app'
);

select is(
  (select array_agg(p.proname::text order by p.proname)
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'app') and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) cfg where cfg like 'search_path=%')),
  null::text[],
  'toda função security definer fixa o search_path'
);

select is(
  (select array_agg(c.column_name::text)
     from information_schema.columns c
    where c.table_schema = 'public' and c.table_name = 'invitations' and c.column_name = 'token_hash'
      and has_column_privilege('authenticated', 'public.invitations', c.column_name, 'SELECT')),
  null::text[],
  'token_hash dos convites nunca é legível por authenticated'
);

select ok(
  not has_schema_privilege('anon', 'app', 'USAGE'),
  'anon não enxerga o schema privado app'
);

select * from finish();
rollback;
