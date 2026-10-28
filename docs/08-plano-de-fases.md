# 08 — Plano de fases

Cada fase termina com uma **revisão de validação**: demonstração, checagem dos critérios de
aceitação e aprovação explícita antes de iniciar a seguinte.

---

## Fase 1 — Arquitetura e especificação
- **Objetivo:** alinhar produto, arquitetura, dados, permissões e design antes de qualquer código.
- **Escopo:** esta documentação.
- **Dependências:** nenhuma.
- **Aceite:** decisões D-01 a D-14 respondidas ou explicitamente adiadas; escopo do MVP aprovado.
- **Testes:** revisão dos documentos.
- **Riscos:** requisitos mudarem depois da modelagem → mitigado por migrações versionadas e decisões registradas.

## Fase 2 — Design system e protótipo navegável
- **Objetivo:** validar a experiência visual e os fluxos principais com dados fictícios.
- **Escopo:** projeto Next.js + Tailwind + shadcn; `tokens.css`; componentes base; telas:
  login, onboarding (4 perguntas + revisão), Início (3 variações por perfil, alternáveis),
  agenda (dia/semana/mês, painel lateral, criar/remarcar/cancelar simulados),
  página pública (fluxo completo no celular), fila de aprovação. Dados em memória
  (fixtures), **sem Supabase**. Deploy no Vercel Hobby para revisão.
- **Dependências:** Fase 1 aprovada; D-01 (nome) pode ser provisório.
- **Aceite:** todos os fluxos F1, F2, F4 e F5 navegáveis ponta a ponta; funciona em 375 px, 768 px e 1440 px; `axe` sem violações graves; navegação por teclado completa.
- **Testes:** Playwright de fumaça por fluxo; `axe`; teste de contraste dos tokens; teste de usabilidade com 3–5 pessoas (recepcionista, profissional, paciente) com roteiro de tarefas.
- **Riscos:** protótipo virar produto sem a base de segurança → código de telas reaproveitado, camada de dados reescrita na Fase 3; vidro com desempenho ruim em máquinas fracas → testar em notebook de entrada e Android intermediário.

### Status da Fase 2 (2026-10-27)

| Critério de aceitação | Resultado |
|-----------------------|-----------|
| F1, F2, F4 e F5 navegáveis ponta a ponta | ✅ Verificados no navegador (onboarding → Início; criar/cancelar/desfazer; solicitação pública → aprovação → status "Confirmado") |
| Funciona em 375 px, 768 px e 1440 px | ✅ Sem rolagem horizontal da página em 320, 375, 768 e 1366 px; agenda vira lista no celular |
| `axe` sem violações graves | ✅ 0 violações WCAG 2.2 AA (axe-core) em todas as telas, nos 3 perfis, desktop e celular |
| Navegação por teclado completa | ✅ Grade da agenda com tabindex itinerante e setas; busca de paciente por teclado; foco devolvido nos diálogos. ⚠️ Falta revisão manual com leitor de tela |
| Teste de contraste dos tokens | ✅ `src/styles/tokens.test.ts` (corrigiu 3 cores da agenda) |
| Playwright de fumaça por fluxo | ❌ Não feito — os fluxos foram testados manualmente no navegador |
| Usabilidade com 3–5 pessoas | ❌ Depende de você (roteiro sugerido: marcar paciente por telefone, aprovar solicitação, agendar pelo celular) |
| Inspeção visual (vidro, sombras, tipografia) | ⚠️ Não foi possível capturar telas durante o teste; revisar visualmente |

Simulado no protótipo (vira real na Fase 3+): autenticação, verificação anti-robô, e-mail ao
paciente, hash do token (aqui fica em claro), restrição `no_overlap` (simulada em `rules.ts`).

## Fase 3 — Autenticação, organizações e permissões
- **Objetivo:** base multiempresa segura.
- **Escopo:** Supabase local (CLI) e staging; migrações de organizações, unidades, perfis, memberships, permissões, auditoria; login, convite, redefinição, MFA opcional; seletor de clínica; onboarding persistido; `requirePermission`; RLS + funções `app.*`.
- **Dependências:** Fase 2 aprovada.
- **Aceite:** usuário cria clínica, convida membros com papéis, papéis aplicados no servidor e no banco; 0 falhas no teste de isolamento.
- **Testes:** pgTAP de isolamento e matriz de papéis; e2e de login/convite; teste de que a service role não está em nenhum bundle do cliente (verificação no build).
- **Riscos:** políticas RLS lentas ou recursivas → funções `security definer`, índices, `explain` nas consultas críticas.

## Fase 4 — Profissionais, serviços e pacientes
- **Objetivo:** cadastros essenciais.
- **Escopo:** CRUD com busca, duplicidade de pacientes, vínculo profissional↔serviço, histórico do paciente (vazio até a Fase 5), limites de plano (estrutura).
- **Dependências:** Fase 3.
- **Aceite:** RN-40 a RN-43; profissional vê só pacientes próprios (RLS).
- **Testes:** unitários de normalização (telefone, nome); pgTAP; e2e de cadastro.
- **Riscos:** busca lenta por nome → `pg_trgm`.

