import Link from "next/link";
import type { ReactNode } from "react";
import {
  AlarmClock, BadgeCheck, Ban, Building2, CalendarClock, CalendarCog, CalendarDays, CalendarRange, CalendarX2, CircleDollarSign,
  ClipboardList, Clock, FileSpreadsheet, Globe, HeartPulse, KeyRound, ListChecks, Lock, LogIn, MailPlus, MessageSquareOff,
  Palette, Receipt, Repeat, Rocket, Search, ShieldCheck, Smile, Sparkles, Stethoscope, Tags, Timer, UserPlus, UserX, Users,
  Wallet, type LucideIcon,
} from "lucide-react";
import { BrandMark, Wordmark } from "@/ui/brand";
import { cn } from "@/lib/cn";
import { Bullets, Eyebrow, FeatureCard, Hl, Lead, SlideTitle, Split, Stat, Steps } from "./layouts";
import {
  MockAudit, MockBooking, MockHistory, MockHomes, MockOpportunities, MockOpportunityCard, MockPermissions, MockStatusFlow,
  MockWeek, SecurityBadges,
} from "./mockups";

/*
 * Roteiro da apresentação pública (/apresentacao). Só funções que existem hoje; o que ainda
 * não está pronto aparece como "Em breve". Toda tela de exemplo usa dados fictícios.
 */

export type Profile = "gestao" | "recepcao" | "profissional";

export const PROFILES: Record<Profile, { label: string; description: string; icon: LucideIcon }> = {
  gestao: { label: "Gestão", description: "Visão completa: agenda, equipe, oportunidades com valores, configurações e segurança.", icon: Building2 },
  recepcao: { label: "Recepção", description: "O dia a dia: agendar, remarcar, lista de espera, retornos e contatos com pacientes.", icon: Users },
  profissional: { label: "Profissional", description: "A sua agenda, os seus pacientes e as suas oportunidades, sem ruído.", icon: Stethoscope },
};

export interface Chapter {
  n: number;
  title: string;
  subtitle: string;
}

export const CHAPTERS: Chapter[] = [
  { n: 0, title: "Abertura", subtitle: "Capa e índice" },
  { n: 1, title: "O smartclin", subtitle: "Problema, proposta e para quem" },
  { n: 2, title: "Primeiros passos", subtitle: "Conta, onboarding e equipe" },
  { n: 3, title: "Agenda", subtitle: "Agendar, remarcar, horários e bloqueios" },
  { n: 4, title: "Pacientes & cadastros", subtitle: "Pacientes, profissionais e serviços" },
  { n: 5, title: "Oportunidades", subtitle: "Horários livres, retornos, orçamentos" },
  { n: 6, title: "Perfis & permissões", subtitle: "Quem vê o quê" },
  { n: 7, title: "Segurança & privacidade", subtitle: "Isolamento, acesso e auditoria" },
  { n: 8, title: "Começando", subtitle: "Rotina, próximos passos e acesso" },
];

export interface SlideContext {
  goToChapter: (n: number) => void;
}

export interface Slide {
  id: string;
  chapter: number;
  title: string;
  /** Palavras para a busca do sumário. */
  keywords: string;
  profiles: Profile[];
  dark?: boolean;
  render: (ctx: SlideContext) => ReactNode;
}

const ALL: Profile[] = ["gestao", "recepcao", "profissional"];
const GP: Profile[] = ["gestao", "profissional"];

/** Brilho e anéis das lâminas escuras, presos à área da lâmina (sem criar rolagem). */
function Decor({ rings }: { rings?: boolean }) {
  return (
    <div aria-hidden className="pointer-events-none absolute -inset-5 overflow-hidden sm:-inset-8 lg:-inset-12">
      <div className="absolute inset-0 bg-[radial-gradient(60%_70%_at_85%_10%,rgb(140_203_242/0.4),transparent_70%),radial-gradient(70%_80%_at_0%_100%,rgb(14_107_184/0.6),transparent_70%)]" />
      {rings && (
        <svg viewBox="0 0 400 400" className="absolute -right-24 -bottom-24 size-[28rem] text-white/[0.07] sm:size-[34rem]">
          {[60, 100, 140, 180].map((r) => (
            <circle key={r} cx="200" cy="200" r={r} fill="none" stroke="currentColor" strokeWidth="18" />
          ))}
        </svg>
      )}
    </div>
  );
}

function Cta({ href, children, primary }: { href: string; children: ReactNode; primary?: boolean }) {
  return (
    <Link
      href={href}
      className={cn(
        "inline-flex h-12 items-center gap-2 rounded-full px-6 font-medium",
        primary ? "bg-[#8ccbf2] text-[#062f5e] hover:brightness-105" : "border border-white/30 text-white hover:bg-white/10",
      )}
    >
      {children}
    </Link>
  );
}

