"use client";

import Link from "next/link";
import { useState } from "react";
import {
  ArrowRight, Check, CheckCircle2, CircleHelp, Layers, ListOrdered, LogIn, Play, RotateCcw, Route, Sparkles, X,
  type LucideIcon,
} from "lucide-react";
import { BrandMark, Wordmark } from "@/ui/brand";
import { cn } from "@/lib/cn";
import { CHAPTERS, CHAPTER_ICON, PROFILES, SLIDES, minutesFor, slidesInChapter, type Profile } from "./content";
import { deckSlides } from "./route";

/*
 * Página inicial da apresentação pública: escolher como explorar (completa, trilha por perfil,
 * antes × depois, teste rápido) e o índice. Sem login e sem dado real.
 */

const total = SLIDES.length;
const chapters = CHAPTERS.length - 1;

export function Home({ onStart }: { onStart: (trail: Profile | null, index: number) => void }) {
  return (
    <div className="relative min-h-dvh overflow-hidden bg-[#031e40] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-x-0 top-0 h-[60rem] bg-[radial-gradient(900px_620px_at_80%_10%,rgb(14_107_184/0.6),transparent_62%),radial-gradient(700px_520px_at_10%_30%,rgb(140_203_242/0.22),transparent_60%)]" />
      <a href="#conteudo" className="sr-only z-[70] rounded-full bg-white px-4 py-2 text-ink focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <Header />
      <main id="conteudo" className="relative">
        <Hero onStart={onStart} />
        <Explore />
        <Trails onStart={onStart} />
        <BeforeAfter />
        <Quiz onStart={onStart} />
        <Index onStart={onStart} />
        <Closing />
      </main>
    </div>
  );
}

function Header() {
  const links = [
    ["#inicio", "Início"],
    ["#explorar", "Apresentação"],
    ["#trilhas", "Trilhas"],
    ["#antes-depois", "Antes × Com"],
    ["#teste", "Teste rápido"],
    ["#indice", "Índice"],
  ];
  return (
    <header className="sticky top-0 z-40 border-b border-white/10 bg-[#031e40]/75 backdrop-blur-xl">
      <div className="mx-auto flex h-16 max-w-6xl items-center gap-4 px-4">
        <a href="#inicio" className="flex items-center gap-2.5">
          <BrandMark className="size-8 text-base" />
          <span className="leading-tight">
            <Wordmark className="block text-lg text-white" />
            <span className="block text-[11px] text-white/70">Apresentação da plataforma</span>
          </span>
        </a>
        <nav aria-label="Seções" className="ml-auto hidden lg:block">
          <ul className="flex gap-1">
            {links.map(([href, label]) => (
              <li key={href}>
                <a href={href} className="rounded-full px-3 py-2 text-body-sm text-white/80 hover:bg-white/10 hover:text-white">
                  {label}
                </a>
              </li>
            ))}
          </ul>
        </nav>
        <Link href="/login" className="ml-auto inline-flex h-10 items-center gap-2 rounded-full bg-[#8ccbf2] px-4 text-body-sm font-semibold text-[#062f5e] hover:brightness-105 lg:ml-0">
          <LogIn className="size-4" aria-hidden /> Acessar
        </Link>
      </div>
    </header>
  );
}