## Fase 5 — Agenda administrativa
- **Objetivo:** substituir a agenda em papel/Google.
- **Escopo:** disponibilidade, bloqueios, férias, feriados; cálculo de horários; visualizações; painel lateral; criar/remarcar/cancelar; status e histórico; arrastar com alternativa por botão.
- **Dependências:** Fase 4.
- **Aceite:** RN-10 a RN-25; criar agendamento em ≤ 3 passos; conflito impossível mesmo com 2 requisições simultâneas.
- **Testes:** unitários do cálculo de horários (fuso, buffer, bloqueios, virada de dia); teste de concorrência (N requisições paralelas no mesmo horário → só 1 sucesso); e2e; desempenho da semana com 10 profissionais (< 300 ms no servidor).
- **Riscos:** complexidade do componente de agenda → começar pela visão dia/lista, depois semana, depois mês.

## Fase 6 — Agendamento público e aprovação
- **Objetivo:** paciente solicita, clínica aprova.
- **Escopo:** página `/agendar/[slug]`, funções públicas `security definer`, Turnstile, limites de taxa, reserva e expiração (`pg_cron`), token de status, fila de aprovação, vínculo com paciente, e-mails transacionais (se D-07 aprovada), aviso de privacidade versionado, configurações de agendamento online.
- **Dependências:** Fase 5; D-07, D-08, D-09.
- **Aceite:** RN-30 a RN-37; fluxo ≤ 60 s no celular; anon sem acesso direto a tabelas.
- **Testes:** e2e mobile; testes de abuso (flood, token inválido, enumeração de slug/token); concorrência entre público e recepção; Lighthouse mobile ≥ 90 em desempenho e acessibilidade.
- **Riscos:** spam; e-mails caindo em spam (SPF/DKIM no domínio).

## Fase 7 — Importação e exportação
- **Objetivo:** facilitar a migração e garantir portabilidade.
- **Escopo:** fluxo F6 e F7; `import_jobs`; `external_identifiers` com origem; modelos de planilha; relatório.
- **Dependências:** Fase 4 (entidades); Fase 3 (auditoria).
- **Aceite:** RN-60 a RN-65; importar 10.000 pacientes fictícios sem travar a interface.
- **Testes:** arquivos malformados, codificações (UTF-8, Latin-1), separadores `;` e `,`, injeção CSV, XLSX com macros/fórmulas, duplicados, arquivos grandes.
- **Riscos:** limite de tempo de função serverless → processamento em lotes; bibliotecas XLSX vulneráveis → escolher pacote mantido.

## Fase 8 — Financeiro básico
- **Objetivo:** controle simples de entradas e saídas.
- **Escopo:** lançamentos, categorias, pendentes, status, resumo por período, "registrar recebimento" a partir do agendamento.
- **Dependências:** Fase 5.
- **Aceite:** RN-50 a RN-54; recepção lança mas não vê resumo (se D-06 confirmar).
- **Testes:** unitários de somas em centavos e períodos/fuso; pgTAP de permissões.
- **Riscos:** pressão para virar ERP → manter fora o que está em RN-54.

## Fase 9 — Administração SaaS e planos
- **Objetivo:** operar o negócio.
- **Escopo:** `/admin` (organizações, planos, limites, features, status de assinatura, suspensão/reativação), métricas agregadas de uso, cobrança manual registrada.
- **Dependências:** Fase 3.
- **Aceite:** RN-70 a RN-73; admin não acessa dados de pacientes.
- **Testes:** suspensão → escrita bloqueada no banco; reativação; limite de plano.
- **Riscos:** uso indevido da service role → área admin isolada, MFA obrigatório, tudo auditado.

## Fase 10 — Testes, segurança e preparação comercial
- **Objetivo:** pronto para o primeiro cliente real.
- **Escopo:** revisão de segurança (OWASP ASVS nível 2 como referência), teste de intrusão (interno ou contratado), plano de backup e restauração testado, termos de uso, política de privacidade, DPA, RIPD (relatório de impacto), plano de resposta a incidentes, contratação da infraestrutura comercial, monitoramento, domínio e e-mail profissional.
- **Dependências:** Fases 3–9; D-10.
- **Aceite:** restauração de backup testada; 0 achados críticos/altos abertos; documentos jurídicos revisados por profissional; infraestrutura com termos que permitem uso comercial.
- **Riscos:** custos e prazos jurídicos subestimados.

---

## Ordem e paralelismo

```
1 → 2 → 3 → 4 → 5 → 6
              ├──────→ 7   (pode ocorrer junto com 5/6)
              │       5 → 8
         3 ───┴──────────→ 9
                     todos → 10
```