const PRIORITY_TABLE: [string, string, string, string][] = [
  ["Horários livres", "Alta (2 dias)", "Média", "Alta (2 dias)"],
  ["Horário liberado", "Alta", "Alta", "Alta"],
  ["Retorno pendente", "Alta se vencido", "Média", "Média"],
  ["Orçamento parado", "Baixa", "Alta", "Alta"],
  ["Falta sem remarcação", "Alta", "Média", "Média"],
];

export const SLIDES: Slide[] = [
  /* ---------- 0. Abertura ---------- */
  {
    id: "capa", chapter: 0, title: "smartclin — gestão para clínicas", keywords: "capa início abertura", profiles: ALL, dark: true,
    render: () => (
      <div className="relative flex h-full flex-col justify-between gap-8">
        <Decor rings />
        <div className="relative flex items-center gap-3">
          <BrandMark className="size-10 text-xl" />
          <span className="text-caption font-semibold tracking-[0.14em] text-white/80 uppercase">Gestão para clínicas</span>
        </div>
        <div className="relative flex flex-col gap-5">
          <Eyebrow dark>Apresentação da plataforma</Eyebrow>
          <SlideTitle className="max-w-3xl text-[clamp(2.2rem,5.5vw,4.4rem)] text-white">
            A agenda da clínica <Hl dark>cheia</Hl>, a equipe <Hl dark>em sintonia</Hl>.
          </SlideTitle>
          <Lead dark>
            Como o <Wordmark className="text-white" /> organiza agenda, pacientes e equipe — e mostra, todos os dias, os horários e contatos que
            merecem atenção.
          </Lead>
        </div>
        <p className="relative text-caption text-white/70">{CHAPTERS.length - 1} capítulos · {SLIDES.length} lâminas · ~{minutesFor(SLIDES.length)} minutos · exemplos ilustrativos, sem dados reais</p>
      </div>
    ),
  },
  {
    id: "indice", chapter: 0, title: "O que você vai conhecer", keywords: "índice sumário capítulos", profiles: ALL,
    render: ({ goToChapter }) => (
      <div className="grid h-full items-center gap-8 lg:grid-cols-[minmax(0,0.8fr)_minmax(0,1.2fr)]">
        <div className="flex flex-col gap-4">
          <Eyebrow>Índice</Eyebrow>
          <SlideTitle>
            O que você vai <Hl>conhecer</Hl>
          </SlideTitle>
          <Lead>Avance com as setas do teclado, deslize no celular ou abra o sumário a qualquer momento.</Lead>
        </div>
        <ol className="grid gap-2 sm:grid-cols-2">
          {CHAPTERS.slice(1).map((c) => (
            <li key={c.n}>
              <button
                type="button"
                onClick={() => goToChapter(c.n)}
                className="flex w-full items-start gap-3 rounded-[16px] border border-line bg-surface p-3 text-left shadow-sm transition-[border-color] hover:border-accent"
              >
                <span className="tabular font-[family-name:var(--font-display)] text-title-2 leading-none font-semibold text-accent">{String(c.n).padStart(2, "0")}</span>
                <span>
                  <span className="block font-semibold">{c.title}</span>
                  <span className="block text-caption text-ink-2">{c.subtitle}</span>
                </span>
              </button>
            </li>
          ))}
        </ol>
      </div>
    ),
  },

  /* ---------- 1. O smartclin ---------- */
  {
    id: "problema", chapter: 1, title: "O dia a dia de uma clínica", keywords: "problema dor agenda papel whatsapp faltas", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>O contexto</Eyebrow>
          <SlideTitle>
            Cada horário vazio é um atendimento <Hl>que não aconteceu</Hl>
          </SlideTitle>
          <Lead>Agenda em caderno, em planilha ou espalhada no WhatsApp. O que se perde não aparece em lugar nenhum.</Lead>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard icon={CalendarX2} title="Horários vagos">Cancelamentos e buracos na agenda só são notados no próprio dia.</FeatureCard>
          <FeatureCard icon={UserX} title="Faltas sem retorno">Quem faltou não é procurado — e não volta a marcar.</FeatureCard>
          <FeatureCard icon={Repeat} title="Retornos esquecidos">O “volte em 30 dias” combinado na consulta se perde.</FeatureCard>
          <FeatureCard icon={Receipt} title="Orçamentos parados">Propostas enviadas ficam sem acompanhamento.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "proposta", chapter: 1, title: "Tudo da clínica num só lugar", keywords: "solução proposta módulos", profiles: ALL,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>A proposta</Eyebrow>
            <SlideTitle>
              Tudo da clínica <Hl>num só lugar</Hl>
            </SlideTitle>
            <Lead>Uma plataforma simples, feita para a rotina de recepção, profissionais e gestão.</Lead>
            <Bullets
              items={[
                <><strong className="text-ink">Agenda</strong> por profissional, sem conflito de horário.</>,
                <><strong className="text-ink">Pacientes</strong> com histórico e sem cadastro duplicado.</>,
                <><strong className="text-ink">Oportunidades</strong>: horários livres, retornos e orçamentos que pedem ação.</>,
                <><strong className="text-ink">Equipe</strong> com papéis e permissões de verdade.</>,
              ]}
            />
          </>
        }
        visual={<MockWeek />}
      />
    ),
  },
  {
    id: "segmentos", chapter: 1, title: "Feita para cada tipo de clínica", keywords: "medicina odontologia estética segmento", profiles: ["gestao"],
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Para quem</Eyebrow>
          <SlideTitle>
            Um sistema, <Hl>três realidades</Hl>
          </SlideTitle>
          <Lead>O onboarding sugere serviços conforme o segmento, e as Oportunidades priorizam o que mais importa em cada um.</Lead>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FeatureCard icon={HeartPulse} title="Medicina">Consulta e retorno sugeridos. Prioridade para horários vagos, retornos vencidos e faltas.</FeatureCard>
          <FeatureCard icon={Smile} title="Odontologia">Avaliação, limpeza, restauração. Prioridade para orçamentos e continuidade do tratamento.</FeatureCard>
          <FeatureCard icon={Sparkles} title="Estética">Avaliações e procedimentos. Prioridade para propostas e horários disponíveis.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "numeros", chapter: 1, title: "O smartclin em números", keywords: "números perfis garantias", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Em números</Eyebrow>
          <SlideTitle>
            Pensado para <Hl>não dar errado</Hl>
          </SlideTitle>
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
          <Stat value="3" label="perfis de acesso" hint="gestão, recepção e profissional" />
          <Stat value="5" label="situações acompanhadas" hint="nas Oportunidades, por regra fixa" />
          <Stat value="0" label="horários duplicados" hint="o banco impede o conflito" />
          <Stat value="100%" label="dados administrativos" hint="nada de prontuário" />
        </div>
      </div>
    ),
  },

  /* ---------- 2. Primeiros passos ---------- */
  {
    id: "conta", chapter: 2, title: "Crie a conta e comece no mesmo minuto", keywords: "cadastro conta login entrar", profiles: ["gestao"],
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Primeiros passos</Eyebrow>
          <SlideTitle>
            Do cadastro à agenda em <Hl>poucos minutos</Hl>
          </SlideTitle>
        </div>
        <Steps
          steps={[
            { title: "Criar conta", text: "Nome, e-mail e senha. A conta já entra na hora." },
            { title: "Responder 4 perguntas", text: "Tipo de clínica, tamanho da equipe, se você atende e o que quer resolver primeiro." },
            { title: "Revisar e começar", text: "Serviços sugeridos e horário de atendimento prontos para ajustar." },
          ]}
        />
      </div>
    ),
  },
  {
    id: "onboarding", chapter: 2, title: "Onboarding em 4 perguntas", keywords: "onboarding perguntas sugestões serviços", profiles: ["gestao"],
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Onboarding</Eyebrow>
            <SlideTitle>
              A clínica já começa <Hl>configurada</Hl>
            </SlideTitle>
            <Lead>As respostas viram ponto de partida — tudo pode ser alterado depois em Gestão.</Lead>
          </>
        }
        visual={
          <div className="flex flex-col gap-2">
            {[
              ["Tipo de estabelecimento", "Clínica de estética"],
              ["Tamanho da equipe", "2 a 5 pessoas"],
              ["Você também atende?", "Sim, eu atendo"],
              ["O que resolver primeiro", "Organizar a agenda"],
            ].map(([q, a], i) => (
              <div key={q} className="flex items-center gap-3 rounded-[16px] border border-line bg-surface p-3 shadow-sm">
                <span className="tabular grid size-8 shrink-0 place-items-center rounded-full bg-accent text-body-sm font-semibold text-white">{i + 1}</span>
                <span className="min-w-0">
                  <span className="block text-caption text-ink-2">{q}</span>
                  <span className="block font-medium">{a}</span>
                </span>
              </div>
            ))}
            <p className="rounded-[16px] bg-accent-subtle p-3 text-body-sm text-accent">
              Resultado: serviços sugeridos para o segmento + horário de atendimento inicial.
            </p>
          </div>
        }
      />
    ),
  },
  {
    id: "equipe", chapter: 2, title: "Convide a equipe", keywords: "convite equipe papéis membros", profiles: ["gestao"],
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Equipe</Eyebrow>
          <SlideTitle>
            Cada pessoa com o <Hl>papel certo</Hl>
          </SlideTitle>
          <Lead>O convite tem validade e só funciona para o e-mail convidado. A gestão muda papéis ou desativa acessos quando precisar.</Lead>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FeatureCard icon={Building2} title="Gestão">Configura a clínica, a equipe e vê os números.</FeatureCard>
          <FeatureCard icon={Users} title="Recepção">Agenda para todos e acompanha pacientes.</FeatureCard>
          <FeatureCard icon={Stethoscope} title="Profissional">Cuida da própria agenda e dos próprios pacientes.</FeatureCard>
        </div>
        <p className="flex items-center gap-2 text-body-sm text-ink-2">
          <MailPlus className="size-4 text-accent" aria-hidden /> Gestão → Equipe → Convidar
        </p>
      </div>
    ),
  },

  /* ---------- 3. Agenda ---------- */
  {
    id: "agenda-visoes", chapter: 3, title: "Dia, semana ou mês", keywords: "agenda visões dia semana mês calendário", profiles: ALL,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Agenda</Eyebrow>
            <SlideTitle>
              A agenda inteira <Hl>de relance</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Visões de dia, semana e mês; no celular vira lista.",
                "Cada profissional com a sua cor.",
                "Faltas e horários fora do expediente com marca própria; status sempre com ícone e texto, nunca só cor.",
                "Filtros por profissional e serviço.",
              ]}
            />
          </>
        }
        visual={<MockWeek />}
      />
    ),
  },
  {
    id: "agendar", chapter: 3, title: "Agendar em segundos", keywords: "agendar novo agendamento horário livre", profiles: ALL,
    render: () => (
      <Split
        reverse
        text={
          <>
            <Eyebrow>Agendar</Eyebrow>
            <SlideTitle>
              Só aparecem <Hl>horários livres</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Busque o paciente pelo nome ou telefone — ou cadastre ali mesmo.",
                "A duração e o intervalo do serviço já entram na conta.",
                "Se alguém ocupou o horário um segundo antes, o sistema sugere os mais próximos.",
                "Errou? “Desfazer” na hora.",
              ]}
            />
          </>
        }
        visual={<MockBooking />}
      />
    ),
  },
  {
    id: "sem-conflito", chapter: 3, title: "Nenhum horário marcado duas vezes", keywords: "conflito sobreposição garantia banco", profiles: ALL, dark: true,
    render: () => (
      <div className="relative flex h-full flex-col justify-center gap-6">
        <Decor />
        <div className="relative flex flex-col gap-4">
          <Eyebrow dark>Garantia</Eyebrow>
          <SlideTitle className="max-w-3xl text-[clamp(1.9rem,4.4vw,3.4rem)] text-white">
            Duas pessoas, o mesmo horário, ao mesmo tempo: <Hl dark>só uma consegue.</Hl>
          </SlideTitle>
          <Lead dark>
            A regra mora no banco de dados, não na tela. Mesmo com cliques simultâneos, um profissional nunca tem dois atendimentos sobrepostos — e nada é
            marcado fora do horário de atendimento ou em um bloqueio.
          </Lead>
        </div>
        <div className="relative grid gap-3 sm:grid-cols-3">
          <FeatureCard tone="dark" icon={Clock} title="Fuso da clínica">O horário de atendimento é conferido no fuso da clínica.</FeatureCard>
          <FeatureCard tone="dark" icon={Ban} title="Bloqueios respeitados">Pausa, folga, férias e feriado impedem o agendamento.</FeatureCard>
          <FeatureCard tone="dark" icon={BadgeCheck} title="Sem jeitinho">A mesma regra vale para quem agenda e para quem remarca.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "status", chapter: 3, title: "Status que contam a história", keywords: "status concluído faltou cancelado remarcar histórico", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Status</Eyebrow>
          <SlideTitle>
            Cada mudança fica <Hl>registrada</Hl>
          </SlideTitle>
          <Lead>Concluído e Faltou só depois do horário de início. Remarcar mantém o mesmo agendamento — e o histórico mostra quem mudou, quando e por quê.</Lead>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-body-sm font-semibold">
          <span className="rounded-full bg-success-subtle px-3 py-1.5 text-success">Confirmado</span>
          <span aria-hidden className="text-ink-3">→</span>
          <span className="rounded-full bg-muted px-3 py-1.5 text-ink-2">Concluído</span>
          <span className="rounded-full bg-danger-subtle px-3 py-1.5 text-danger">Faltou</span>
          <span className="rounded-full bg-muted px-3 py-1.5 text-ink-2">Cancelado · com motivo</span>
        </div>
        <ol className="flex max-w-xl flex-col gap-1.5 border-l-2 border-line pl-4 text-body-sm">
          <li><span className="font-medium">Confirmado</span> · <span className="text-ink-2">Lia (recepção) · 09/03 10:12</span></li>
          <li><span className="font-medium">Remarcado de 10/03 09:00</span> · <span className="text-ink-2">Lia (recepção) · 09/03 16:40</span></li>
          <li><span className="font-medium">Concluído</span> · <span className="text-ink-2">Dra. Bia · 11/03 09:35</span></li>
        </ol>
      </div>
    ),
  },
  {
    id: "horarios", chapter: 3, title: "Horários de atendimento e bloqueios", keywords: "horário atendimento bloqueio férias feriado pausa folga", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Horários</Eyebrow>
          <SlideTitle>
            A agenda segue a <Hl>vida real</Hl>
          </SlideTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard icon={CalendarCog} title="Semana de atendimento">Faixas por dia, por profissional (ex.: 8h–12h e 14h–18h).</FeatureCard>
          <FeatureCard icon={Timer} title="Pausas e folgas">Intervalos e dias de folga de cada profissional.</FeatureCard>
          <FeatureCard icon={CalendarRange} title="Férias">Período inteiro bloqueado, sem apagar a agenda.</FeatureCard>
          <FeatureCard icon={CalendarDays} title="Feriados">Para a clínica toda de uma vez.</FeatureCard>
        </div>
      </div>
    ),
  },

  /* ---------- 4. Pacientes & cadastros ---------- */
  {
    id: "pacientes", chapter: 4, title: "Pacientes sem duplicidade", keywords: "pacientes cadastro busca duplicidade histórico", profiles: ALL,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Pacientes</Eyebrow>
            <SlideTitle>
              Um cadastro por pessoa, <Hl>com histórico</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Busca por nome ou parte do telefone.",
                "Aviso de possível duplicidade pelo telefone — o sistema avisa, nunca junta sozinho.",
                "Histórico de agendamentos, retornos, lista de espera e orçamentos do paciente.",
                "Exclusão só lógica e só sem agendamentos futuros.",
              ]}
            />
          </>
        }
        visual={
          <div className="flex flex-col gap-2 rounded-[22px] border border-line bg-surface p-4 shadow-sm">
            <span className="flex h-10 items-center gap-2 rounded-[10px] border border-line-strong px-3 text-body-sm text-ink-3">
              <Search className="size-4" aria-hidden /> Buscar por nome ou telefone
            </span>
            {[["Ana Souza", "(11) 90000-0001", "próximo 10/03"], ["Bruno Lima", "(11) 90000-0002", "retorno até 20/03"], ["Carla Dias", "(11) 90000-0003", "orçamento em aberto"]].map(([n, p, s]) => (
              <div key={n} className="flex items-center justify-between gap-3 rounded-[10px] px-2 py-2">
                <span>
                  <span className="block font-medium">{n}</span>
                  <span className="tabular block text-caption text-ink-2">{p}</span>
                </span>
                <span className="text-caption text-accent">{s}</span>
              </div>
            ))}
            <p className="text-center text-caption text-ink-3">Exemplo ilustrativo · dados fictícios</p>
          </div>
        }
      />
    ),
  },
  {
    id: "administrativo", chapter: 4, title: "Só dados administrativos", keywords: "lgpd prontuário dados clínicos privacidade", profiles: ALL, dark: true,
    render: () => (
      <div className="relative flex h-full flex-col justify-center gap-6">
        <Decor />
        <div className="relative flex flex-col gap-4">
          <Eyebrow dark>Privacidade</Eyebrow>
          <SlideTitle className="max-w-3xl text-white">
            Nome, contato e agenda. <Hl dark>Informação clínica, não.</Hl>
          </SlideTitle>
          <Lead dark>
            O smartclin guarda só o administrativo. Todo campo de observação avisa “não registre informações clínicas aqui”, e a auditoria de pacientes guarda
            apenas os nomes dos campos alterados — nunca o conteúdo.
          </Lead>
        </div>
        <div className="relative grid gap-3 sm:grid-cols-3">
          <FeatureCard tone="dark" icon={MessageSquareOff} title="Sem prontuário">Diagnóstico e anamnese ficam fora da plataforma.</FeatureCard>
          <FeatureCard tone="dark" icon={ListChecks} title="O mínimo necessário">Obrigatório só nome e telefone ou e-mail.</FeatureCard>
          <FeatureCard tone="dark" icon={Lock} title="Visibilidade restrita">Profissional vê só os pacientes que atende.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "cadastros", chapter: 4, title: "Profissionais e serviços", keywords: "profissionais serviços preço duração intervalo cor", profiles: ["gestao"],
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Cadastros</Eyebrow>
          <SlideTitle>
            Quem atende, o quê e <Hl>quanto tempo leva</Hl>
          </SlideTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard icon={Stethoscope} title="Profissionais">Especialidade, conselho, cor na agenda e ligação com a conta da pessoa.</FeatureCard>
          <FeatureCard icon={Tags} title="Serviços">Duração, intervalo depois do atendimento e preço (opcional).</FeatureCard>
          <FeatureCard icon={Users} title="Quem realiza">Cada serviço ligado aos profissionais que o fazem.</FeatureCard>
          <FeatureCard icon={Palette} title="Estimativas">O preço alimenta as estimativas do Início e das Oportunidades.</FeatureCard>
        </div>
      </div>
    ),
  },

  /* ---------- 5. Oportunidades ---------- */
  {
    id: "oportunidades", chapter: 5, title: "Oportunidades: o que merece atenção hoje", keywords: "oportunidades central inteligência", profiles: ALL,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Oportunidades</Eyebrow>
            <SlideTitle>
              A central do que <Hl>merece atenção</Hl>
            </SlideTitle>
            <Lead>
              Não é um painel de gráficos: cada cartão é uma situação real da clínica, com origem, prioridade, valor estimado quando dá para calcular e a ação
              certa a um clique.
            </Lead>
            <p className="text-body-sm text-ink-2">Fica dentro do Início — sem mais um item no menu.</p>
          </>
        }
        visual={<MockOpportunities />}
      />
    ),
  },
  {
    id: "cinco-situacoes", chapter: 5, title: "Cinco situações acompanhadas", keywords: "tipos regras horários livres cancelamento retorno orçamento falta", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Regras fixas, sem IA paga</Eyebrow>
          <SlideTitle>
            Cinco situações, <Hl>detectadas sozinhas</Hl>
          </SlideTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
          <FeatureCard icon={CalendarClock} title="Horários livres">Dentro do horário real, descontando bloqueios e agendamentos.</FeatureCard>
          <FeatureCard icon={CalendarX2} title="Horário liberado">Cancelou? Sugere quem está na lista de espera.</FeatureCard>
          <FeatureCard icon={Repeat} title="Retorno pendente">Só os registrados — nada é deduzido do histórico.</FeatureCard>
          <FeatureCard icon={Receipt} title="Orçamento parado">Sem atualização há alguns dias.</FeatureCard>
          <FeatureCard icon={UserX} title="Falta ou cancelamento">Sem novo agendamento, para a recepção acompanhar.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "receita-potencial", chapter: 5, title: "Horários livres viram receita potencial", keywords: "valor cálculo receita potencial preço", profiles: GP,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Como calculamos</Eyebrow>
            <SlideTitle>
              Uma conta que <Hl>qualquer um confere</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Minutos livres do horário de atendimento, já sem bloqueios, agendamentos e reservas.",
                "Divididos pela duração + intervalo do serviço de referência — sem contar o mesmo horário duas vezes.",
                "Vezes o preço de tabela. Sem preço cadastrado? “Valor indisponível”, nunca zero inventado.",
              ]}
            />
          </>
        }
        visual={
          <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 shadow-sm">
            <p className="text-caption font-semibold text-ink-2">Quinta, Dr. Caio · 14:00–17:00</p>
            <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1 font-[family-name:var(--font-display)] text-[clamp(1.5rem,3vw,2.2rem)] font-semibold">
              <span className="tabular">6 horários</span>
              <span className="text-ink-3">×</span>
              <span className="tabular">R$ 150</span>
              <span className="text-ink-3">=</span>
              <span className="tabular text-accent">R$ 900</span>
            </div>
            <p className="text-body-sm text-ink-2">Avaliação de 30 min · o serviço mais agendado com ele nos últimos 90 dias.</p>
            <p className="rounded-[12px] bg-warning-subtle p-3 text-body-sm text-warning">Estimativa pelo preço de tabela — não é faturamento garantido.</p>
          </div>
        }
      />
    ),
  },
  {
    id: "lista-espera", chapter: 5, title: "Cancelou? O horário volta a trabalhar", keywords: "lista de espera cancelamento sugestão agendar", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Cancelamento + lista de espera</Eyebrow>
          <SlideTitle>
            Cancelou? O horário <Hl>volta a trabalhar</Hl>
          </SlideTitle>
          <Lead>Nada é agendado sozinho: o sistema sugere, a equipe confirma. A regra de conflito continua no banco.</Lead>
        </div>
        <Steps
          steps={[
            { title: "Cancelamento", text: "O horário de amanhã às 10h ficou livre." },
            { title: "Horário liberado", text: "Vira oportunidade de prioridade alta na hora." },
            { title: "Quem combina", text: "Lista de espera filtrada por serviço, profissional, dia e período." },
            { title: "Um clique", text: "“Agendar às 10:00” abre a agenda preenchida; quem agendou fica no histórico." },
          ]}
        />
      </div>
    ),
  },
  {
    id: "retornos-orcamentos", chapter: 5, title: "Retornos e orçamentos acompanhados", keywords: "retornos orçamentos propostas prazo contato", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Retornos & orçamentos</Eyebrow>
          <SlideTitle>
            O combinado <Hl>não se perde</Hl>
          </SlideTitle>
        </div>
        <div className="grid gap-4 md:grid-cols-2">
          <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 shadow-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Repeat className="size-5 text-accent" aria-hidden /> Retornos
            </p>
            <Bullets
              items={[
                "Registrado no atendimento: “retorno em 30 dias”.",
                "Aparece perto do prazo; vencido ganha prioridade.",
                "Some quando o paciente é agendado — e volta se o agendamento for cancelado.",
              ]}
            />
            <MockOpportunityCard i={2} compact />
          </div>
          <div className="flex flex-col gap-3 rounded-[22px] border border-line bg-surface p-5 shadow-sm">
            <p className="flex items-center gap-2 font-semibold">
              <Receipt className="size-5 text-accent" aria-hidden /> Orçamentos
            </p>
            <Bullets
              items={[
                "Itens por serviço, total calculado pelo sistema.",
                "Parado há 7 dias (ajustável)? Vira lembrete.",
                "Aceito, recusado ou vencido sai da lista sozinho.",
              ]}
            />
            <MockOpportunityCard i={3} compact />
          </div>
        </div>
      </div>
    ),
  },
  {
    id: "fluxo", chapter: 5, title: "Um fluxo de trabalho claro", keywords: "status contato responsável resolver descartar histórico", profiles: ALL,
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Fluxo de trabalho</Eyebrow>
            <SlideTitle>
              Quem fez, <Hl>o quê e quando</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Registrar tentativa de contato (não atendeu, vai retornar…).",
                "Atribuir um responsável da equipe.",
                "Resolver, ou descartar com motivo — que fica guardado.",
                "Reabrir só quando a situação volta, pelo próprio sistema.",
              ]}
            />
          </>
        }
        visual={
          <div className="flex flex-col gap-4 rounded-[22px] border border-line bg-surface p-5 shadow-sm">
            <MockStatusFlow />
            <MockHistory />
          </div>
        }
      />
    ),
  },
  {
    id: "valores", chapter: 5, title: "Valores transparentes", keywords: "receita realizada prevista potencial orçamentos separação", profiles: GP,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Valores</Eyebrow>
          <SlideTitle>
            Cada número <Hl>no seu lugar</Hl>
          </SlideTitle>
          <Lead>Nada é somado com o que não é da mesma natureza. E só quem pode ver valores recebe os valores.</Lead>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard icon={BadgeCheck} title="Realizada">Atendimentos concluídos (estimativa pelo preço, até o Financeiro chegar).</FeatureCard>
          <FeatureCard icon={CalendarDays} title="Prevista">Agendamentos confirmados até o fim do mês.</FeatureCard>
          <FeatureCard icon={Wallet} title="Potencial em risco">Horários livres e liberados nos próximos dias.</FeatureCard>
          <FeatureCard icon={CircleDollarSign} title="Orçamentos">À parte: nem receita garantida, nem perdida.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "prioridades", chapter: 5, title: "Prioridades por segmento", keywords: "prioridade medicina odontologia estética configuração", profiles: ["gestao"],
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Configurações</Eyebrow>
          <SlideTitle>
            Prioridades que <Hl>já vêm prontas</Hl>
          </SlideTitle>
          <Lead>Padrões por segmento, ajustáveis em Gestão → Oportunidades — junto com prazos, profissionais incluídos e quem vê valores.</Lead>
        </div>
        <div className="overflow-x-auto rounded-[22px] border border-line bg-surface shadow-sm">
          <table className="w-full min-w-[32rem] text-left text-body-sm">
            <caption className="sr-only">Prioridade padrão por segmento</caption>
            <thead className="bg-canvas text-caption text-ink-2">
              <tr>
                <th scope="col" className="px-4 py-2.5 font-semibold">Situação</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Medicina</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Odontologia</th>
                <th scope="col" className="px-4 py-2.5 font-semibold">Estética</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {PRIORITY_TABLE.map((r) => (
                <tr key={r[0]}>
                  <th scope="row" className="px-4 py-2.5 font-medium">{r[0]}</th>
                  {r.slice(1).map((c, i) => (
                    <td key={i} className="px-4 py-2.5 text-ink-2">
                      {c}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    ),
  },

  /* ---------- 6. Perfis & permissões ---------- */
  {
    id: "permissoes", chapter: 6, title: "Cada perfil vê o que precisa", keywords: "permissões perfis gestão recepção profissional acesso", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Perfis & permissões</Eyebrow>
          <SlideTitle>
            Cada perfil vê <Hl>o que precisa</Hl>
          </SlideTitle>
          <Lead>As regras valem no servidor e no banco — esconder um botão na tela nunca é a única proteção.</Lead>
        </div>
        <MockPermissions />
      </div>
    ),
  },
  {
    id: "inicio-perfil", chapter: 6, title: "Um Início para cada um", keywords: "início tela inicial perfil", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Início</Eyebrow>
          <SlideTitle>
            Abriu, <Hl>já sabe o que fazer</Hl>
          </SlideTitle>
        </div>
        <MockHomes />
      </div>
    ),
  },

  /* ---------- 7. Segurança & privacidade ---------- */
  {
    id: "isolamento", chapter: 7, title: "Cada clínica isolada", keywords: "segurança isolamento multiempresa rls", profiles: ["gestao"], dark: true,
    render: () => (
      <div className="relative flex h-full flex-col justify-center gap-6">
        <Decor rings />
        <div className="relative flex flex-col gap-4">
          <Eyebrow dark>Segurança</Eyebrow>
          <SlideTitle className="max-w-3xl text-white">
            Os dados de uma clínica <Hl dark>nunca aparecem em outra.</Hl>
          </SlideTitle>
          <Lead dark>
            Cada registro pertence a uma clínica, e o próprio banco recusa ligar paciente, profissional ou serviço de clínicas diferentes. Testes automáticos
            conferem isso a cada mudança no sistema.
          </Lead>
        </div>
        <div className="relative">
          <SecurityBadges />
        </div>
      </div>
    ),
  },
  {
    id: "acesso", chapter: 7, title: "Acesso protegido", keywords: "senha mfa duas etapas bloqueio tentativas", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Acesso</Eyebrow>
          <SlideTitle>
            Entrar é fácil. <Hl>Invadir, não.</Hl>
          </SlideTitle>
        </div>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <FeatureCard icon={KeyRound} title="Senha forte">Mínimo de 10 caracteres; senhas nunca guardadas em texto.</FeatureCard>
          <FeatureCard icon={AlarmClock} title="Pausa por tentativas">Muitas senhas erradas pausam o acesso daquele e-mail.</FeatureCard>
          <FeatureCard icon={ShieldCheck} title="Duas etapas">Código do aplicativo autenticador, opcional por pessoa.</FeatureCard>
          <FeatureCard icon={LogIn} title="Sessões encerradas">Trocar a senha desconecta os outros aparelhos.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "auditoria", chapter: 7, title: "Tudo registrado", keywords: "auditoria registro histórico quem fez", profiles: ["gestao"],
    render: () => (
      <Split
        text={
          <>
            <Eyebrow>Auditoria</Eyebrow>
            <SlideTitle>
              Quem fez o quê, <Hl>para sempre</Hl>
            </SlideTitle>
            <Bullets
              items={[
                "Equipe, convites, cadastros, agenda e configurações.",
                "O registro não pode ser alterado nem apagado.",
                "Filtros por período, tipo e pessoa.",
                "Dados de pacientes: só os nomes dos campos alterados.",
              ]}
            />
          </>
        }
        visual={<MockAudit />}
      />
    ),
  },

  /* ---------- 8. Começando ---------- */
  {
    id: "rotina", chapter: 8, title: "Uma rotina simples", keywords: "rotina dia a dia começar uso", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Rotina sugerida</Eyebrow>
          <SlideTitle>
            Quatro momentos, <Hl>nenhum esforço extra</Hl>
          </SlideTitle>
        </div>
        <Steps
          steps={[
            { title: "Ao abrir", text: "Início: agenda de hoje, pendências e o resumo das Oportunidades." },
            { title: "Durante o dia", text: "Agenda: agendar, remarcar, marcar Concluído ou Faltou." },
            { title: "Entre atendimentos", text: "Oportunidades: horários liberados, retornos e contatos do dia." },
            { title: "No fim do dia", text: "Registrar retornos combinados e revisar orçamentos parados." },
          ]}
        />
      </div>
    ),
  },
  {
    id: "em-breve", chapter: 8, title: "O que vem por aí", keywords: "em breve próximos agendamento online financeiro importação", profiles: ALL,
    render: () => (
      <div className="flex h-full flex-col justify-center gap-6">
        <div className="flex flex-col gap-3">
          <Eyebrow>Próximos passos</Eyebrow>
          <SlideTitle>
            O que <Hl>vem por aí</Hl>
          </SlideTitle>
          <Lead>Já desenhado e no plano de fases — aparece no sistema como “Em breve” até ficar pronto.</Lead>
        </div>
        <div className="grid gap-3 md:grid-cols-3">
          <FeatureCard icon={Globe} title="Agendamento online">Página pública da clínica: o paciente pede, a equipe aprova.</FeatureCard>
          <FeatureCard icon={Wallet} title="Financeiro">Recebimentos e despesas, ligados aos atendimentos.</FeatureCard>
          <FeatureCard icon={FileSpreadsheet} title="Importar e exportar">Trazer pacientes de planilhas e levar os dados quando quiser.</FeatureCard>
        </div>
      </div>
    ),
  },
  {
    id: "encerramento", chapter: 8, title: "Pronto para começar?", keywords: "acessar entrar criar conta fim", profiles: ALL, dark: true,
    render: () => (
      <div className="relative flex h-full flex-col items-start justify-center gap-6">
        <Decor rings />
        <BrandMark className="relative size-16 text-3xl" />
        <div className="relative flex flex-col gap-4">
          <SlideTitle className="max-w-3xl text-[clamp(2rem,5vw,3.8rem)] text-white">
            Pronto para deixar a agenda <Hl dark>trabalhar por você?</Hl>
          </SlideTitle>
          <Lead dark>Crie a conta da sua clínica ou entre com o convite que você recebeu.</Lead>
        </div>
        <div className="relative flex flex-wrap gap-3">
          <Cta href="/cadastro" primary>
            <UserPlus className="size-5" aria-hidden /> Criar conta
          </Cta>
          <Cta href="/login">
            <LogIn className="size-5" aria-hidden /> Entrar
          </Cta>
        </div>
        <p className="relative flex items-center gap-2 text-caption text-white/70">
          <Rocket className="size-4" aria-hidden /> Versão de testes: use apenas dados fictícios.
        </p>
      </div>
    ),
  },
];

export const minutesFor = (n: number) => Math.max(1, Math.round(n * 0.5));
export const slidesInChapter = (n: number) => SLIDES.filter((s) => s.chapter === n).length;
// Ícone de capítulo para o índice da página inicial.
export const CHAPTER_ICON: Record<number, LucideIcon> = {
  0: Sparkles, 1: ClipboardList, 2: Rocket, 3: CalendarDays, 4: Users, 5: Sparkles, 6: KeyRound, 7: ShieldCheck, 8: LogIn,
};
