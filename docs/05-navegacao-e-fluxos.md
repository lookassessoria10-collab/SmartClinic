# 05 — Navegação e fluxos

## 1. Mapa de navegação

```
/login · /convite/[token] · /redefinir-senha
/onboarding                        ← só no primeiro acesso do gestor

/c/[org]/
├─ inicio                          Tela inicial adaptada ao perfil
├─ agenda                          Dia | Semana | Mês · filtros · painel lateral
│   └─ solicitacoes                Fila de aprovação (também acessível pelo Início)
├─ pacientes
│   └─ [id]                        Dados · histórico de agendamentos · financeiro do paciente
├─ financeiro                      Resumo · lançamentos · pendentes
└─ gestao
    ├─ clinica                     Dados, endereço, fuso, módulos ativos
    ├─ profissionais
    ├─ servicos
    ├─ horarios                    Disponibilidade, feriados, bloqueios gerais
    ├─ agendamento-online          Link público, regras de antecedência e reserva, textos
    ├─ equipe                      Membros e papéis
    ├─ importar-exportar
    ├─ assinatura                  Plano e limites (leitura)
    └─ auditoria

/agendar/[slug]                    Público, mobile-first
└─ /status/[token]                 Status e cancelamento da solicitação

/admin                             Administração da plataforma (separado)
├─ clinicas · planos · assinaturas · auditoria
```

### Visibilidade por perfil

| Item | Gestor | Recepção | Profissional |
|------|:-----:|:-------:|:-----------:|
| Início | ✅ | ✅ | ✅ |
| Agenda | ✅ | ✅ | ✅ (abre filtrada em "minha agenda") |
| Pacientes | ✅ | ✅ | ✅ (só os seus) |
| Financeiro | ✅ | ✅ (só lançar/pendentes) | 🔸 se habilitado |
| Gestão | ✅ | — (Horários se permitido) | — (apenas "Meus horários" no perfil) |

### Comportamento responsivo

| Contexto | Desktop (≥ 1024 px) | Tablet (768–1023) | Celular (< 768) |
|----------|--------------------|-------------------|-----------------|
| Navegação principal | Barra lateral glass recolhível | Barra lateral só com ícones | **Barra inferior** com 5 itens (glass) |
| Agenda | Semana como padrão, painel lateral à direita | Dia/semana, painel como folha lateral | **Lista do dia** como padrão; painel vira folha inferior (sheet) |
| Tabelas | Tabela completa | Colunas prioritárias | Lista de cards |
| Ação primária | Botão no cabeçalho + atalho `N` | Botão no cabeçalho | Botão flutuante |
| Busca global | `Ctrl/⌘ K` (paleta de comandos) | idem | Ícone no cabeçalho |

## 2. Tela inicial por perfil

**Recepção** — "O que preciso fazer agora?"
1. Cartão **Solicitações pendentes** (contador + 3 mais próximas de expirar, com Aprovar/Recusar inline).
2. **Agenda de hoje** em linha do tempo compacta, agrupada por profissional; próximo paciente destacado.
3. **Ações rápidas**: Novo agendamento · Novo paciente · Copiar link de agendamento.

**Profissional** — "Como é o meu dia?"
1. **Meus atendimentos de hoje** (horário, paciente, serviço, status; marcar Concluído/Faltou).
2. **Próximos dias** (resumo de 7 dias).
3. Solicitações pendentes **para mim** (se tiver permissão de revisão).

**Gestor** — "Como está a clínica?"
1. **Resumo operacional**: atendimentos hoje/semana, taxa de ocupação, faltas.
2. **Pendências**: solicitações, recebimentos em aberto, configurações incompletas (checklist de ativação).
3. **Financeiro do mês**: recebido × a receber × despesas.
4. Se também é profissional: bloco "Meus atendimentos".

## 3. Fluxos principais

### F1 — Primeiro acesso e onboarding (gestor) · meta: ≤ 5 min até a agenda pronta

```
Criar conta (e-mail, senha) → confirmar e-mail
  → 1. Tipo de estabelecimento (cards com ícone)
  → 2. Quantos profissionais atendem? (1 · 2–5 · 6–10 · mais de 10)
  → 3. Serviços oferecidos (chips sugeridos pelo tipo + "adicionar outro")
  → 4. Principal necessidade (Organizar agenda · Receber agendamentos online ·
        Controlar financeiro · Migrar de outro sistema)
  → Revisão: "Preparamos isto para você" (serviços com duração sugerida, módulos ativos,
     horário padrão seg–sex 08–18) — tudo editável, botão "Começar"
  → Início com checklist: ☐ Ajustar horários ☐ Adicionar profissionais ☐ Compartilhar link
```

Efeitos das respostas (exemplos, todos reversíveis em Gestão):

