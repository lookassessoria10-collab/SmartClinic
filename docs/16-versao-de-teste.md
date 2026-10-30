# 16 — Versão para testadores (Fases 4 e 5: cadastros e agenda reais)

> Status: **em andamento (2026-10-29)**. Decisões D-22 a D-24 em [11](11-decisoes.md).

## 1. Objetivo

Deixar a plataforma usável no dia a dia de uma clínica, para pessoas convidadas testarem
**com dados fictícios**: sem nada de demonstração nas telas da clínica.

| Etapa | Fica real | Status |
|-------|-----------|--------|
| **A. Cadastros** (Fase 4) | Profissionais (conta da equipe ligada, cor, conselho, serviços), Serviços (duração, intervalo, preço, quem realiza), Pacientes (busca, duplicidade, edição, exclusão lógica, histórico) | Em teste |
| **B. Agenda** (Fase 5) | Horário de atendimento semanal, bloqueios (feriado, férias, folga, pausa), agenda dia/semana/mês com criar, remarcar, concluir, falta e cancelar; Início com números reais; onboarding cria serviços e horário inicial | Em teste |
| C. Agendamento online (Fase 6) | Página pública, fila de aprovação, anti-robô | Depois da rodada de testes |
| D. Financeiro (Fase 8) | Recebimentos e despesas | Depois de C |

Telas que ainda não são reais mostram **"Em breve"**, nunca dados inventados: Financeiro,
Solicitações, página pública `/agendar/<clínica>`, Importar/Exportar, Assinatura.

## 2. Banco (migrações 0011 e 0012)

| Tabela / função | Regra garantida no banco |
|-----------------|--------------------------|
| `services`, `professional_services` | Chaves compostas `(id, organization_id)`: impossível ligar serviço de uma clínica a profissional de outra |
| `patients` | Profissional vê os que cadastrou e os que atende (D-06); recepção e gestão veem todos; exclusão só lógica por `delete_patient` (não exclui com agendamento futuro); auditoria guarda **só os nomes dos campos**, nunca os dados |
| `availability_rules` + `set_weekly_availability` | Semana substituída inteira; faixas sobrepostas recusadas |
| `schedule_blocks` | Clínica inteira (gestão/recepção) ou de um profissional (o próprio pode bloquear a sua) |
| `appointments` | Exclusão GiST: **dois atendimentos ativos do mesmo profissional nunca se sobrepõem**, mesmo com cliques simultâneos; escrita só por `create_appointment`, `reschedule_appointment`, `set_appointment_status` |
| `fits_schedule` | Agendamento só dentro do horário de atendimento (no fuso da clínica) e fora de bloqueios |
| `schedule_busy` | Profissional vê a agenda dos colegas só como "Ocupado" (ADR-015) |
| `appointment_events` | Histórico imutável: quem mudou, de/para qual status, motivo |

## 3. Aplicação

- `src/modules/clinic/server.ts` carrega, com a sessão da pessoa, tudo que agenda, pacientes
  e Início usam (janela de 90 dias para trás e 240 para frente). A RLS decide o que entra.
- Ações em `src/modules/{catalog,patients,scheduling}/actions.ts`; depois de cada uma o
  layout é revalidado e a tela recebe os dados novos.
- O armazenamento falso do protótipo (`localStorage`) foi removido.

**Fuso horário:** a agenda mostra os horários no fuso do navegador, e o banco confere o
horário de atendimento no fuso da clínica (`America/Sao_Paulo`). Para testadores no Brasil
os dois coincidem; clínicas em outros fusos ficam para quando houver unidades (Fase futura).

## 4. Rodada de testes

1. SMTP próprio no staging (D-24): sem ele, só membros da equipe do Supabase recebem e-mail.
2. Convidar 3–5 pessoas de clínicas (gestor, recepção, profissional) com o roteiro:
   cadastrar profissionais e serviços → horários → paciente → agendar → remarcar → concluir/falta.
3. Coletar dúvidas e travas; ajustar antes da etapa C.
