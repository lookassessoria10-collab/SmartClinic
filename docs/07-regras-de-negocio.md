# 07 — Regras de negócio

Identificadores `RN-xx` são referenciados nos critérios de aceitação e nos testes.

## Organização e onboarding
- **RN-01** Toda organização nasce com uma unidade padrão; unidades extras ficam ocultas na interface até a fase de multiunidades.
- **RN-02** O segmento do estabelecimento (`organizations.segment`) só influencia sugestões e módulos; nunca restringe dados ou regras.
- **RN-03** Especialidade do profissional é independente do segmento (clínica de estética pode ter um médico dermatologista).
- **RN-04** Slug: 3–48 caracteres `[a-z0-9-]`, único, sem palavras reservadas. Ao trocar, o antigo redireciona por 90 dias e não pode ser usado por outra clínica nesse período.

## Disponibilidade
- **RN-10** Horários livres = regras semanais do profissional na unidade − bloqueios (profissional, unidade ou organização) − feriados − agendamentos `requested`/`confirmed`.
- **RN-11** Um horário só é oferecido se couber `duração do serviço + buffer` inteiro dentro de uma janela livre.
- **RN-12** Intervalo de oferta de horários: configurável (padrão = 15 min, ou a duração do serviço se menor).
- **RN-13** Fuso: cálculo no fuso da unidade; armazenamento em UTC.
- **RN-14** Alterar disponibilidade **não** cancela agendamentos existentes; a interface lista os que ficaram fora do novo horário para decisão manual.

## Agendamentos
- **RN-20** Conflito: o mesmo profissional não pode ter dois agendamentos `requested`/`confirmed` sobrepostos — garantido pela restrição `no_overlap` no banco. Encaixe permitido só com ação explícita "Encaixar" (pós-MVP; exigirá ajuste da restrição).
- **RN-21** Criado pela equipe → nasce `confirmed`. Criado pela página pública → nasce `requested`.
- **RN-22** Transições válidas:

```
requested ──► confirmed ──► completed
    │             │  └────► no_show
    │             └───────► cancelled
    ├───────► declined
    ├───────► expired   (automático)
    └───────► cancelled (paciente, pelo link)
```
  Qualquer outra transição é recusada pelo servidor e por trigger no banco. `completed`/`no_show` só a partir do horário de início.
- **RN-23** Toda transição gera `appointment_events` com autor e motivo.
- **RN-24** Remarcar = alterar horário de um `confirmed` (mantém o mesmo registro e histórico); vale a mesma validação de conflito.
- **RN-25** Cancelamento e exclusão nunca apagam o registro.

## Agendamento público
- **RN-30** Só aparecem serviços `is_public` e profissionais `accepts_public_booking` e ativos.
- **RN-31** Antecedência mínima (padrão 2 h) e máxima (padrão 60 dias), configuráveis.
- **RN-32** Reserva temporária: `hold_expires_at = min(agora + prazo de resposta, início − antecedência mínima)`; prazo padrão 24 h.
- **RN-33** Solicitação vencida → `expired`, horário liberado, paciente vê "não confirmada a tempo" no link.
- **RN-34** Limites anti-abuso: CAPTCHA válido; máx. 3 solicitações pendentes por telefone por clínica; máx. 10 envios por IP por hora (valores configuráveis pela plataforma).
- **RN-35** O token de status tem 32 bytes aleatórios, é mostrado uma vez (e enviado por e-mail se informado); o banco guarda apenas o hash. Válido até 30 dias após o horário.
- **RN-36** A página de status mostra apenas: clínica, serviço, profissional, data/hora, status. Nenhum dado é editável além de "Cancelar solicitação".
- **RN-37** Clínica suspensa → página pública mostra "Agendamento online indisponível" e o telefone da clínica.

## Pacientes
- **RN-40** Obrigatório apenas nome + (telefone ou e-mail).
- **RN-41** Possível duplicidade: mesmo telefone E.164, mesmo e-mail, ou nome normalizado + data de nascimento iguais. O sistema avisa; nunca mescla sozinho.
- **RN-42** `admin_notes` exibe aviso permanente: "Não registre informações clínicas aqui."
- **RN-43** Exclusão é lógica; dados mantidos pelo prazo de retenção e excluídos definitivamente por rotina documentada, respeitando obrigações legais.

## Financeiro
- **RN-50** Valores em centavos; nunca ponto flutuante.
- **RN-51** `paid` exige data de pagamento; `cancelled` mantém registro.
- **RN-52** Recebimento pode ser vinculado a agendamento/paciente/profissional, mas não é obrigatório.
- **RN-53** Resumo por período usa `paid_at` para realizado e `due_date` para previsto.
- **RN-54** Fora do escopo: nota fiscal, conciliação bancária, TISS, comissões.

## Importação e exportação
- **RN-60** Limite: 5 MB e 10.000 linhas por arquivo; tipos verificados por conteúdo, não só extensão.
- **RN-61** Fórmulas de planilha não são executadas; valores iniciados por `= + - @` são tratados como texto (proteção contra injeção CSV também na **exportação**).
- **RN-62** Nada é sobrescrito sem confirmação explícita; padrão para duplicados = pular.
- **RN-63** Importação é transacional por lote de 500 linhas; falha de um lote não desfaz lotes anteriores já confirmados, e o relatório indica exatamente o que entrou.
- **RN-64** Arquivo original é apagado do Storage em 7 dias.
- **RN-65** Exportação exige permissão `data.export` + reautenticação; link expira em 15 min.

## Assinaturas
- **RN-70** Funcionalidade disponível = no plano **e** habilitada na organização.
- **RN-71** Limite atingido (ex.: nº de profissionais) bloqueia apenas a criação de novos itens, nunca o acesso aos existentes.
- **RN-72** Suspensão → somente leitura + exportação; nenhum dado é apagado.
- **RN-73** Cancelamento → 90 dias de somente leitura/exportação; depois, exclusão definitiva com aviso prévio de 30 dias (prazos sujeitos à validação jurídica, D-14).
