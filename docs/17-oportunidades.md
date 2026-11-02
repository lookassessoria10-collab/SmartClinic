# 17 — Módulo Oportunidades

> Status: **implementado (2026-11-02)**, plano e decisões O-1 a O-5 aprovados (D-25).
> Falta aplicar as migrações 0014–0015 no staging antes de publicar (§8). Muda o escopo do
> MVP: lista de espera, retornos e orçamentos estavam "fora do MVP" (docs/01 §4) e entram
> aqui na forma mínima.
>
> Uso no dia a dia: §10. Arquivos: §11. Testes: §12.

## 1. O que o projeto já tem

| Área | Situação | Onde |
|------|----------|------|
| Multiempresa | Toda tabela com `organization_id`; chaves compostas `(id, organization_id)` impedem ligar registros de clínicas diferentes; RLS em todas as tabelas (pgTAP 00 falha se faltar) | migrações 0002–0006, 0011–0012 |
| Papéis e permissões | `manager`, `reception`, `professional`; matriz `role_permissions`; `app.has_perm` (exige MFA quando ativo) e `app.org_writable` | 0003, 0005, 0010 |
| Agenda | Horário semanal, bloqueios (pausa, folga, férias, feriado), agendamentos com status `confirmed`, `cancelled`, `no_show`, `completed` (e `requested`/`expired` para a Fase 6), histórico em `appointment_events` | 0012 |
| Conflitos | Exclusão GiST `appointments_no_overlap` + `fits_schedule` no fuso da clínica; escrita só por funções (`create_appointment`, `reschedule_appointment`, `set_appointment_status`) | 0012 |
| Serviços | Duração, intervalo pós-atendimento, `price_cents` (opcional), quem realiza | 0011 |
| Pacientes | Só dados administrativos; profissional vê só os seus (D-06); auditoria guarda só nomes de campos | 0011–0012 |
| Cálculo de horários livres | `freeSlots()` puro e testado | `src/modules/availability/rules.ts` |
| Dados na tela | `loadClinicDb` lê com a sessão (RLS decide) → `useDb()`; ações por Server Actions + `revalidatePath` | `src/modules/clinic/*` |
| Segmento e fuso | `organizations.segment` e `organizations.timezone` | 0002 |
| Navegação | 5 itens: Início, Agenda, Pacientes, Financeiro ("Em breve"), Gestão (só gestão) | `src/components/app-shell.tsx`, `src/prototype/access.ts` |
| Testes | Vitest (118), pgTAP (6 arquivos), Playwright + axe (7 arquivos) no CI | `.github/workflows/ci.yml` |

## 2. O que não existe (dependências)

| Recurso | Situação | Proposta |
|---------|----------|----------|
| Lista de espera | Não existe | Criar mínima (§4) |
| Retornos registrados | Não existe | Criar mínima, sem dado clínico (§4) |
| Orçamentos/propostas | Não existe | Criar estrutura administrativa mínima (§4) |
| Financeiro (lançamentos) | Não existe (Fase 8) | **Não criar agora.** "Receita realizada" e "prevista" continuam como estimativa pelo preço do serviço, como já faz o Início, e a tela diz isso |
| Unidades na interface | Tabela `units` existe, mas agendamentos e profissionais não têm unidade | Filtro de unidade **fica oculto** até existir; documentado como limitação |
| Reserva temporária | Só para solicitações públicas (Fase 6) | O cálculo já trata `requested` com reserva válida como ocupado |
| Aprovação de agendamento | Agendamento pela equipe nasce confirmado (RN-21); fila pública é da Fase 6 | O módulo **nunca agenda sozinho**: só abre o agendamento já preenchido para a pessoa confirmar |
| Pré-preenchimento da agenda | `?novo=1` existe, sem profissional/horário | Ampliar para `?novo=1&profissional=&servico=&paciente=&inicio=` (compatível) |

## 3. Decisões recomendadas (aprovar ou ajustar)

| # | Tema | Recomendação | Alternativa |
|---|------|--------------|-------------|
| O-1 | Lugar na navegação | Rota `/c/<clínica>/inicio/oportunidades` (o menu marca "Início") + cartão-resumo no Início de cada papel. **Sem 6º item** | Área dentro de Gestão (só a gestora veria) |
| O-2 | Quem vê valores | Gestão vê todos; profissional vê os das próprias oportunidades (`finance.read_own`); recepção **não** vê valores (pode ser ligado nas configurações) | Recepção vê valores por padrão |
| O-3 | Onde roda a detecção | No banco (função `security definer`), sob demanda: ao abrir a tela, se a última atualização tiver mais de 10 min, e no botão "Atualizar". Sem cron, sem Realtime | `pg_cron` a cada hora (pode vir depois; a Fase 6 já prevê `pg_cron`) |
| O-4 | Orçamento | Cabeçalho + itens ligados a serviços (quantidade × preço), total calculado; sem campo clínico | Só título e valor total |
| O-5 | Regras | Ficam versionadas nas migrações (auditáveis e testadas no pgTAP); por clínica só os **parâmetros** (`opportunity_settings`), sem tabela `opportunity_rules` editável | Tabela de regras editável |

