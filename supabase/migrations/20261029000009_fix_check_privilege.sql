-- 0009 — Correção: o CHECK `slug_not_reserved` (0002) chama app.is_reserved_slug, e o Postgres
-- avalia CHECKs com as permissões de quem altera a linha. Como a 0001 removeu o EXECUTE padrão,
-- todo UPDATE direto em organizations (renomear a clínica, telefone) falhava com 42501.
-- A função é imutável e não lê dados: liberar para authenticated é seguro.
grant execute on function app.is_reserved_slug(text) to authenticated;
