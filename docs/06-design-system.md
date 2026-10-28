# 06 — Design system

## 1. Direção

**Calma clínica.** Superfícies claras, tipografia precisa, uma única cor de destaque, vidro apenas
onde algo "flutua" sobre o conteúdo. Inspirado nos princípios das Human Interface Guidelines
(clareza, deferência ao conteúdo, profundidade), **sem copiar** ícones, fontes proprietárias
(SF Pro), componentes ou identidade da Apple.

Elementos de identidade própria:
- Cor de destaque **azul-petróleo** (não o azul de sistema da Apple).
- Fonte aberta **Inter** (licença OFL), com algarismos tabulares em agenda e financeiro.
- Ícones **Lucide** com traço 1,75 px, sempre acompanhados de rótulo em navegação.
- Assinatura visual: o "vidro" usa um leve tom do azul-petróleo na borda superior (realce), em vez de branco puro.

## 2. Tokens

Definidos como CSS custom properties em `src/styles/tokens.css` e expostos ao Tailwind
(`theme.extend`). Componentes **só** usam tokens — nunca hex/px soltos. Tema escuro: os mesmos
nomes de token com outros valores (preparado, não entregue no MVP).

### Cores — neutros

| Token | Valor | Uso |
|-------|-------|-----|
| `--color-bg` | `#FFFFFF` | Fundo de conteúdo |
| `--color-bg-subtle` | `#F6F7F9` | Fundo da aplicação, áreas recuadas |
| `--color-bg-muted` | `#EEF0F3` | Hover, trilhas, cabeçalho de tabela |
| `--color-border` | `#E3E6EA` | Bordas e divisores |
| `--color-border-strong` | `#C9CED6` | Bordas de campos |
| `--color-text` | `#14171C` | Texto principal (contraste 17:1) |
| `--color-text-secondary` | `#4D5562` | Texto de apoio (≈ 7,5:1) |
| `--color-text-tertiary` | `#6B7280` | Placeholders, metadados (≈ 4,8:1 — mínimo AA). **Só sobre `--color-bg`/`--color-bg-subtle`**: sobre fundos tingidos (seleção, badges) cai abaixo de 4,5:1 — use `--color-text-secondary` |

### Cores — destaque e status

| Token | Valor | Contraste c/ branco | Uso |
|-------|-------|:---:|-----|
| `--color-accent` | `#1F6F8B` | ≈ 5,7:1 | Ação primária, seleção, links |
| `--color-accent-hover` | `#185A72` | | |
| `--color-accent-subtle` | `#E6F1F5` | | Fundo de item selecionado |
| `--color-success` | `#1E7A4C` | ≈ 5,4:1 | Confirmado, pago |
| `--color-warning` | `#8A5A00` | ≈ 5,9:1 | Aguardando, pendente |
| `--color-danger` | `#B42335` | ≈ 6,3:1 | Erro, recusado, cancelado |
| `--color-info` | `#2B5FB8` | ≈ 5,9:1 | Informativo |
| `--color-*-subtle` | tons claros de cada um | | Fundos de badge/alerta |

Valores de contraste são estimativas e serão verificados automaticamente (teste de tokens na Fase 2).

**Cores de profissional na agenda:** paleta fixa de 8 tons (`--agenda-1` … `--agenda-8`),
usadas como faixa lateral do bloco + fundo claro; o texto do bloco é sempre `--color-text`.

**Status nunca só por cor:**

| Status | Cor | Ícone | Padrão no bloco da agenda |
|--------|-----|-------|---------------------------|
| Aguardando aprovação | warning | `Clock` | listrado diagonal + rótulo |
| Confirmado | success | `CheckCircle2` | sólido |
| Recusado / Expirado | danger / neutro | `XCircle` / `TimerOff` | não aparece na grade (só no histórico) |
| Cancelado | neutro | `Ban` | tachado, opcional na grade |
| Faltou | danger | `UserX` | contorno tracejado |
| Concluído | neutro | `Check` | opacidade reduzida + ícone |

