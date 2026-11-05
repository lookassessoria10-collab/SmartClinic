# 19 — Módulos por clínica e Financeiro

> Status: **implementado (2026-11-05)**, decisão D-26. Migração 0016. Antecipa a Fase 8
> (Financeiro básico) a pedido do cliente; Fases 6 e 7 continuam pendentes.

## 1. Módulos

No onboarding, logo depois do nome e do tipo de estabelecimento, a pessoa escolhe o que vai usar:

| Módulo | O que liga | Regra |
|--------|-----------|-------|
| Agenda e pacientes (`schedule`) | Agenda, Pacientes, Horários, Serviços, Agendamento online (em breve) | Sem Agenda, o onboarding pula equipe e serviços e não cria profissional |
| Oportunidades (`opportunities`) | Início → Oportunidades, lista de espera, retornos, orçamentos | Exige a Agenda (o banco recusa sem ela) |
| Financeiro (`finance`) | Financeiro (lançamentos, relatório, categorias) | Cria as categorias iniciais ao ligar |

- Gestão → **Módulos** liga e desliga depois (permissão `org.settings`). Desligar esconde do menu
  de todos; **nenhum dado é apagado** e tudo volta ao religar.
- Clínicas criadas antes da 0016 ficaram com tudo ligado. Clínica sem nenhuma linha em
  `organization_features` é tratada como "tudo ligado" (no banco e na tela).
- Sem Agenda, o Início vira o resumo financeiro do mês com atalhos.
- A área de um módulo desligado mostra "Este módulo está desligado" (gestão vê o atalho para ligar).

## 2. Financeiro

| Recurso | Detalhe |
|---------|---------|
| Lançamentos | Receita ou despesa; descrição, valor (centavos), categoria, vencimento, pago/recebido em, forma de pagamento (Pix, dinheiro, débito, crédito, transferência, boleto, outra), paciente e profissional opcionais, observação administrativa |
| Situação | Pendente, Pago, Cancelado; **Atrasado** = pendente vencido (calculado, não guardado) |
| Repetição | "Todo mês" (N lançamentos iguais) ou "Parcelado" (total dividido; o resto dos centavos vai na 1ª parcela); vencimentos mês a mês; "Parcela 2 de 3" / "Mensal 1 de 12" |
| Cancelar | Nunca apaga; pode cancelar também os próximos pendentes da série |
| Recebimento do atendimento | Na agenda, "Registrar recebimento" cria a receita paga ligada ao atendimento, paciente e profissional (preço do serviço sugerido); **um por atendimento** (índice único) |
| Categorias | Iniciais: Atendimentos, Procedimentos, Venda de produtos, Outras receitas; Aluguel, Salários e pró-labore, Materiais e insumos, Impostos e taxas, Marketing, Contas de consumo, Outras despesas. Renomear, criar, desativar (some dos novos lançamentos) |
| Relatório | Período (este mês, mês passado, 3 meses, ano, personalizado até 2 anos): recebido, pago, resultado, a receber/pagar, em atraso; por categoria, forma de pagamento, profissional e mês (gráfico + tabela). Exporta CSV (`;`, abre no Excel, sem nome de paciente) e imprime |

Realizado é contado pela **data do pagamento**; previsto pelo **vencimento**; cancelados não entram.
Com o Financeiro ligado, o card "Financeiro do mês" do Início da gestão usa os lançamentos reais
(sem o módulo, continua a estimativa pelo preço dos serviços).

## 3. Quem faz o quê (D-26)

| | Gestão | Recepção | Profissional |
|--|:--:|:--:|:--:|
| Lançar e receber **receitas** | ✅ | ✅ | — |
| Lançar e pagar **despesas** | ✅ | — | — |
| Ver despesas, totais, relatório e CSV | ✅ | — | — |
| Ver receitas dos próprios atendimentos | ✅ | ✅ | ✅ (só leitura no banco; sem tela por enquanto) |
| Categorias e Módulos | ✅ | — | — |

Tudo conferido no banco (RLS e funções `security definer`), não só na tela.

## 4. Banco (migração 0016)

| Objeto | Papel |
|--------|-------|
| `organization_features` | Módulo ligado/desligado por clínica |
| `financial_categories` | Categorias por tipo; nome único por clínica e tipo (sem diferenciar maiúsculas) |
| `financial_entries` | Lançamentos; chaves compostas por clínica; checagens: pago ⇔ data de pagamento, cancelado ⇔ data de cancelamento, atendimento só em receita |
| `create_organization(..., p_modules)` | Cria a clínica com os módulos escolhidos (padrão: todos, compatível com a chamada antiga) |
| `set_organization_modules` | Gestão → Módulos (auditado) |
| `save_financial_entry`, `set_financial_entry_status`, `receive_appointment`, `save_financial_category`, `finance_report` | Escrita e relatório; recusam com o módulo desligado |

Auditoria: lançamentos guardam só os nomes dos campos alterados (podem citar paciente);
categorias, a linha completa.

## 5. Onde está no código

| Parte | Arquivos |
|-------|----------|
| Regras e filtros | `src/modules/finance/{model,schemas}.ts` |
| Ações | `src/modules/finance/actions.ts` |
| Leitura | `src/modules/finance/server.ts`, `src/modules/clinic/server.ts` (módulos, recebimentos, mês) |
| Telas | `src/app/c/[org]/financeiro/{page,relatorio,categorias,exportar}`, `src/app/c/[org]/gestao/modulos`; componentes em `src/modules/finance/components/` |
| Menu por módulo | `src/prototype/access.ts` (`SECTION_MODULE`), `src/components/app-shell.tsx`, `src/components/require-module.tsx` |
| Onboarding | `src/app/onboarding/page.tsx`, `src/modules/organizations/{schemas,actions}.ts` |

## 6. Testes

- pgTAP `supabase/tests/database/07_modules_finance.test.sql`: módulos no onboarding e regra
  Oportunidades × Agenda; parcelas e repetição; pagar/cancelar série; recepção sem despesas nem
  relatório; profissional só os próprios; clínica B isolada; recebimento único por atendimento;
  relatório; módulo desligado bloqueia e não apaga.
- Vitest `src/modules/finance/finance.test.ts` e `src/modules/organizations/schemas.test.ts`.
- Playwright `tests/e2e/financeiro.spec.ts` (clínica só com Financeiro, ponta a ponta) e
  `tests/e2e/a11y.spec.ts` (telas novas no axe).

## 7. Limitações

- Sem conciliação bancária, nota fiscal, comissões ou fluxo de caixa projetado (docs/07 RN-54).
- Profissional ainda não tem tela das próprias receitas (o banco já permite a leitura).
- Datas do relatório no fuso do servidor para o "mês atual" do Início (diferença possível só na
  virada do mês).
