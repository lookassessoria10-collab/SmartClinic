# 00 — Análise de requisitos

## 1. Síntese

O briefing é consistente na direção (SaaS multiempresa, simples na experiência, completo na
arquitetura, entrega em fases). Os pontos abaixo são tensões ou lacunas que precisam de
uma decisão antes ou durante a Fase 3. Cada item aponta para a decisão correspondente em
[11-decisoes.md](11-decisoes.md).

## 2. Conflitos identificados

| # | Conflito | Por que importa | Proposta | Decisão |
|---|----------|-----------------|----------|---------|
| C1 | **Vercel Hobby é não comercial**, mas o produto é SaaS pago. | Os termos do plano Hobby proíbem uso comercial; usar com clientes viola os termos. | Hobby só para protótipo pessoal. Antes do primeiro cliente pagante: Vercel Pro ou alternativa (ver [10-custos.md](10-custos.md)). | D-10 |
| C2 | **Supabase Free não serve para produção com dados de saúde.** | Projetos gratuitos pausam por inatividade e não incluem backups diários gerenciados nem PITR. Requisito de backup/recuperação (§16) não é atendido. | Free para desenvolvimento e protótipo. Plano Pro (região São Paulo) antes de dados reais. | D-10 |
| C3 | **"Consultar status de maneira segura" sem conta**, sem WhatsApp e sem provedor de e-mail definido. | Sem um canal de entrega, o paciente só tem o link exibido na tela de confirmação — se fechar a página, perde o acesso. | Link com token secreto exibido na confirmação + envio por e-mail transacional (provedor gratuito no início). WhatsApp fica fora. | D-07 |
| C4 | **Reserva temporária × aprovação obrigatória.** | Se a clínica demora a aprovar, o horário fica bloqueado; se a reserva expira rápido, solicitações legítimas se perdem. | Reserva configurável por clínica (padrão: 24 h ou até 2 h antes do horário, o que vier primeiro). Expirada, a solicitação libera o horário e aparece como "Expirada". | D-08 |
| C5 | **"Não tratar dados sensíveis no MVP" × agenda já revela saúde.** | Serviço + nome do paciente ("Consulta — Oncologia", "Implante") já é dado pessoal sensível referente à saúde (LGPD art. 5º, II e art. 11). | Tratar **todo o banco como sensível desde a Fase 3**: RLS, auditoria, criptografia em trânsito e repouso, minimização. Prontuário fica para depois, mas o nível de proteção não. | D-11 |
| C6 | **Gestor que também atende.** Em clínicas de 1–10 profissionais, o dono quase sempre é dentista/médico/esteticista. | Se "papel" e "ser profissional" forem a mesma coisa, o dono precisa de duas contas. | Separar **nível de acesso** (papel do membro) de **ser profissional** (registro em `professionals` vinculado ao usuário). Um gestor pode ter agenda própria. | D-05 |
| C7 | **Efeito glass × WCAG 2.2 AA.** | Transparência sobre fundo variável derruba o contraste de texto. | Glass só em navegação, menus, painéis flutuantes e seleção; sempre com camada de base opaca mínima (≥ 72%), e desligado com `prefers-reduced-transparency` e em alto contraste. | D-13 |
| C8 | **Suspensão sem perda de dados × "dados nunca acessados"**. | Clínica suspensa precisa continuar podendo exportar (portabilidade, LGPD art. 18). | Suspensão = **modo somente leitura + exportação liberada**. Exclusão só após prazo de retenção e aviso. | D-14 |
| C9 | **"Profissional vê informações autorizadas"** é indefinido. | Define a política RLS de pacientes e agenda. | Padrão: profissional vê a agenda completa da clínica (ocupação), mas detalhes de pacientes apenas dos seus atendimentos. Configurável pelo gestor. | D-06 |
| C10 | **Agenda pública sem conta × proteção contra abuso.** | Formulário anônimo que reserva horário é alvo fácil de spam e de bloqueio de agenda. | CAPTCHA invisível (Cloudflare Turnstile, gratuito), limite de requisições por IP/telefone, limite de solicitações pendentes por contato. | D-09 |
| C11 | **Administrador da plataforma × isolamento entre clínicas.** | O suporte precisa ajudar clínicas, mas não pode ter acesso irrestrito a pacientes. | Administração central vê dados da **organização** (plano, status, uso), não de pacientes. Acesso a dados clínicos só com autorização registrada da clínica e tempo limitado (fase futura). | D-12 |

## 3. Requisitos ausentes (sugeridos)

Classificados por necessidade no MVP.

### Necessários no MVP
- **Status "Faltou" (não compareceu)** e **"Expirada"** para solicitações não respondidas.
- **Fuso horário por organização/unidade** (padrão `America/Sao_Paulo`); todos os horários gravados em UTC.
- **Convite de usuários** por e-mail, redefinição de senha e desativação de membros.
- **Usuário em mais de uma clínica** (profissional que atende em dois lugares) → seletor de organização.
- **Consentimento e aviso de privacidade** na página pública de agendamento (versão do texto registrada).
- **Termos de uso e acordo de tratamento de dados (DPA)**: a clínica é *controladora*, a plataforma é *operadora*.
- **Regras do slug público**: único, minúsculo, palavras reservadas (`admin`, `api`, `login`...), histórico para redirecionar após troca.
- **Paciente cancelar a própria solicitação** pelo link seguro.
- **Mesclagem de pacientes duplicados** (mínimo: alerta de duplicidade por telefone/e-mail na criação e na importação).
- **Feriados**: cadastro manual pela clínica + sugestão de feriados nacionais (lista estática anual, sem dependência externa).
- **Antecedência mínima e máxima** para agendamento público (ex.: mín. 2 h, máx. 60 dias).
- **MFA opcional** para gestores (Supabase Auth suporta TOTP).

### Recomendados, mas podem ficar fora do MVP
- Lembretes por e-mail antes do atendimento.
- Responsável legal para pacientes menores de idade.
- Agendamentos recorrentes e pacotes de sessões (estética).
- Recursos físicos (salas, cadeiras odontológicas, equipamentos) como restrição de agenda.
- Comissão/repasse para profissionais no financeiro.
- Lista de espera.
- Tema escuro.
- CPF do paciente (útil para nota fiscal e TISS; **não coletar no MVP** por minimização).

## 4. Premissas assumidas

1. Público inicial: Brasil, idioma pt-BR, moeda BRL. Estrutura preparada para i18n, sem traduzir agora.
2. Clínicas pequenas: até ~10 profissionais, ~2.000 agendamentos/mês por clínica.
3. Uma unidade por clínica no MVP; o modelo já carrega `unit_id` em tudo que é físico.
4. Cobrança manual (fora do sistema) na primeira versão.
5. Nenhum dado real de paciente até a Fase 10 concluída e infraestrutura comercial contratada.
6. Desenvolvimento por uma pessoa/time pequeno; por isso, monólito e ferramentas gerenciadas.
