# 04 — Perfis e permissões

## 1. Conceitos

| Conceito | O que é | Onde vive |
|----------|---------|-----------|
| **Papel (nível de acesso)** | O que a pessoa pode fazer na clínica: Gestor, Recepção, Profissional | `memberships.role` |
| **Ser profissional** | A pessoa tem agenda e atende | `professionals.user_id` |
| **Permissão** | Ação atômica (`appointments.create`) | `role_permissions` |
| **Funcionalidade** | Módulo disponível para a clínica (`finance`) | plano + `organization_features` |
| **Admin da plataforma** | Equipe do SaaS | `platform_admins` (fora das clínicas) |
| **Paciente** | Visitante anônimo da página pública | Sem conta; acesso por token |

Uma gestora-dentista tem `role = manager` **e** um registro em `professionals` → vê tudo da
clínica e também tem "Meus atendimentos" na tela inicial.

## 2. Matriz de permissões (MVP)

Legenda: ✅ permitido · 🔸 apenas os próprios (atendimentos em que é o profissional) · — negado

| Permissão | Gestor | Recepção | Profissional |
|-----------|:-----:|:-------:|:-----------:|
| **Agenda** | | | |
| `schedule.view_all` (ver ocupação de todos) | ✅ | ✅ | ✅¹ |
| `appointments.read` (detalhes) | ✅ | ✅ | 🔸 |
| `appointments.create` / `update` / `cancel` | ✅ | ✅ | 🔸¹ |
| `appointments.set_status` (concluído/faltou) | ✅ | ✅ | 🔸 |
| `booking_requests.review` (aprovar/recusar) | ✅ | ✅ | 🔸¹ |
| `availability.manage` | ✅ | ✅ | 🔸 |
| **Pacientes** | | | |
| `patients.read_all` | ✅ | ✅ | —¹ |
| `patients.read_own` | ✅ | ✅ | ✅ |
| `patients.write` | ✅ | ✅ | 🔸¹ |
| `patients.delete` (lógico) | ✅ | — | — |
| **Cadastros** | | | |
| `professionals.manage` | ✅ | — | — |
| `services.manage` | ✅ | — | — |
| **Financeiro** | | | |
| `finance.read` | ✅ | —¹ | — |
| `finance.write` (registrar recebimento) | ✅ | ✅ | — |
| `finance.read_own` (recebimentos dos próprios atendimentos) | ✅ | — | ✅¹ |
| **Gestão** | | | |
| `members.manage` | ✅ | — | — |
| `org.settings` (dados, onboarding, slug, agenda pública) | ✅ | — | — |
| `data.import` | ✅ | — | — |
| `data.export` | ✅ | — | — |
| `audit.read` | ✅ | — | — |

¹ Valor padrão configurável pelo gestor em *Gestão → Permissões* (pós-MVP: papéis customizados
usando a mesma tabela `role_permissions` por organização).

Recepção registra recebimentos, mas não vê o resumo financeiro — padrão comum em clínicas
pequenas para não expor faturamento. Confirmar em D-06.

### Administrador da plataforma
- Vê e edita: organizações, planos, assinaturas, status, métricas de uso agregadas.
- **Não vê** pacientes, agendamentos, financeiro das clínicas.
- Suporte com acesso a dados (pós-MVP): solicitado pela clínica, com prazo, motivo e auditoria visível para a clínica.

### Paciente (anônimo)
- Lê: nome público da clínica, serviços públicos, profissionais que aceitam agendamento público, horários livres (apenas início/fim, sem motivo de ocupação).
- Escreve: uma solicitação por vez, protegida por CAPTCHA e limite de taxa.
- Com o token: lê o status da própria solicitação e pode cancelá-la.

## 3. Aplicação em três camadas

| Camada | Mecanismo | Função |
|--------|-----------|--------|
| 1. Interface | `can('appointments.create')` esconde/desabilita | **Conforto**, não segurança |
| 2. Servidor | `requirePermission(org, perm)` em toda Server Action/Route Handler; também checa funcionalidade do plano e se a organização é gravável | Mensagens de erro claras, regras que o SQL não expressa bem |
| 3. Banco | Políticas RLS chamando `app.has_perm` e `app.org_writable` | **Garantia final**: mesmo uma chamada direta à API do Supabase com o token do usuário é recusada |

As permissões são lidas do banco (uma consulta por requisição, em cache no escopo da requisição),
então mudar o papel de alguém vale na próxima requisição — sem esperar o token expirar.

## 4. Testes obrigatórios

- Para cada tabela: membro da clínica A × dados da clínica B → 0 linhas em SELECT; erro em INSERT/UPDATE/DELETE.
- Para cada papel: matriz acima executada como teste parametrizado (pgTAP).
- Membro `disabled` ou `invited` → sem acesso.
- Organização `suspended` → leitura e exportação ok; qualquer escrita falha.
- `anon` → nenhuma tabela acessível diretamente; só as funções públicas.
- Admin da plataforma sem membership → nenhuma linha de pacientes.