function Hero({ onStart }: { onStart: (trail: Profile | null, index: number) => void }) {
  return (
    <section id="inicio" aria-labelledby="hero-title" className="mx-auto grid max-w-6xl items-center gap-12 px-4 pt-14 pb-16 lg:grid-cols-[minmax(0,1.1fr)_minmax(0,0.9fr)] lg:pt-20">
      <div className="flex flex-col gap-6">
        <p className="flex items-center gap-3 text-caption font-semibold tracking-[0.14em] text-[#8ccbf2] uppercase">
          <span aria-hidden className="h-px w-8 bg-[#8ccbf2]" /> Apresentação interativa
        </p>
        <h1 id="hero-title" className="font-[family-name:var(--font-display)] text-[clamp(2.6rem,7vw,4.8rem)] leading-[1.02] font-semibold tracking-[-0.03em]">
          Conheça o{" "}
          <span className="bg-[linear-gradient(120deg,#8ccbf2,#ffffff_70%)] bg-clip-text text-transparent">smartclin</span>
        </h1>
        <p className="max-w-xl text-[clamp(1rem,1.6vw,1.2rem)] leading-relaxed text-white/80">
          A plataforma de gestão da clínica: como funciona a agenda, quem faz o quê e como os horários livres, retornos e orçamentos viram ações do dia — com
          segurança e sem dados clínicos.
        </p>
        <div className="flex flex-wrap gap-3">
          <button type="button" onClick={() => onStart(null, 0)} className="inline-flex h-12 items-center gap-2 rounded-full bg-[#8ccbf2] px-6 font-semibold text-[#062f5e] hover:brightness-105">
            <Play className="size-5" aria-hidden /> Assistir apresentação
          </button>
          <a href="#trilhas" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/25 px-6 font-medium text-white hover:bg-white/10">
            <Route className="size-5" aria-hidden /> Montar minha trilha
          </a>
        </div>
        <ul className="flex flex-wrap gap-x-8 gap-y-3">
          {[
            [String(chapters), "capítulos"],
            [String(total), "lâminas"],
            [`~${minutesFor(total)}`, "minutos"],
          ].map(([v, l]) => (
            <li key={l} className="flex items-baseline gap-2">
              <span className="tabular font-[family-name:var(--font-display)] text-3xl font-semibold">{v}</span>
              <span className="text-body-sm text-white/70">{l}</span>
            </li>
          ))}
        </ul>
      </div>
      <Orbit />
    </section>
  );
}

/** Ilustração da abertura: a marca no centro, situações reais da plataforma em órbita. */
function Orbit() {
  const chips: { text: string; sub: string; className: string }[] = [
    { text: "Agenda sem conflito", sub: "garantido no banco", className: "left-0 top-[12%]" },
    { text: "6 horários livres", sub: "R$ 900 estimados", className: "right-0 top-[38%]" },
    { text: "Retorno agendado", sub: "oportunidade resolvida", className: "left-[8%] bottom-[10%]" },
  ];
  return (
    <div aria-hidden className="relative mx-auto aspect-square w-full max-w-[26rem]">
      {[100, 78, 56].map((s, i) => (
        <span
          key={s}
          className="orbit-ring absolute top-1/2 left-1/2 rounded-full border border-dashed border-white/15"
          style={{ width: `${s}%`, height: `${s}%`, translate: "-50% -50%", animationDuration: `${40 + i * 18}s`, animationDirection: i % 2 ? "reverse" : "normal" }}
        />
      ))}
      <span className="absolute top-1/2 left-1/2 size-[34%] -translate-x-1/2 -translate-y-1/2 rounded-[30%] bg-[#8ccbf2]/25 blur-2xl" />
      <BrandMark className="absolute top-1/2 left-1/2 size-[30%] -translate-x-1/2 -translate-y-1/2 text-[clamp(2.5rem,8vw,4.5rem)]" />
      {chips.map((c, i) => (
        <span
          key={c.text}
          className={cn("float-chip absolute flex items-center gap-2 rounded-[16px] bg-white px-3 py-2 text-[#062f5e] shadow-[0_12px_30px_rgb(0_0_0/0.3)]", c.className)}
          style={{ animationDelay: `${i * 1.3}s` }}
        >
          <CheckCircle2 className="size-4 shrink-0 text-[#0e6bb8]" />
          <span className="leading-tight">
            <span className="block text-body-sm font-semibold">{c.text}</span>
            <span className="block text-[11px] text-[#3c5878]">{c.sub}</span>
          </span>
        </span>
      ))}
    </div>
  );
}

function SectionHead({ id, eyebrow, title, text }: { id: string; eyebrow: string; title: string; text?: string }) {
  return (
    <div className="mb-8 flex flex-col gap-3">
      <p className="text-caption font-semibold tracking-[0.14em] text-[#8ccbf2] uppercase">{eyebrow}</p>
      <h2 id={id} className="font-[family-name:var(--font-display)] text-[clamp(1.7rem,3.6vw,2.6rem)] leading-tight font-semibold tracking-[-0.02em]">
        {title}
      </h2>
      {text && <p className="max-w-2xl text-white/75">{text}</p>}
    </div>
  );
}