## 4. Banco (migrações 0014 e 0015)

Padrões mantidos: chaves compostas por organização, RLS, `has_perm`, escrita só por função,
auditoria "só nomes de campos" onde houver dado pessoal, nenhum `DELETE` direto.

**0014 — estruturas mínimas**

| Tabela | Campos principais | Regras |
|--------|-------------------|--------|
| `waiting_list` | paciente, serviço (opcional), profissional (opcional), dias da semana, período (manhã/tarde/noite), a partir de / até, observação administrativa curta, status (`waiting`, `booked`, `removed`), agendamento gerado | Um pedido ativo por paciente+serviço+profissional; vira `booked` quando agendado pela função `book_from_waiting_list` (mesma transação do agendamento, conflito barrado pela GiST) |
| `follow_ups` (retornos) | paciente, profissional, serviço (opcional), prazo (data), status (`pending`, `scheduled`, `done`, `cancelled`), agendamento que o atendeu, atendimento de origem (opcional) | Só retorno **cadastrado** por alguém; nada inferido do histórico. Sem texto clínico |
| `proposals` + `proposal_items` | paciente, profissional (opcional), título administrativo, itens (serviço, qtd, preço unitário), total, validade, status (`open`, `accepted`, `declined`, `cancelled`, `expired`), `last_activity_at` | Total calculado no banco; aceito/recusado deixa de contar como aberto |

**0015 — oportunidades**

| Tabela / função | Conteúdo |
|-----------------|----------|
| `opportunity_settings` | Uma linha por clínica, criada com padrões do segmento: categorias ativas, dias para proposta "sem atualização" (7), horizonte de horários (7 dias), prioridade por tipo, profissionais excluídos, "recepção vê valores" (não), "profissional vê as próprias" (sim) |
| `opportunities` | tipo, categoria, `dedupe_key` **única por clínica** (impede duplicata), profissional, paciente, serviço, agendamento/retorno/proposta de origem, janela de horário, prioridade, `value_cents` + `value_basis` (como foi calculado), status (`new`, `in_progress`, `resolved`, `dismissed`, `expired`), responsável, quem resolveu e quando, motivo do descarte |
| `opportunity_actions` | Histórico imutável: criada, contato (resultado: sem resposta, vai retornar, agendou, não quer agora), responsável, mudança de status, agendou, resolvida/expirada/reaberta pelo sistema. Quem e quando |
| `refresh_opportunities(org)` | Detecta e atualiza tudo de uma clínica, idempotente, com trava (`pg_advisory_xact_lock`) contra duas execuções ao mesmo tempo |
| `opportunities_feed(org, filtros, ordem, página)` | Lista paginada + indicadores agregados; **mascara valores** para quem não tem permissão (o valor não sai do banco) |
| `log_opportunity_contact`, `assign_opportunity`, `set_opportunity_status` | Ações; conferem permissão, organização e transição; gravam em `opportunity_actions` |

Permissões novas em `role_permissions`: `opportunities.read` e `opportunities.work`
(gestão, recepção), `opportunities.read_own` e `opportunities.work_own` (profissional:
só o que tem o seu `professional_id`). Configurações: `org.settings` (gestão), que já existe.
Responsável só pode ser membro ativo da mesma clínica.

## 5. Regras de detecção

