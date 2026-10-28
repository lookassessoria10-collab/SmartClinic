# 10 — Custos

> **Valores de referência, não verificados nesta data.** Planos e preços mudam; cada item será
> conferido na documentação oficial antes da contratação, e **nada será contratado sem autorização**.

## 1. Durante o desenvolvimento (Fases 1–9): R$ 0

| Item | Plano | Restrição relevante |
|------|-------|--------------------|
| GitHub | Free (repositório privado) | Cota de minutos de Actions |
| Vercel | Hobby | **Somente uso pessoal e não comercial** |
| Supabase | Free | Poucos projetos; pausa por inatividade; sem backups gerenciados; limites de banco/armazenamento/MAU |
| Supabase CLI local | Gratuito | Requer Docker Desktop (verificar licença: gratuito para uso pessoal/pequenas empresas) |
| Cloudflare Turnstile | Gratuito | — |
| E-mail transacional | Plano gratuito (ex.: Resend) | Limite diário/mensal; exige domínio próprio para boa entregabilidade |
| Sentry | Developer (gratuito) | Cota de eventos |
| Fontes e ícones | Inter (OFL), Lucide (ISC) | — |

## 2. Antes do primeiro cliente (Fase 10) — estimativa mensal

| Item | Referência aproximada | Por quê |
|------|----------------------|---------|
| Supabase Pro | ~US$ 25/mês + computação/uso excedente | Sem pausa, backups diários, suporte; PITR é adicional pago |
| Vercel Pro | ~US$ 20/mês por membro | Uso comercial permitido |
| Domínio `.com.br` | ~R$ 40/ano | Marca e e-mail autenticado |
| E-mail transacional | Gratuito até o limite; depois ~US$ 20/mês | Confirmações e convites |
| E-mail corporativo | ~R$ 30/usuário/mês | Suporte e contato |
| **Total técnico inicial** | **~US$ 45–70/mês + domínio** | |

## 3. Custos não técnicos (pontuais)

| Item | Observação |
|------|-----------|
| Assessoria jurídica LGPD | Termos, política, DPA, RIPD — maior custo inicial provável |
| Registro de marca (INPI) | Após definir o nome (D-01) |
| Teste de intrusão | Pode ser substituído por revisão interna no início, recomendado antes de escalar |
| Encarregado de dados (DPO) | Pode ser acumulado ou terceirizado |

## 4. Custos futuros por funcionalidade

| Funcionalidade | Custo provável |
|---------------|----------------|
| WhatsApp (API oficial) | Cobrança por conversa/mensagem + provedor |
| SMS | Por mensagem |
| Gateway de pagamento | Percentual por transação |
| Emissão de nota fiscal | Provedor por nota/mês |
| TISS / RNDS / ICP-Brasil | Certificado digital, credenciamento, homologação |
| Multiunidade em escala | Upgrade de computação do banco |

## 5. Alternativas ao Vercel Pro (avaliar na Fase 10)
Hospedar o Next.js em Cloudflare (via adaptador OpenNext), Netlify, Render, Railway ou Fly.io.
Critérios: termos de uso comercial, região próxima ao Brasil, custo por tráfego, compatibilidade
com recursos do Next.js usados. Decisão em D-10.