function Explore() {
  const items: { icon: LucideIcon; title: string; text: string; href: string }[] = [
    { icon: Play, title: "Apresentação completa", text: `${total} lâminas em ${chapters} capítulos, com setas, deslize e tela cheia.`, href: "#s/1" },
    { icon: Route, title: "Trilha por perfil", text: "Gestão, recepção ou profissional: só o que importa para você.", href: "#trilhas" },
    { icon: Layers, title: "Antes × Com o smartclin", text: "Cartões que viram: como era e como fica com a plataforma.", href: "#antes-depois" },
    { icon: CircleHelp, title: "Teste rápido", text: "6 perguntas para fixar as regras mais importantes.", href: "#teste" },
  ];
  return (
    <section id="explorar" aria-labelledby="explorar-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <SectionHead id="explorar-title" eyebrow="Como explorar" title="Escolha o seu caminho" />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {items.map((i) => (
          <li key={i.title}>
            <a href={i.href} className="group flex h-full flex-col gap-3 rounded-[22px] border border-white/12 bg-white/[0.06] p-5 transition-[background-color,border-color] hover:border-white/30 hover:bg-white/[0.1]">
              <span className="grid size-11 place-items-center rounded-[14px] bg-[#8ccbf2]/15 text-[#8ccbf2]">
                <i.icon className="size-5" aria-hidden />
              </span>
              <span className="text-headline font-semibold">{i.title}</span>
              <span className="text-body-sm text-white/75">{i.text}</span>
              <span className="mt-auto inline-flex items-center gap-1 text-body-sm font-medium text-[#8ccbf2]">
                Abrir <ArrowRight className="size-4 transition-transform group-hover:translate-x-0.5 motion-reduce:transition-none" aria-hidden />
              </span>
            </a>
          </li>
        ))}
      </ul>
    </section>
  );
}

function Trails({ onStart }: { onStart: (trail: Profile | null, index: number) => void }) {
  return (
    <section id="trilhas" aria-labelledby="trilhas-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <SectionHead id="trilhas-title" eyebrow="Trilhas" title="Uma apresentação para cada papel" text="Cada trilha mostra só as lâminas que fazem sentido para quem vai usar." />
      <ul className="grid gap-3 md:grid-cols-3">
        {(Object.keys(PROFILES) as Profile[]).map((p) => {
          const meta = PROFILES[p];
          const n = deckSlides(p).length;
          return (
            <li key={p} className="flex flex-col gap-4 rounded-[22px] border border-white/12 bg-white/[0.06] p-5">
              <span className="grid size-12 place-items-center rounded-[16px] bg-white text-[#0e6bb8]">
                <meta.icon className="size-6" aria-hidden />
              </span>
              <div>
                <h3 className="text-title-2 font-semibold">{meta.label}</h3>
                <p className="mt-1 text-body-sm text-white/75">{meta.description}</p>
              </div>
              <p className="tabular text-caption text-white/70">
                {n} lâminas · ~{minutesFor(n)} min
              </p>
              <button
                type="button"
                onClick={() => onStart(p, 0)}
                className="mt-auto inline-flex h-11 items-center justify-center gap-2 rounded-full border border-white/25 font-medium hover:bg-white/10"
              >
                Começar trilha {meta.label.toLowerCase()} <ArrowRight className="size-4" aria-hidden />
              </button>
            </li>
          );
        })}
      </ul>
    </section>
  );
}

const CARDS: { topic: string; before: string; after: string }[] = [
  { topic: "Agenda", before: "Caderno, planilha e WhatsApp. Dois pacientes no mesmo horário.", after: "Agenda única por profissional. O banco impede dois atendimentos no mesmo horário." },
  { topic: "Horários vagos", before: "Buracos na agenda percebidos só no próprio dia.", after: "Horários livres dos próximos dias, com valor estimado e quem pode ocupar." },
  { topic: "Cancelamentos", before: "Cancelou, o horário ficou vazio.", after: "Vira oportunidade na hora, com a lista de espera compatível a um clique." },
  { topic: "Retornos", before: "“Volte em 30 dias” combinado e esquecido.", after: "Retorno registrado com prazo: aparece na hora certa e some quando é agendado." },
  { topic: "Orçamentos", before: "Proposta enviada e nunca mais lembrada.", after: "Orçamento parado vira lembrete, com histórico de cada contato." },
  { topic: "Equipe", before: "Todo mundo vê tudo, inclusive valores.", after: "Cada perfil vê o que precisa; valores só para quem pode." },
];