| Tipo | Categoria | Detecta | Chave (sem duplicata) | Valor | Resolve sozinho quando | Expira |
|------|-----------|---------|------------------------|-------|------------------------|--------|
| A. Horários livres | Agenda | Por profissional e dia, nos próximos 7 dias: horário de atendimento − bloqueios (pausa, folga, férias, feriado) − agendamentos ativos (confirmado; solicitado com reserva válida) − horário já passado, no fuso da clínica | `slots:<profissional>:<data>` | Nº de horários **sem sobreposição** que cabem (duração + intervalo do serviço de referência) × preço. Serviço de referência = o mais agendado com o profissional em 90 dias; sem histórico, o mais curto. Sem preço → "indisponível" | Dia sem horário livre | Fim do dia |
| B. Horário liberado por cancelamento | Agenda | Agendamento futuro cancelado cujo horário continua livre; sugere pacientes da lista de espera compatíveis (serviço oferecido pelo profissional, profissional preferido, dia, período, duração cabe, janela de datas) | `cancel:<agendamento>` | Preço do serviço cancelado. O trecho sai da conta do tipo A (sem contar duas vezes) | Horário ocupado de novo | Início do horário |
| C. Retorno pendente | Pacientes | Retorno cadastrado `pending` com prazo vencido ou nos próximos 14 dias, **sem** agendamento futuro do paciente com o mesmo profissional (e serviço, se informado) | `return:<retorno>` | Preço do serviço do retorno, se houver (fora da soma de "em risco") | Paciente agendado → retorno vira `scheduled` | — |
| D. Orçamento sem atualização | Financeiro | Proposta `open` sem atividade há N dias (padrão 7) | `proposal:<proposta>` | Total da proposta, em **"Propostas pendentes"**, separado e nunca tratado como perdido | Proposta aceita, recusada, cancelada ou vencida | Validade da proposta |
| E. Falta ou cancelamento sem remarcação | Pacientes | `no_show` ou `cancelled` nos últimos 30 dias sem agendamento posterior do paciente | `no_show:<ag>` / `cancelled:<ag>` | Sem valor somado (o horário já entrou em A/B) | Paciente agendado de novo | 30 dias |

Textos neutros: "Faltou em 12/10 — sem novo agendamento", nunca "perdeu o interesse".
Reabertura: só pelo sistema, quando a resolução foi automática e a condição volta (ex.: o
agendamento que resolveu o retorno é cancelado). Resolvida ou descartada à mão não reabre.

**Prioridade** (alta, média, baixa): padrão por segmento, ajustável:

| Tipo | Medicina | Odontologia | Estética | Multidisciplinar/outro |
|------|----------|-------------|----------|------------------------|
| A. Horários livres | alta (≤ 2 dias) / média | média | alta (≤ 2 dias) / média | média |
| B. Cancelamento | alta | alta | alta | alta |
| C. Retorno | alta (vencido) / média | média | média | média |
| D. Orçamento | baixa | alta | alta | média |
| E. Falta/cancelamento | alta | média | média | média |

## 6. Valores (transparentes)

| Indicador | Conta | Observação na tela |
|-----------|-------|--------------------|
| Receita potencial em risco | Soma de A + B das oportunidades abertas | "Estimativa pelo preço dos serviços; não é faturamento garantido." Toque mostra a conta de cada item |
| Em propostas pendentes | Soma de D abertas | Linha separada, nunca somada à anterior |
| Horários disponíveis | Nº de horários de A + B no período | — |
| Em aberto / Resolvidas | Contagem por status no período | — |

Receita realizada e prevista continuam no Início, rotuladas como estimativa, até o
Financeiro (Fase 8). Faltando preço, a tela mostra "Valor indisponível: informe o preço do
serviço", com link para Serviços.

## 7. Interface

- Cabeçalho "Oportunidades" + subtítulo pedido; botão "Atualizar" com "atualizado há X min".
- 4 indicadores (`Stat`, como no Início); filtros de período (7/14/30 dias) e profissional;
  abas Todas · Agenda · Pacientes · Financeiro · Resolvidas; ordenar por prioridade, valor, data.
- Cartão por oportunidade: ícone Lucide do tipo, título curto, contexto em uma linha,
  prioridade, valor (ou nada, se mascarado), ação principal (Agendar, Ver na agenda,
  Registrar contato, Abrir proposta) e menu (Atribuir, Resolver, Descartar com motivo, Histórico).
- Painel lateral (`Sheet`, já existe) com histórico, "como calculamos" e sugestões da lista
  de espera; "Copiar telefone" para contato manual. **Sem WhatsApp automático.**
