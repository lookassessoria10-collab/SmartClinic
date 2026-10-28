# 11 — Decisões

## Parte A — Decisões arquiteturais propostas (ADRs)

Status: **Proposta** até a aprovação da Fase 1; depois **Aceita**. Mudanças futuras criam um novo ADR que substitui o anterior.

| ADR | Decisão | Justificativa | Alternativas descartadas |
|-----|---------|---------------|--------------------------|
| 001 | Monólito modular em Next.js | Time pequeno, um deploy, transações entre domínios | Microsserviços (custo operacional sem benefício nesta escala) |
| 002 | Multiempresa com banco/schema compartilhado + `organization_id` + RLS | Custo baixo, migrações únicas, suportado nativamente pelo Supabase | Banco por cliente; schema por cliente |
| 003 | `unit_id` em todas as entidades físicas desde o início | Multiunidade futura sem migração de dados | Adicionar depois (migração arriscada com dados reais) |
| 004 | Conflitos de horário garantidos por `EXCLUDE USING gist` | Atômico e imune a condições de corrida | Verificação só na aplicação (falha sob concorrência) |
| 005 | Solicitação pública = `appointment` com status `requested` + `booking_requests` separada | Uma única fonte da agenda; anônimo nunca toca em `patients` | Tabela de solicitações separada (duas agendas na prática) |
| 006 | Componente de agenda próprio | Controle total de acessibilidade, design e desempenho | FullCalendar e similares (peso, estilo difícil de alinhar, licença de recursos premium) |
| 007 | Permissões em tabela (`role_permissions`) com papéis fixos no MVP | Simples agora, permite papéis customizados depois sem refatorar políticas | Papéis "hardcoded" nas políticas |
| 008 | Escritas via Server Actions/RPC com JWT do usuário; service role só em admin/jobs | RLS sempre ativa como última barreira | Service role no servidor para tudo (RLS vira enfeite) |
| 009 | Valores monetários em centavos (`bigint`) | Sem erro de arredondamento | `numeric`/`float` |
| 010 | Integrações via camada anticorrupção (`integrations`) + `external_identifiers` | Agenda e pacientes não conhecem formatos externos | Conectores escrevendo direto nas tabelas |
| 011 | Protótipo (Fase 2) com dados em memória, sem Supabase | Valida UX rápido, sem risco de dados | Já conectar ao banco (acopla UX a decisões não validadas) |
| 012 | Exclusão lógica para pacientes e financeiro | Recuperação, auditoria, obrigações legais | Exclusão física imediata |
| 013 | Next.js 16 com `cacheComponents`; `/c/[org]` e `/agendar/[slug]` exportam `instant = false` | Fase 2: dados no `localStorage`. **Revisado na Fase 3:** a área da clínica inteira depende da sessão (layout com `await connection()` + Suspense), então só o esqueleto pré-renderiza e a validação de navegação instantânea não tem o que validar. **Revisitar na Fase 4**, quando as telas forem renderizadas no servidor e puderem ter casca estática própria. Efeito conhecido: o Next valida cada *página* separadamente e `instant` não pode ser declarado em páginas de cliente, então o terminal de desenvolvimento mostra avisos "Could not validate… instant navigation" para as telas de demonstração. São só de desenvolvimento (não bloqueiam o build nem chegam ao usuário) e somem quando essas páginas virarem Server Components | Desligar `cacheComponents` (perderia o modelo de renderização que usaremos com dados no servidor) |
| 014 | Regras de disponibilidade como funções puras em `src/modules/availability/rules.ts` | Testáveis sem banco; o mesmo código roda no servidor na Fase 5, com o banco como garantia final (ADR-004) | Lógica embutida nos componentes |
| 015 | Para quem não vê os detalhes (D-06), a agenda mostra "Ocupado" **sem o nome do serviço**, e o filtro por serviço não se aplica aos agendamentos dessa pessoa | O serviço revela informação de saúde (C5); filtrar por ele também revelaria | Mostrar o serviço (vazamento) |
| 016 | Membros, convites, slug e criação de clínica só mudam por funções SQL (`create_organization`, `create_invitation`, `accept_invitation`, `change_member_role`, `set_member_status`, `change_slug`); o cliente não tem UPDATE/DELETE nessas tabelas | Regras como "último gestor" e "e-mail do convite" ficam num só lugar e não podem ser contornadas por uma chamada direta à API | Políticas RLS de escrita + validação só na aplicação |
| 017 | Nenhum privilégio padrão: as migrações revogam os padrões do Supabase para `anon`/`authenticated` e cada tabela/função recebe GRANT explícito; o teste `00_schema_guards` falha se algo novo ficar exposto | Alinhado à mudança do Supabase de 30/10/2026 (tabelas novas não expostas automaticamente) e ao princípio de menor privilégio | Confiar no padrão do provedor |
| 018 | `audit_logs.organization_id` sem chave estrangeira | O registro precisa sobreviver à exclusão da clínica (retenção de 5 anos) | FK com `on delete set null` (perderia a ligação) |
| 019 | Gatilho de "último gestor" imediato, não adiado | Testável dentro de transação; trocar de gestor = promover antes de rebaixar | Gatilho adiado até o commit |
| 020 | Links de e-mail do Auth apontam para `/auth/confirm?token_hash=…` (modelos próprios em `supabase/templates/`) e a sessão é criada no servidor com `verifyOtp` | Funciona com cookies httpOnly e sem JavaScript no navegador; textos em português | Link padrão do Supabase (fluxo no navegador) |
| 021 | Limite de tentativas de login próprio, contado em `audit_logs` (5 por e-mail / 30 por IP em 15 min), com e-mail e IP guardados só como hash SHA-256 | Reaproveita a trilha de auditoria; não guarda dado pessoal em claro; complementa o limite do Supabase | Tabela separada; serviço externo (custo) |
| 022 | E-mail de convite enviado pelo próprio Supabase Auth: `inviteUserByEmail` para quem não tem conta, link de acesso (`signInWithOtp`, fluxo implícito) para quem tem; ambos terminam em `/convite/<código>`. Conta criada por convite recebe `needs_password: true` nos metadados | Sem provedor extra; o mesmo SMTP do Auth (D-16) serve para tudo. O Supabase grava senha **aleatória** nas contas convidadas, então "senha vazia" não detecta quem precisa criar senha — por isso a marca própria | Enviar por SMTP próprio da aplicação (mais uma integração) |
| 023 | Funções usadas em `CHECK` precisam de EXECUTE para `authenticated` (migração 0009) | O Postgres avalia `CHECK` com as permissões de quem altera a linha; sem o GRANT, todo UPDATE direto falhava. Lição: para cada regra de "não pode", ter também um teste de "pode" | — |
| 024 | MFA aplicado no banco: `app.mfa_ok()` dentro de `is_member`/`has_perm`/`shares_org_with` e nas políticas de "própria linha"; admin da plataforma só com `aal2` (migração 0010) | Uma senha vazada não basta nem chamando a API direto; uma única mudança cobre todas as políticas e funções de escrita existentes e futuras | Checar MFA só na tela/proxy (contornável pela API) |
| 025 | Páginas do servidor na área da clínica começam com `await connection()` | O Next 16 pré-renderiza cada página à parte; o cliente Supabase consulta o relógio e quebrava a página ("Date.now() while prerendering") | Confiar só no `connection()` do layout (não cobre as páginas) |