function BeforeAfter() {
  return (
    <section id="antes-depois" aria-labelledby="antes-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <SectionHead id="antes-title" eyebrow="Antes × Com o smartclin" title="Vire os cartões" text="Toque ou clique em cada cartão para ver como fica com a plataforma." />
      <ul className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        {CARDS.map((c) => (
          <li key={c.topic}>
            <FlipCard {...c} />
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Os dois lados ficam no nome do botão; o giro é só visual (e some com "reduzir movimento"). */
function FlipCard({ topic, before, after }: { topic: string; before: string; after: string }) {
  const [flipped, setFlipped] = useState(false);
  return (
    <button type="button" aria-pressed={flipped} onClick={() => setFlipped((f) => !f)} className="flip block h-60 w-full text-left [perspective:1200px]">
      <span className="flip-inner relative block size-full">
        <span className="flip-face flip-front absolute inset-0 flex flex-col gap-3 rounded-[22px] border border-white/12 bg-white/[0.06] p-5">
          <span className="text-caption font-semibold tracking-[0.12em] text-white/70 uppercase">Antes · {topic}</span>
          <span className="text-headline leading-snug font-semibold">{before}</span>
          <span className="mt-auto inline-flex items-center gap-1 text-body-sm text-[#8ccbf2]">
            <RotateCcw className="size-4" aria-hidden /> Ver com o smartclin
          </span>
        </span>
        <span className="flip-face flip-back absolute inset-0 flex flex-col gap-3 rounded-[22px] bg-white p-5 text-[#062f5e]">
          <span className="text-caption font-semibold tracking-[0.12em] text-[#0e6bb8] uppercase">Com o smartclin · {topic}</span>
          <span className="text-headline leading-snug font-semibold">{after}</span>
          <span className="mt-auto inline-flex items-center gap-1 text-body-sm text-[#0e6bb8]">
            <Check className="size-4" aria-hidden /> Toque para voltar
          </span>
        </span>
      </span>
    </button>
  );
}

const QUESTIONS: { q: string; options: string[]; answer: number; why: string; chapter: number }[] = [
  {
    q: "Duas pessoas tentam agendar o mesmo horário, com o mesmo profissional, ao mesmo tempo. O que acontece?",
    options: ["As duas ficam marcadas", "Só uma consegue; o sistema sugere outros horários para a outra", "O sistema escolhe um paciente sozinho"],
    answer: 1, why: "A regra de conflito fica no banco de dados: um profissional nunca tem dois atendimentos sobrepostos.", chapter: 3,
  },
  {
    q: "Um horário foi cancelado. O smartclin agenda alguém da lista de espera automaticamente?",
    options: ["Sim, o primeiro da fila", "Não: sugere quem combina e a equipe confirma", "Só se a gestão aprovar depois"],
    answer: 1, why: "Nada é agendado sozinho. A oportunidade mostra quem combina com o horário e abre a agenda preenchida.", chapter: 5,
  },
  {
    q: "Quem vê os valores estimados das oportunidades, por padrão?",
    options: ["Toda a equipe", "A gestão, e cada profissional nos próprios", "Ninguém"],
    answer: 1, why: "A recepção pode passar a ver se a gestão liberar em Gestão → Oportunidades.", chapter: 6,
  },
  {
    q: "Onde registrar o diagnóstico de um paciente no smartclin?",
    options: ["Nas observações do agendamento", "Em lugar nenhum: a plataforma guarda só dados administrativos", "No orçamento"],
    answer: 1, why: "Os campos de observação avisam para não registrar informações clínicas.", chapter: 4,
  },
  {
    q: "Um paciente faltou e não marcou de novo. Como isso aparece?",
    options: ["Como “paciente desinteressado”", "Como uma oportunidade de acompanhamento, sem rótulo", "Não aparece"],
    answer: 1, why: "Falta é um fato a acompanhar — a plataforma nunca rotula o paciente.", chapter: 5,
  },
  {
    q: "Um orçamento de R$ 1.450 está em aberto. Como ele entra na conta?",
    options: ["Como receita garantida", "Como receita perdida", "À parte: nem garantida, nem perdida"],
    answer: 2, why: "Orçamentos ficam separados da receita potencial dos horários livres.", chapter: 5,
  },
];

function Quiz({ onStart }: { onStart: (trail: Profile | null, index: number) => void }) {
  const [step, setStep] = useState(0);
  const [picked, setPicked] = useState<number | null>(null);
  const [checked, setChecked] = useState(false);
  const [score, setScore] = useState(0);
  const done = step >= QUESTIONS.length;
  const item = QUESTIONS[step];
  const restart = () => {
    setStep(0);
    setPicked(null);
    setChecked(false);
    setScore(0);
  };

  return (
    <section id="teste" aria-labelledby="teste-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <SectionHead id="teste-title" eyebrow="Teste rápido" title="Você já entendeu as regras?" text={`${QUESTIONS.length} perguntas rápidas sobre o que torna o smartclin seguro e útil.`} />
      <div className="max-w-3xl rounded-[28px] border border-white/12 bg-white/[0.06] p-5 sm:p-7">
        {done ? (
          <div className="flex flex-col items-start gap-4" role="status">
            <Sparkles className="size-8 text-[#8ccbf2]" aria-hidden />
            <p className="font-[family-name:var(--font-display)] text-title-1 font-semibold">
              Você acertou {score} de {QUESTIONS.length}
            </p>
            <p className="text-white/75">{score === QUESTIONS.length ? "Perfeito: você já sabe como a plataforma funciona." : "Quer revisar? A apresentação completa explica cada regra."}</p>
            <div className="flex flex-wrap gap-3">
              <button type="button" onClick={restart} className="inline-flex h-11 items-center gap-2 rounded-full border border-white/25 px-5 font-medium hover:bg-white/10">
                <RotateCcw className="size-4" aria-hidden /> Refazer
              </button>
              <button type="button" onClick={() => onStart(null, 0)} className="inline-flex h-11 items-center gap-2 rounded-full bg-[#8ccbf2] px-5 font-semibold text-[#062f5e]">
                <Play className="size-4" aria-hidden /> Ver a apresentação
              </button>
            </div>
          </div>
        ) : (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (picked === null) return;
              if (!checked) {
                setChecked(true);
                if (picked === item.answer) setScore((s) => s + 1);
                return;
              }
              setStep((s) => s + 1);
              setPicked(null);
              setChecked(false);
            }}
          >
            <fieldset>
              <legend className="mb-1 text-caption text-white/70">
                Pergunta {step + 1} de {QUESTIONS.length}
              </legend>
              <p className="mb-4 text-title-2 leading-snug font-semibold">{item.q}</p>
              <div className="flex flex-col gap-2">
                {item.options.map((o, i) => {
                  const right = checked && i === item.answer;
                  const wrong = checked && i === picked && i !== item.answer;
                  return (
                    <label
                      key={o}
                      className={cn(
                        "flex cursor-pointer items-center gap-3 rounded-[16px] border p-3.5 has-[:focus-visible]:ring-2 has-[:focus-visible]:ring-[#8ccbf2]",
                        right ? "border-[#7be0a8] bg-[#7be0a8]/15" : wrong ? "border-[#ff9aa8] bg-[#ff9aa8]/15" : picked === i ? "border-[#8ccbf2] bg-white/10" : "border-white/15 hover:bg-white/5",
                      )}
                    >
                      <input type="radio" name={`q-${step}`} checked={picked === i} disabled={checked} onChange={() => setPicked(i)} className="size-4 accent-[#8ccbf2]" />
                      <span className="flex-1">{o}</span>
                      {right && (
                        <>
                          <Check className="size-5 text-[#7be0a8]" aria-hidden />
                          <span className="sr-only">(resposta certa)</span>
                        </>
                      )}
                      {wrong && (
                        <>
                          <X className="size-5 text-[#ff9aa8]" aria-hidden />
                          <span className="sr-only">(sua resposta)</span>
                        </>
                      )}
                    </label>
                  );
                })}
              </div>
            </fieldset>
            <div aria-live="polite" className="mt-4 min-h-6 text-body-sm">
              {checked && (
                <p className={picked === item.answer ? "text-[#7be0a8]" : "text-[#ffc2ca]"}>
                  <strong>{picked === item.answer ? "Isso!" : "Quase."}</strong> {item.why}{" "}
                  <button type="button" onClick={() => onStart(null, Math.max(0, SLIDES.findIndex((s) => s.chapter === item.chapter)))} className="font-medium text-[#8ccbf2] underline underline-offset-2">
                    Ver na apresentação
                  </button>
                </p>
              )}
            </div>
            <button type="submit" disabled={picked === null} className="mt-4 inline-flex h-11 items-center gap-2 rounded-full bg-[#8ccbf2] px-5 font-semibold text-[#062f5e] disabled:opacity-40">
              {checked ? (step + 1 === QUESTIONS.length ? "Ver resultado" : "Próxima pergunta") : "Confirmar"}
              <ArrowRight className="size-4" aria-hidden />
            </button>
          </form>
        )}
      </div>
    </section>
  );
}

function Index({ onStart }: { onStart: (trail: Profile | null, index: number) => void }) {
  return (
    <section id="indice" aria-labelledby="indice-title" className="mx-auto max-w-6xl scroll-mt-20 px-4 py-14">
      <div className="mb-8 flex flex-wrap items-end justify-between gap-3">
        <SectionHead id="indice-title" eyebrow="Índice" title="Todos os capítulos" />
        <button type="button" onClick={() => onStart(null, 0)} className="mb-8 inline-flex h-10 items-center gap-2 rounded-full border border-white/25 px-4 text-body-sm font-medium hover:bg-white/10">
          <ListOrdered className="size-4" aria-hidden /> Ver todas as lâminas
        </button>
      </div>
      <ol className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {CHAPTERS.slice(1).map((c) => {
          const Icon = CHAPTER_ICON[c.n];
          return (
            <li key={c.n}>
              <button
                type="button"
                onClick={() => onStart(null, SLIDES.findIndex((s) => s.chapter === c.n))}
                className="flex h-full w-full flex-col gap-2 rounded-[22px] border border-white/12 bg-white/[0.06] p-5 text-left hover:border-white/30 hover:bg-white/[0.1]"
              >
                <span className="flex items-center justify-between">
                  <span className="tabular font-[family-name:var(--font-display)] text-3xl font-semibold text-[#8ccbf2]">{String(c.n).padStart(2, "0")}</span>
                  <Icon className="size-5 text-white/60" aria-hidden />
                </span>
                <span className="text-headline font-semibold">{c.title}</span>
                <span className="text-body-sm text-white/75">{c.subtitle}</span>
                <span className="mt-auto text-caption text-white/60">{slidesInChapter(c.n)} lâminas</span>
              </button>
            </li>
          );
        })}
      </ol>
    </section>
  );
}

function Closing() {
  return (
    <section aria-labelledby="fim-title" className="mx-auto max-w-6xl px-4 pt-6 pb-20">
      <div className="relative overflow-hidden rounded-[28px] bg-[linear-gradient(135deg,#0e6bb8,#062f5e)] p-7 sm:p-10">
        <div aria-hidden className="pointer-events-none absolute -top-20 -right-20 size-72 rounded-full bg-[#8ccbf2]/25 blur-3xl" />
        <h2 id="fim-title" className="relative font-[family-name:var(--font-display)] text-[clamp(1.6rem,3.4vw,2.4rem)] font-semibold">
          Já tem acesso ou quer criar a conta da sua clínica?
        </h2>
        <p className="relative mt-2 max-w-2xl text-white/80">
          Esta página é pública e usa apenas exemplos ilustrativos — nenhum dado real de clínica ou paciente aparece aqui.
        </p>
        <div className="relative mt-6 flex flex-wrap gap-3">
          <Link href="/cadastro" className="inline-flex h-12 items-center gap-2 rounded-full bg-white px-6 font-semibold text-[#062f5e] hover:brightness-95">
            Criar conta <ArrowRight className="size-4" aria-hidden />
          </Link>
          <Link href="/login" className="inline-flex h-12 items-center gap-2 rounded-full border border-white/40 px-6 font-medium hover:bg-white/10">
            <LogIn className="size-4" aria-hidden /> Entrar
          </Link>
        </div>
      </div>
      <p className="mt-8 text-center text-caption text-white/60">
        <Wordmark className="text-white/80" /> · gestão para clínicas
      </p>
    </section>
  );
}
