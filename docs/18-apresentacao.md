# 18 — Apresentação pública da plataforma

> Status: **pronta (2026-11-02)**. Endereço: `/apresentacao` (ex.: `https://smart-clinic-weld-kappa.vercel.app/apresentacao`).

Página pública, sem login, que explica como o smartclin funciona. Fica fora das rotas
protegidas do proxy (`src/proxy.ts`), é estática (não consulta o banco) e usa apenas exemplos
ilustrativos — nenhum dado real de clínica ou paciente.

## O que tem

| Parte | Conteúdo |
|-------|----------|
| Página inicial | Abertura, "Escolha o seu caminho", trilhas por perfil (Gestão, Recepção, Profissional), cartões "Antes × Com o smartclin", teste rápido (6 perguntas), índice de capítulos, chamada para criar conta / entrar |
| Apresentação | 37 lâminas em 9 capítulos + abertura (inclui Módulos e Financeiro). Setas, Page Up/Down, Home/End, espaço, deslize no celular, F para tela cheia, Esc para sair, barra de progresso por capítulo, sumário com busca |
| Endereços | `#s/12` (completa, lâmina 12), `#t/recepcao/3` (trilha), âncoras da página inicial (`#trilhas`, `#teste`…) |

## Como editar

| O quê | Onde |
|-------|------|
| Texto e ordem das lâminas, capítulos, perfis de cada lâmina | `src/modules/presentation/content.tsx` (`SLIDES`, `CHAPTERS`) |
| Telas de exemplo (agenda, oportunidades, permissões…) | `src/modules/presentation/mockups.tsx` |
| Blocos de layout das lâminas | `src/modules/presentation/layouts.tsx` |
| Página inicial, cartões, teste rápido | `src/modules/presentation/home.tsx` |
| Navegação, sumário, tela cheia | `src/modules/presentation/deck.tsx`, `route.ts` |
| Animações | `src/app/apresentacao/apresentacao.css` (todas desligadas com "reduzir movimento") |

Regra: só apresentar o que existe; o que ainda não está pronto vai na lâmina "O que vem por
aí" como "Em breve". Contagens (capítulos, lâminas, minutos) são calculadas sozinhas.

## Testes

`src/modules/presentation/route.test.ts` (endereços, roteiro, trilhas, busca) e
`tests/e2e/apresentacao.spec.ts` (sem login, teclado, sumário, trilha, cartões, teste rápido,
axe em desktop e celular, sem rolagem horizontal).
