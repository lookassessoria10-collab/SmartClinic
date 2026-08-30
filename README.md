# SmartClinic

Sistema de agendamento e gestão para clínicas (multi-clínica: cada uma com seu próprio
login e dados isolados). Front-end estático (HTML/JS puro) + Supabase como backend.

## Arquivos

- `index.html` — o app inteiro (painel da clínica + página pública de agendamento).
- `supabase-schema.sql` — schema do banco. Roda uma vez no SQL Editor do Supabase.

## Deploy

1. Rode `supabase-schema.sql` no SQL Editor do seu projeto Supabase.
2. Suba este repositório no GitHub (já feito, se você chegou aqui pelo zip).
3. Conecte o repositório no Vercel (Add New → Project → importar) — ele publica sozinho
   e atualiza a cada push.

## Como cada clínica usa

- **Painel da clínica**: acessa a URL raiz do site, cria conta (nome da clínica + e-mail
  + senha) e faz login. Cada conta só vê os próprios dados.
- **Link de agendamento do paciente**: `suaurl.vercel.app/?c=slug-da-clinica` — o slug
  aparece em Ajustes dentro do painel, depois do primeiro login.

## Credenciais do Supabase

A URL e a chave pública (`anon`/`publishable`) do Supabase já estão embutidas no
`index.html` (constantes `SUPABASE_URL` e `SUPABASE_KEY` no topo do `<script>`). Essa
chave é feita para ficar visível no código do cliente — ela só funciona dentro do que
as políticas de RLS do banco permitem. Nunca coloque a chave `service_role` aqui.
