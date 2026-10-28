# Plataforma SaaS de Gestão para Clínicas — Documentação

> Status: **Fases 1 e 2 aprovadas · Fase 3 em andamento** (ver progresso em `docs/12-fase-3-plano.md`)
> Nome do produto: **a definir** (ver D-01 em `docs/11-decisoes.md`)
> Última atualização: 2026-10-27

## Protótipo (Fase 2)

Protótipo navegável com **dados 100% fictícios**, sem backend: tudo roda no navegador e fica
no `localStorage`. Nada é enviado a servidores externos.

```bash
npm install
npm run dev        # http://localhost:3000
npm test           # regras de agenda + contraste dos tokens (Vitest)
npm run lint
```

Banco local (Fase 3, requer Docker Desktop):

```bash
npm run db:start   # sobe o Supabase local e aplica supabase/migrations
npm run db:test    # testes pgTAP de isolamento e permissões
```

| Rota | O que demonstra |
|------|-----------------|
| `/login` | Login (qualquer e-mail/senha; nada é verificado) |
| `/onboarding` | Questionário de 4 perguntas + revisão das sugestões |
| `/c/clinica-aurora/inicio` | Início adaptado a Recepção, Profissional e Gestora |
| `/c/clinica-aurora/agenda` | Dia/Semana/Mês, filtros, painel lateral para criar, remarcar, cancelar (com desfazer) |
| `/c/clinica-aurora/agenda/solicitacoes` | Fila de aprovação com detecção de paciente existente |
| `/agendar/clinica-aurora` | Página pública mobile-first (serviço → profissional → horário → dados) |
| `/agendar/clinica-aurora/status/<token>` | Status e cancelamento pelo link seguro |

**Faixa escura no topo:** troca o perfil ("Visualizar como") e restaura os dados de demonstração.
Abrir a página pública e a agenda em abas separadas mostra a sincronização entre as duas.

Pacientes e Gestão têm versões simplificadas; Financeiro é um estado vazio (Fase 8).

## Índice

| # | Documento | Conteúdo |
|---|-----------|----------|
| 00 | [Análise de requisitos](docs/00-analise-requisitos.md) | Conflitos, lacunas e premissas |
| 01 | [Visão do produto e escopo do MVP](docs/01-visao-e-escopo.md) | Público, princípios, o que entra e o que não entra |
| 02 | [Arquitetura técnica](docs/02-arquitetura.md) | Stack, monólito modular, mapa de módulos, estrutura de pastas |
| 03 | [Modelo de dados](docs/03-modelo-de-dados.md) | Tabelas, relacionamentos, restrições, RLS |
| 04 | [Perfis e permissões](docs/04-perfis-e-permissoes.md) | Papéis, matriz de permissões, aplicação em 3 camadas |
| 05 | [Navegação e fluxos](docs/05-navegacao-e-fluxos.md) | Mapa de navegação, telas iniciais por perfil, fluxos principais |
| 06 | [Design system](docs/06-design-system.md) | Tokens, componentes, regras do efeito glass, acessibilidade |
| 07 | [Regras de negócio](docs/07-regras-de-negocio.md) | Agenda, agendamento público, pacientes, financeiro, assinaturas |
| 08 | [Plano de fases](docs/08-plano-de-fases.md) | 10 fases com objetivo, escopo, dependências, aceite, testes e riscos |
| 09 | [Segurança e LGPD](docs/09-seguranca-e-lgpd.md) | Ameaças, controles, retenção, auditoria |
| 10 | [Custos](docs/10-custos.md) | Gratuito agora, custos previstos antes do uso comercial |
| 11 | [Decisões](docs/11-decisoes.md) | Registro de decisões (ADRs) e itens que exigem aprovação |
| 12 | [Plano da Fase 3](docs/12-fase-3-plano.md) | Autenticação, organizações e permissões com Supabase |

## Regras de manutenção

- Toda decisão estrutural nova vira uma entrada em `docs/11-decisoes.md` antes de ser implementada.
- Ao concluir cada fase, os documentos afetados são atualizados no mesmo commit/PR da implementação.
- Nenhuma fase começa sem validação explícita da anterior.