## Parte B — Decisões que exigem sua aprovação

Marque cada uma com ✅ (aprovado como proposto), ✏️ (aprovado com ajuste) ou ⏸️ (adiar).

| # | Tema | Proposta | Precisa antes da |
|---|------|----------|-----------------|
| **D-01** | Nome do produto | Usar nome provisório no protótipo; nome definitivo + busca no INPI antes da Fase 10 | Fase 2 (provisório) |
| **D-02** | Escopo do MVP | Conforme [01-visao-e-escopo.md §4](01-visao-e-escopo.md) | Fase 2 |
| **D-03** | Telas do protótipo | Login, onboarding, Início (3 perfis), agenda, página pública, fila de aprovação — dados fictícios, sem backend | Fase 2 |
| **D-04** | Identidade visual | Azul-petróleo `#1F6F8B` como destaque, Inter, Lucide, só tema claro no MVP | Fase 2 |
| **D-05** | Papel × profissional | Separar nível de acesso de "ser profissional" (gestor pode atender) | Fase 3 |
| **D-06** | Visibilidade padrão | Profissional: vê ocupação de todos, detalhes só dos próprios pacientes. Recepção: lança recebimentos, não vê resumo financeiro | Fase 3 |
| **D-07** | Canal de status ao paciente | Link com token na tela de confirmação + e-mail transacional (plano gratuito, exige domínio) | Fase 6 |
| **D-08** | Reserva temporária | Padrão 24 h ou até 2 h antes do horário; configurável pela clínica | Fase 6 |
| **D-09** | Anti-abuso público | Cloudflare Turnstile + limites RN-34 | Fase 6 |
| **D-10** | Hospedagem comercial | Supabase Pro (região São Paulo) + Vercel Pro ou alternativa; contratar só após sua autorização | Fase 10 |
| **D-11** | Classificação dos dados | Tratar agenda e pacientes como dados sensíveis de saúde desde a Fase 3 | Fase 3 |
| **D-12** | Acesso do admin da plataforma | Sem acesso a pacientes; suporte com acesso só mediante autorização temporária (pós-MVP) | Fase 9 |
| **D-13** | Uso do efeito glass | Restrito às áreas da [06-design-system.md §2](06-design-system.md), com fallback opaco | Fase 2 |
| **D-14** | Suspensão e retenção | Suspensa = somente leitura + exportação; cancelada = 90 dias + aviso de 30 dias antes da exclusão (validar com jurídico) | Fase 9 |

### Decisões para a Fase 3 (ver [12-fase-3-plano.md](12-fase-3-plano.md))

| # | Tema | Proposta | Precisa antes de |
|---|------|----------|-----------------|
| **D-15** | Repositório | GitHub privado criado por você; eu preparo o conteúdo e o primeiro commit | Início da fase |
| **D-16** | E-mail em staging | SMTP próprio com plano gratuito (ex.: Resend) usando um domínio seu, ou só e-mails locais até a Fase 6 | Passo 7 (convites) |
| **D-17** | Banco local | Supabase CLI com Docker Desktop no seu Windows (recomendado); alternativa: só staging | Passo 2 |
| **D-18** | Telas ainda simuladas | Agenda, pacientes e Início seguem com dados de demonstração atrás do login real, com faixa "dados de demonstração" | Passo 6 |
| **D-19** | MFA | Opcional para gestores, obrigatório para admin da plataforma | Passo 8 |
| **D-20** | Métodos de login | Só e-mail + senha no MVP (sem Google/link mágico) | Passo 5 |
| **D-21** | Política de senha | Mínimo de 10 caracteres, sem regras de composição, bloqueio de senhas vazadas se disponível no plano | Passo 5 |

### Perguntas abertas (não bloqueiam a Fase 2)
1. Haverá período de teste gratuito? Quantos dias?
2. Quais planos e limites iniciais (ex.: por número de profissionais)?
3. A clínica pode personalizar a página pública (logo, cor, foto de capa) no MVP?
4. Coletar CPF do paciente em algum momento do MVP? (Proposta: não.)
5. Existe uma clínica parceira para testes de usabilidade (com dados fictícios)?