### Tipografia

Família: `Inter var`, fallback `system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`.
`font-feature-settings: "cv11", "ss01"`; `tabular-nums` em horários e valores.

| Token | Tamanho / altura | Peso | Uso |
|-------|-----------------|------|-----|
| `display` | 32 / 40 | 600 | Título de página pública |
| `title-1` | 24 / 32 | 600 | Título de página |
| `title-2` | 20 / 28 | 600 | Título de seção, painel |
| `headline` | 17 / 24 | 600 | Título de card |
| `body` | 16 / 24 | 400 | Texto padrão (nunca menor em formulários → evita zoom no iOS) |
| `body-sm` | 14 / 20 | 400 | Tabelas, metadados |
| `caption` | 12 / 16 | 500 | Rótulos, badges |

Espaçamento de letras levemente negativo nos títulos (−0,01 a −0,02 em).

### Espaçamento (base 4 px)

`--space-0.5: 2` · `1: 4` · `2: 8` · `3: 12` · `4: 16` · `5: 20` · `6: 24` · `8: 32` · `10: 40` · `12: 48` · `16: 64`
Padding padrão de card: 20–24; gutter de página: 24 (desktop) / 16 (celular).

### Bordas e raios

| Token | Valor | Uso |
|-------|-------|-----|
| `--radius-xs` | 6 px | Badges, chips |
| `--radius-sm` | 8 px | Campos, botões |
| `--radius-md` | 12 px | Cards, blocos da agenda |
| `--radius-lg` | 16 px | Painéis, modais |
| `--radius-xl` | 24 px | Folhas inferiores (mobile), barra flutuante |
| `--radius-full` | 9999 px | Avatares, segmentados |
| `--border-hairline` | 1 px `--color-border` | |

### Sombras (discretas, em camadas)

| Token | Valor |
|-------|-------|
| `--shadow-xs` | `0 1px 2px rgb(16 24 40 / .05)` |
| `--shadow-sm` | `0 1px 3px rgb(16 24 40 / .06), 0 1px 2px rgb(16 24 40 / .04)` |
| `--shadow-md` | `0 4px 12px rgb(16 24 40 / .08), 0 2px 4px rgb(16 24 40 / .04)` |
| `--shadow-lg` | `0 12px 32px rgb(16 24 40 / .12), 0 4px 8px rgb(16 24 40 / .05)` |
| `--shadow-focus` | `0 0 0 3px rgb(31 111 139 / .35)` |

### Transparência e vidro

| Token | Valor |
|-------|-------|
| `--glass-bg` | `rgb(255 255 255 / .72)` |
| `--glass-bg-strong` | `rgb(255 255 255 / .86)` (menus com texto) |
| `--glass-blur` | `saturate(180%) blur(20px)` |
| `--glass-border` | `1px solid rgb(255 255 255 / .6)` + realce superior `inset 0 1px 0 rgb(31 111 139 / .08)` |
| `--overlay-scrim` | `rgb(20 23 28 / .32)` |

Regras do vidro:
1. **Onde usar:** barra lateral, barra inferior mobile, cabeçalho fixo ao rolar, menus/popovers, paleta de comandos, painel lateral da agenda, indicador do item selecionado, barra de ações flutuante.
2. **Onde não usar:** tabelas, formulários (o campo é sempre opaco), prontuário, financeiro, textos longos, toasts de erro.
3. Texto sobre vidro só com `--glass-bg-strong` ou superior e contraste verificado sobre o pior fundo possível.
4. `@media (prefers-reduced-transparency: reduce)` e `(forced-colors: active)` → fundo opaco `--color-bg`.
5. Fallback sem `backdrop-filter` → fundo opaco.
6. Desempenho: no máximo 2–3 camadas de vidro visíveis ao mesmo tempo.

### Movimento