- Estados: carregando (esqueleto), vazio útil ("Nada pendente. Cadastre retornos e
  orçamentos para acompanhar aqui"), erro com "Tentar de novo".
- Lista de espera e retornos: cadastro a partir do paciente e do agendamento. Orçamentos:
  seção no painel do paciente + lista em Oportunidades → Financeiro.
- Configurações: Gestão → nova área "Oportunidades" com poucos campos e padrões prontos.
- Vidro só no painel lateral e nos menus, como no resto; teclado, foco e contraste testados com axe.

## 8. Etapas

| Etapa | Entrega | Testes |
|-------|---------|--------|
| 2 | Migrações 0014–0015, permissões, RLS, funções | pgTAP: isolamento A×B, valores mascarados, dedupe, transições, histórico |
| 3 | Motor (`refresh_opportunities`) e `opportunities_feed` | pgTAP por regra: cancelamento libera horário, bloqueio impede sugestão, sem dupla contagem, retorno agendado some, orçamento fechado some, conflito da lista de espera barrado |
| 4 | Tela, cartões, filtros, painel, configurações | Vitest de formatação/filtros; axe em 375 px e 1440 px |
| 5 | Agendar pré-preenchido, lista de espera, retornos, orçamentos | Playwright: cancelar → sugestão → agendar; registrar contato; descartar |
| 6 | CI verde em branch | — |
| 7 | Documentação (este arquivo vira o guia do módulo; docs 03, 04, 07, 11 atualizados) | — |

Publicação: branch → CI → `main`, e **antes** do deploy aplicar 0014–0015 no staging
(`supabase db push --linked`), com sua confirmação.

## 9. Limitações já conhecidas

- Sem unidades na interface: filtro de unidade oculto.
- Sem financeiro real: valores são estimativas pelo preço do serviço.
- Horários na tela seguem o fuso do navegador (limitação existente, docs/16 §3); o banco usa o da clínica.
- `database.types.ts` atualizado à mão (Docker local indisponível), como nas migrações 0011–0013.
- Preço dos serviços já é legível por todos os membros (comportamento atual de Serviços);
  o módulo esconde os **totais e valores das oportunidades**, não o preço de tabela.

## 10. Como usar

| Onde | O quê |
|------|-------|
| Início → cartão **Oportunidades** → "Ver todas" | `/c/<clínica>/inicio/oportunidades`: indicadores, filtros (período, profissional, ordem), abas Todas · Agenda · Pacientes · Financeiro · Resolvidas |
| Cartão → **Agendar** | Abre a agenda já preenchida (profissional, primeiro horário livre, serviço e, quando houver, paciente). A pessoa confirma; o banco confere conflito e horário de atendimento |
| Cartão → **Detalhes** / **Ver sugestões** | Como o valor foi calculado, trechos livres, pacientes compatíveis da lista de espera ("Agendar às HH:mm"), copiar telefone, registrar contato, responsável, resolver, descartar com motivo, histórico |
| Abas **Lista de espera**, **Retornos**, **Orçamentos** | Cadastro e acompanhamento de cada estrutura (§4) |
| Agenda → atendimento → **Registrar retorno** | Retorno combinado no atendimento (prazos rápidos de 7 a 90 dias) |
| Pacientes → cadastro → **Acompanhamento** | Retornos, pedidos na lista de espera e orçamentos do paciente, com atalhos |
| Gestão → **Oportunidades** | Tipos ativos, prioridade por tipo, prazos, profissionais incluídos, quem vê valores |

Atualização: sozinha ao abrir a tela quando algo mudou (marca `stale`) ou a cada 10 min;
botão "Atualizar" força na hora. Agendar a partir de uma oportunidade grava "Agendamento
feito" no histórico com quem agendou.

## 11. Arquivos

| Camada | Arquivos |
|--------|----------|
| Banco | `supabase/migrations/20261103000014_waitlist_followups_proposals.sql`, `20261103000015_opportunities.sql` |
| Regras de tela e validação | `src/modules/opportunities/{labels,filters,schemas,booking}.ts` |
| Ações do servidor | `src/modules/opportunities/actions.ts`; `createAppointment` aceita `opportunityId` (`src/modules/scheduling/actions.ts`) |
| Telas | `src/app/c/[org]/inicio/oportunidades/{page,espera,retornos,orcamentos}`, `src/app/c/[org]/gestao/oportunidades`; componentes em `src/modules/opportunities/components/` |
| Integrações | Início (cartão), Gestão (área), agenda (pré-preenchimento `?novo=1&profissional=&inicio=&servico=&paciente=&oportunidade=&espera=`), painel do agendamento (Registrar retorno), Pacientes (`?id=` e Acompanhamento), `loadClinicDb` |
| Tipos | `src/prototype/types.ts`, `src/server/database.types.ts` (à mão, §9) |

## 12. Testes

| Tipo | Arquivo | Cobre |
|------|---------|-------|
| pgTAP | `supabase/tests/database/06_opportunities.test.sql` | Clínica A × B, valores mascarados (recepção, coluna sem GRANT), profissional só os próprios, cancelamento libera horário, sem dupla contagem, lista de espera compatível e atômica, horário sobreposto recusado, sem duplicatas, retorno agendado some e volta se cancelado, orçamento fechado some, descarte com motivo e sem reabertura manual, bloqueio impede sugestão, configurações |
| Vitest | `src/modules/opportunities/opportunities.test.ts` | Filtros da URL, textos neutros, valores e "como calculamos", validação das ações, primeiro horário agendável e link para a agenda |
| Playwright | `tests/e2e/oportunidades.spec.ts`, `tests/e2e/a11y.spec.ts` | Tela com indicadores e detalhes; cancelar → lista de espera → agendar → resolvida; descarte com motivo; axe em todas as telas novas e no celular (375 px, sem rolagem horizontal) |