| Resposta | Efeito |
|----------|--------|
| Odontologia | Serviços: Avaliação (30 min), Limpeza (45), Restauração (60), Retorno (20); categoria "Procedimento"; módulo futuro "Odontograma" listado como "em breve" |
| Estética | Serviços: Avaliação, Limpeza de pele, Sessão de laser; categoria "Sessão"; "Pacotes" como "em breve" |
| Medicina | Consulta (30), Retorno (20); "Prontuário" como "em breve" |
| Multidisciplinar | Pede especialidade por profissional ao cadastrá-lo; serviços vinculados por profissional |
| 1 profissional | Cria o profissional = o próprio gestor; esconde filtro de profissional na agenda |
| "Migrar de outro sistema" | Leva ao assistente de importação após a revisão |
| "Receber agendamentos online" | Ativa a página pública e mostra o link no fim |

### F2 — Criar agendamento pela recepção · meta: 3 passos

```
Agenda → clicar no horário livre (define profissional + início)
  → Painel lateral abre com foco no campo Paciente
     • digitar nome ou telefone → resultados; "Criar 'Maria...' como novo paciente" inline
  → Serviço (pré-filtrado pelos serviços do profissional; duração preenche o fim)
  → Salvar  (Enter)
  ⇢ O bloco aparece na agenda com animação curta; toast "Agendado · Desfazer"
```

Conflito detectado no servidor (outra pessoa pegou o horário segundos antes): o painel mantém
os dados e mostra "Esse horário acabou de ser ocupado" + 3 horários livres mais próximos.

### F3 — Remarcar / cancelar
- **Arrastar** o bloco (desktop) ou "Remarcar" no painel (todas as telas) → confirmação mostrando de/para.
- **Cancelar**: motivo opcional em lista curta; toast com Desfazer por 10 s; histórico registra.

### F4 — Agendamento público (paciente, celular) · meta: ≤ 60 s

```
/agendar/clinica-sorriso
  1. Serviço          (lista em cards; duração e preço se a clínica permitir)
  2. Profissional     (pulado se só houver um; opção "Sem preferência")
  3. Data e horário   (faixa de datas rolável com dias disponíveis destacados →
                       horários em botões grandes, agrupados manhã/tarde/noite)
  4. Seus dados       (nome, celular, e-mail opcional, mensagem opcional,
                       aceite do aviso de privacidade — Turnstile invisível)
  5. Enviado          "Solicitação enviada. A clínica confirma em até X horas."
                       Link de acompanhamento + botão "Adicionar ao calendário" após confirmação
```

- Progresso visível (1 de 4), botão Voltar sempre disponível, dados preservados ao voltar.
- Ao escolher o horário, ele **não** é reservado ainda; a reserva acontece no envio (passo 4),
  dentro da transação que valida conflito. Se o horário foi ocupado nesse meio-tempo, volta ao
  passo 3 com aviso e o dia já aberto.

### F5 — Aprovar solicitações

```
Início (cartão) ou Agenda → Solicitações
  Lista ordenada por "expira em" · cada item: paciente, serviço, profissional, data, tempo restante
  → Abrir item: o sistema mostra "Possível paciente existente: Maria S. (11) 9...-1234"
     [Vincular a Maria] [Criar novo paciente]
  → Aprovar  → status Confirmado; e-mail ao paciente (se informado)
  → Recusar  → motivo (opcional, enviado ao paciente) ; horário liberado
  → (opcional) Sugerir outro horário → paciente confirma pelo link
```

Na agenda, solicitações aparecem com **padrão listrado + ícone de relógio + rótulo "Aguardando"**
(não só cor), para a recepção ver a ocupação real.

### F6 — Importação

```
Gestão → Importar
  1. O que importar? (Pacientes · Profissionais · Serviços) + modelo de planilha para baixar
  2. Enviar arquivo (CSV/XLSX, até 5 MB / 10.000 linhas)
  3. Mapear colunas (sugestão automática por nome/conteúdo; "Ignorar coluna")
  4. Validação + duplicidades (por telefone/e-mail/nome+nascimento)
       Para duplicados: Pular (padrão) · Criar mesmo assim · Atualizar campos vazios
       "Sobrescrever" exige confirmação explícita por campo
  5. Prévia (primeiras 20 linhas + contadores: válidas, com erro, duplicadas)
  6. Confirmar → progresso → Relatório (baixar linhas com erro em CSV para corrigir)
```

### F7 — Exportação
Gestão → Exportar → escolher conjuntos (pacientes, agendamentos, financeiro) e formato →
confirmação com reautenticação (senha ou MFA) → arquivo gerado → link válido por 15 min → evento auditado.

## 4. Estados que toda tela precisa ter

| Estado | Padrão |
|--------|--------|
| Vazio | Ilustração mínima + 1 frase + ação primária ("Nenhum paciente ainda · Adicionar · Importar planilha") |
| Carregando | Skeleton com o formato do conteúdo (nunca spinner de página inteira) |
| Erro | Mensagem em linguagem simples + o que fazer + "Tentar novamente"; detalhes técnicos só no log |
| Sem permissão | "Você não tem acesso a esta área. Fale com o gestor da clínica." |
| Somente leitura (suspensa) | Faixa no topo explicando + link para exportar dados; botões de escrita desabilitados com motivo |
| Offline | Faixa "Sem conexão — as alterações não foram salvas" |
