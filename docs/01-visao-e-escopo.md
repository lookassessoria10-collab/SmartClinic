# 01 — Visão do produto e escopo do MVP

## 1. Visão

Uma plataforma de gestão para clínicas e consultórios pequenos que **qualquer recepcionista
aprende em uma tarde**, mas que tem por baixo a arquitetura de um sistema que pode crescer para
redes com várias unidades.

**Frase-guia:** completa por dentro, simples por fora.

## 2. Para quem

| Persona | Contexto | O que mais importa |
|---------|----------|--------------------|
| **Ana, gestora e dentista** | Dona de consultório com 3 cadeiras, atende e administra. | Ver o dia de relance, saber o que está pendente, resumo financeiro sem planilha. |
| **Bruno, recepção** | Atende telefone, WhatsApp pessoal e balcão ao mesmo tempo. | Marcar/remarcar em segundos, aprovar solicitações, achar paciente pelo telefone. |
| **Carla, esteticista** | Profissional autônoma em clínica multidisciplinar. Usa o celular. | Ver os próprios atendimentos do dia e da semana. |
| **Diego, paciente** | Encontrou o link no Instagram da clínica. Está no celular. | Escolher horário em menos de 1 minuto, sem criar senha. |
| **Equipe da plataforma** | Opera o SaaS. | Cadastrar clínicas, controlar plano e status, sem enxergar pacientes. |

## 3. Princípios de produto

1. **Uma tarefa principal por tela.** Ações secundárias ficam em menus contextuais.
2. **Contexto antes de navegação.** Agendar acontece dentro da agenda (painel lateral), não em outra página.
3. **Recursos por configuração, não por segmento.** Um único produto; o onboarding liga/desliga módulos e sugere serviços.
4. **Padrões inteligentes.** Tudo vem pré-preenchido com o valor mais provável (duração do serviço, profissional habitual, próximo horário livre).
5. **Nada destrutivo sem confirmação e sem desfazer.** Cancelamentos e exclusões são reversíveis por um período.
6. **Segurança não é visual.** Esconder um botão nunca é o controle; o banco recusa.

### Checklist aplicado a cada funcionalidade

Toda especificação de tela responde, no topo do documento da funcionalidade:

> **Quem usa?** · **Problema** · **Tarefa principal** · **Nº de passos (meta)** · **Como reduzir esforço**

Exemplo — *Criar agendamento pela recepção*:
> Recepção · Marcar paciente que ligou · Escolher horário → paciente → serviço → salvar · **3 passos, ≤ 15 s** ·
> Clicar no horário já define profissional e início; busca de paciente por telefone com criação inline; duração vem do serviço.

## 4. Escopo do MVP

O MVP é o conjunto mínimo para uma clínica pequena **substituir caderno/planilha/agenda do Google**
e receber agendamentos online. Corresponde às Fases 3 a 8 + o mínimo das Fases 9 e 10.

### Dentro do MVP

| Área | Incluído |
|------|----------|
| Contas | Login e-mail/senha, convite de membros, redefinição de senha, MFA opcional, seletor de clínica |
| Onboarding | Questionário de 4 perguntas, sugestão de serviços e módulos, editável depois |
| Cadastros | Profissionais, serviços (duração, preço, visível no público), pacientes (campos mínimos) |
| Agenda | Dia/semana/mês, filtros, criar/remarcar/cancelar, bloqueios, disponibilidade, intervalos, férias, feriados, status |
| Agendamento público | Página por clínica, fluxo mobile-first, solicitação com aprovação, reserva temporária, link de status/cancelamento |
| Aprovação | Fila de solicitações com aprovar/recusar/sugerir outro horário* |
| Importação | CSV/XLSX de pacientes, profissionais e serviços com mapeamento, prévia, duplicidades, relatório |
| Exportação | CSV/XLSX dos dados da clínica, auditada |
| Financeiro | Recebimentos, despesas, pendentes, status, resumo por período |
| SaaS | Cadastro de clínicas, planos, limites, status de assinatura, suspensão (somente leitura) — tudo manual |
| Segurança | RLS, auditoria, testes de isolamento, backups do plano pago |

\* "Sugerir outro horário" é opcional; pode ir para pós-MVP se atrasar a Fase 6.

### Fora do MVP (arquitetura preparada)

- Prontuário clínico, odontograma, anamnese, prescrição.
- Múltiplas unidades na interface (o banco já suporta).
- Pacotes de sessões, recorrência, lista de espera.
- WhatsApp, SMS, campanhas.
- Gateway de pagamento, emissão fiscal, TISS/TUSS, integração bancária.
- HL7 FHIR, RNDS, integrações com operadoras e outros sistemas.
- Portal do paciente com conta e senha.
- App nativo (o web responsivo cobre o MVP; PWA pode ser avaliada).
- Tema escuro (tokens preparados).

## 5. Métricas de sucesso do MVP

| Métrica | Meta |
|---------|------|
| Tempo para uma clínica sair do cadastro até o link público funcionando | ≤ 15 min |
| Tempo médio para criar agendamento pela recepção | ≤ 15 s |
| Tempo para paciente concluir solicitação no celular | ≤ 60 s |
| Solicitações respondidas antes de expirar | ≥ 90% |
| Vazamentos entre clínicas em testes automatizados | 0 |