| Token | Valor | Uso |
|-------|-------|-----|
| `--duration-fast` | 120 ms | Hover, pressionar |
| `--duration-base` | 200 ms | Popover, toast, troca de aba |
| `--duration-slow` | 320 ms | Painel lateral, folha inferior |
| `--ease-standard` | `cubic-bezier(.2, .8, .2, 1)` | Padrão |
| `--ease-exit` | `cubic-bezier(.4, 0, 1, 1)` | Saídas |
| Mola (Motion) | `{ type: "spring", stiffness: 380, damping: 32 }` | Painéis e arrastar na agenda |

`prefers-reduced-motion: reduce` → transições viram fade de 80 ms ou nenhuma; arrastar continua funcionando sem animação.

### Camadas (z-index)

`base 0` · `sticky 10` · `nav 20` · `dropdown 30` · `sheet 40` · `modal 50` · `toast 60`

## 3. Componentes

Base: shadcn/ui (Radix — acessibilidade de teclado e ARIA prontas), restilizados com os tokens.
Ficam em `src/ui/`; módulos não criam estilos próprios, apenas compõem.

| Grupo | Componentes | Notas |
|-------|------------|-------|
| Ações | `Button` (primary, secondary, ghost, destructive; sm/md/lg), `IconButton`, `ButtonGroup`, `SegmentedControl` | Altura mínima 40 px (44 px em toque); estado de carregamento interno |
| Formulário | `Field` (label + controle + ajuda + erro), `Input`, `Textarea`, `PhoneInput` (máscara BR → E.164), `CurrencyInput`, `Select`, `Combobox` (busca), `Checkbox`, `Radio`, `Switch`, `DatePicker`, `TimePicker` | Erro sempre em texto + ícone, associado via `aria-describedby` |
| Calendário | `Calendar` (mês), `AgendaGrid` (dia/semana, colunas por profissional), `AgendaList` (mobile), `AppointmentBlock`, `SlotPicker` (público) | Navegação por setas na grade; leitor de tela anuncia "terça, 14h, livre" |
| Dados | `DataTable` (ordenar, filtrar, paginar; vira lista de cards no mobile), `DescriptionList`, `Stat` (KPI) | Opaco, sem vidro |
| Superfícies | `Card`, `Sheet` (lateral/inferior), `Dialog`, `Popover`, `DropdownMenu`, `ContextMenu`, `CommandPalette`, `Tabs` | Foco preso e devolvido ao fechar |
| Navegação | `Sidebar`, `BottomBar`, `Breadcrumb` (só em Gestão), `OrgSwitcher`, `Stepper` (público/onboarding/importação) | |
| Feedback | `Badge`/`StatusBadge`, `Toast` (com Desfazer), `Alert`, `Banner` (página inteira), `ConfirmDialog`, `Progress`, `Skeleton`, `EmptyState`, `ErrorState` | `ConfirmDialog` destrutivo exige ação explícita, foco inicial em "Cancelar" |

## 4. Acessibilidade (WCAG 2.2 AA)

- Contraste ≥ 4,5:1 texto normal, ≥ 3:1 texto grande e componentes de interface (bordas de campo, foco).
- **Foco visível** sempre (`--shadow-focus` + contorno 2 px), nunca removido; não coberto por cabeçalhos fixos (2.4.11).
- Alvos de toque ≥ 24×24 px (2.5.8), meta interna 44×44 px no celular.
- Alternativa ao arrastar (2.5.7): toda remarcação por arrastar também existe por botão.
- Sem limite de tempo oculto: a expiração de reserva é informada antes; formulários públicos não expiram sem aviso.
- Navegação completa por teclado; atalhos (`N`, `/`, `Ctrl+K`) desativáveis e documentados.
- `lang="pt-BR"`, rótulos em todos os campos, mensagens de status com `aria-live`.
- Zoom até 200% e largura de 320 px sem rolagem horizontal (exceto grade da agenda, que tem visão em lista).
- Testes: `axe` automatizado no Playwright em todas as telas + revisão manual com leitor de tela (NVDA/VoiceOver) por fase.
