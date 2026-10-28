# 09 — Segurança e LGPD

> Este documento orienta a engenharia. Não substitui parecer jurídico, que é pré-requisito da Fase 10.

## 1. Papéis LGPD

| Papel | Quem | Implicação |
|-------|------|------------|
| Controlador | Cada clínica | Decide finalidade; responde ao paciente |
| Operador | A plataforma | Trata em nome da clínica, conforme contrato (DPA) |
| Suboperadores | Supabase, Vercel, provedor de e-mail, Cloudflare | Listados no DPA; transferência internacional avaliada (LGPD art. 33) |
| Controlador próprio | A plataforma, para dados dos **usuários das clínicas** e cobrança | Política de privacidade própria |

Dados de agendamento em saúde são tratados como **sensíveis** (ver C5). Base legal típica: tutela
da saúde por profissionais de saúde (art. 11, II, "f") — a confirmar com jurídico.

## 2. Principais riscos e controles

| # | Risco | Impacto | Controles |
|---|-------|---------|-----------|
| S1 | **Vazamento entre clínicas** (RLS ausente/errada) | Crítico | RLS em todas as tabelas; teste pgTAP por tabela no CI; lint de migração que falha se tabela nova não tiver RLS; nenhuma consulta com service role em código de clínica |
| S2 | **Service role exposta** | Crítico | Só em `src/server/admin` com `import 'server-only'`; variável sem prefixo `NEXT_PUBLIC_`; verificação no build; rotação documentada |
| S3 | **IDOR** (trocar ID na URL/ação) | Alto | RLS + `requirePermission` com `organization_id` do recurso, nunca do cliente |
| S4 | **Abuso da página pública** (spam, bloqueio de agenda, enumeração) | Alto | Turnstile, limites RN-34, tokens de 256 bits com hash, respostas sem distinguir "token inexistente" de "expirado" |
| S5 | **Conta de membro comprometida** | Alto | Senhas fortes (verificação de senhas vazadas do Supabase Auth, se disponível no plano), MFA para gestores (obrigatório para admin da plataforma), sessão expira por inatividade, lista de sessões ativas (pós-MVP) |
| S6 | **Arquivos maliciosos na importação** | Médio | Limite de tamanho, verificação de tipo, parser sem execução de fórmulas, bucket privado, exclusão em 7 dias |
| S7 | **Injeção CSV na exportação** | Médio | Escapar células iniciadas por `= + - @ \t \r` |
| S8 | **XSS** | Médio | React escapa por padrão; proibido `dangerouslySetInnerHTML` com dado de usuário; CSP com nonce |
| S9 | **Dados de pacientes em logs** | Médio | Logger com lista de campos permitidos; Sentry com `beforeSend` removendo corpo de requisição |
| S10 | **Perda de dados** | Crítico | Plano pago com backups diários + PITR (avaliar); exportação lógica semanal para armazenamento separado; teste de restauração trimestral |
| S11 | **Acesso indevido do suporte** | Alto | Admin não vê pacientes (D-12); qualquer acesso futuro é solicitado, temporário e auditado |
| S12 | **Dados reais no desenvolvimento** | Alto | Seeds 100% fictícios (gerador com nomes/telefones inválidos, ex.: `+55 11 90000-0001`); proibição documentada; staging nunca recebe cópia de produção |

## 3. Controles transversais
- HTTPS obrigatório, HSTS, cookies `Secure; HttpOnly; SameSite=Lax`.
- Cabeçalhos: CSP, `X-Content-Type-Options`, `Referrer-Policy: strict-origin-when-cross-origin`, `Permissions-Policy` restritiva.
- Validação de entrada com Zod no servidor em **toda** ação, mesmo que o cliente já valide.
- Dados pessoais nunca em URL ou query string (o token de status é exceção necessária: aleatório, sem dado pessoal, com `Referrer-Policy: no-referrer` na página).
- Dependências: Dependabot + `npm audit` no CI.
- Região do banco: **São Paulo** (menor latência e simplifica a análise de transferência internacional do banco; Vercel/e-mail ainda envolvem outros países).

## 4. Auditoria
Registrado em `audit_logs` (só-anexar):
login/logout/falhas, convites e mudanças de papel, criação/edição/exclusão de pacientes,
mudanças de status de agendamento, lançamentos financeiros, importações, **exportações**,
mudanças de configuração, ações de admin da plataforma, suspensões.
Gestor vê a auditoria da própria clínica (filtros por pessoa, ação, período).

## 5. Direitos do titular (art. 18)
O paciente exerce direitos **junto à clínica**. A plataforma oferece à clínica ferramentas para:
localizar todos os dados de um paciente, exportá-los, corrigi-los e anonimizá-los/excluí-los
(respeitando obrigações de guarda). Fluxo detalhado na Fase 10.

## 6. Retenção (proposta inicial, a validar)

| Dado | Retenção |
|------|----------|
| Dados da clínica ativa | Enquanto houver contrato |
| Após cancelamento | 90 dias leitura/exportação + exclusão com aviso |
| Solicitações públicas recusadas/expiradas sem paciente vinculado | Anonimizar contato após 90 dias |
| Arquivos de importação | 7 dias |
| Arquivos de exportação | 24 h |
| Logs de auditoria | 5 anos |
| Backups | Conforme plano do provedor (tipicamente 7–30 dias) |
| Prontuário (futuro) | Mínimo legal aplicável (ex.: 20 anos — Lei 13.787/2018), analisado na fase própria |
