"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { flushSync } from "react-dom";
import { ArrowLeft, ArrowRight, LayoutGrid, Maximize2, Minimize2, Search, X } from "lucide-react";
import { cn } from "@/lib/cn";
import { CHAPTERS, PROFILES, type Profile, type Slide } from "./content";
import { chapterGroups, matchesQuery } from "./route";

type Direction = "forward" | "backward";
type TransitionDocument = Document & {
  startViewTransition?: (options: { update: () => void; types: string[] }) => unknown;
};

/**
 * Troca de lâmina com transição direcional (View Transitions com tipos). Sem suporte no
 * navegador, ou com "reduzir movimento", a troca é imediata.
 */
function transition(update: () => void, direction: Direction) {
  const doc = document as TransitionDocument;
  const reduced = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  if (!doc.startViewTransition || reduced) return update();
  try {
    doc.startViewTransition({ update: () => flushSync(update), types: [direction] });
  } catch {
    // Navegadores com a API antiga (só callback) não aceitam o objeto com tipos.
    update();
  }
}

const isTyping = (t: EventTarget | null) => t instanceof HTMLElement && (t.isContentEditable || /^(INPUT|TEXTAREA|SELECT)$/.test(t.tagName));

export function Deck({
  slides, index, trail, onIndex, onExit,
}: {
  slides: Slide[];
  index: number;
  trail: Profile | null;
  onIndex: (i: number) => void;
  onExit: () => void;
}) {
  const rootRef = useRef<HTMLDivElement>(null);
  const slideRef = useRef<HTMLElement>(null);
  const tocRef = useRef<HTMLDialogElement>(null);
  const swipe = useRef<{ x: number; y: number } | null>(null);
  const [full, setFull] = useState(false);
  const slide = slides[index];
  const chapter = CHAPTERS[slide.chapter];
  const next = slides[index + 1];
  const groups = chapterGroups(slides);

  const go = useCallback(
    (to: number) => {
      const target = Math.min(Math.max(to, 0), slides.length - 1);
      if (target === index) return;
      transition(() => onIndex(target), target > index ? "forward" : "backward");
    },
    [index, onIndex, slides.length],
  );

  const toggleFull = useCallback(() => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void rootRef.current?.requestFullscreen?.().catch(() => undefined);
  }, []);

  // Foco na lâmina a cada troca: o leitor de tela anuncia o novo conteúdo e as setas continuam valendo.
  useEffect(() => {
    slideRef.current?.focus({ preventScroll: true });
    slideRef.current?.scrollTo({ top: 0 });
  }, [index]);

  useEffect(() => {
    const onFull = () => setFull(Boolean(document.fullscreenElement));
    document.addEventListener("fullscreenchange", onFull);
    return () => document.removeEventListener("fullscreenchange", onFull);
  }, []);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (tocRef.current?.open || isTyping(e.target) || e.altKey || e.ctrlKey || e.metaKey) return;
      const onControl = e.target instanceof HTMLElement && e.target.closest("button, a");
      switch (e.key) {
        case "ArrowRight":
        case "PageDown":
          e.preventDefault();
          go(index + 1);
          break;
        case " ":
          if (onControl) return; // espaço num botão é clique, não avanço
          e.preventDefault();
          go(e.shiftKey ? index - 1 : index + 1);
          break;
        case "ArrowLeft":
        case "PageUp":
          e.preventDefault();
          go(index - 1);
          break;
        case "Home":
          e.preventDefault();
          go(0);
          break;
        case "End":
          e.preventDefault();
          go(slides.length - 1);
          break;
        case "f":
        case "F":
          e.preventDefault();
          toggleFull();
          break;
        case "Escape":
          if (!document.fullscreenElement) onExit();
          break;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [go, index, onExit, slides.length, toggleFull]);

  return (
    <div ref={rootRef} className="deck fixed inset-0 z-50 flex flex-col bg-[#031e40] text-white">
      <div aria-hidden className="pointer-events-none absolute inset-0 bg-[radial-gradient(900px_600px_at_80%_0%,rgb(14_107_184/0.55),transparent_60%),radial-gradient(700px_500px_at_0%_100%,rgb(6_47_94/0.9),transparent_60%)]" />
      <h1 className="sr-only">Apresentação do smartclin{trail ? ` · trilha ${PROFILES[trail].label}` : ""}</h1>

      <header className="relative flex items-center gap-3 px-3 pt-3 sm:px-5">
        <button type="button" onClick={onExit} aria-label="Sair da apresentação" className="grid size-10 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20">
          <X className="size-5" aria-hidden />
        </button>
        <div className="min-w-0 flex-1">
          <p className="truncate text-caption font-semibold tracking-[0.12em] text-[#8ccbf2] uppercase">
            {chapter.n > 0 ? `${String(chapter.n).padStart(2, "0")} · ` : ""}
            {chapter.title}
            {trail && ` · trilha ${PROFILES[trail].label}`}
          </p>
          <p className="truncate text-body-sm text-white/85">{slide.title}</p>
        </div>
        <p className="tabular shrink-0 rounded-full border border-white/15 bg-white/10 px-3 py-1 text-caption text-white/85">
          {index + 1} / {slides.length}
        </p>
      </header>

      <main
        className="relative flex min-h-0 flex-1 items-center justify-center px-3 py-3 sm:px-5"
        onPointerDown={(e) => {
          if (e.pointerType !== "mouse") swipe.current = { x: e.clientX, y: e.clientY };
        }}
        onPointerUp={(e) => {
          const s = swipe.current;
          swipe.current = null;
          if (!s) return;
          const dx = e.clientX - s.x;
          if (Math.abs(dx) > 60 && Math.abs(dx) > Math.abs(e.clientY - s.y) * 1.5) go(dx < 0 ? index + 1 : index - 1);
        }}
      >
        <section
          ref={slideRef}
          key={slide.id}
          // Alcançável pelo teclado: no celular a lâmina rola por dentro.
          tabIndex={0}
          aria-roledescription="lâmina"
          aria-label={`${index + 1} de ${slides.length}: ${slide.title}`}
          className={cn(
            "deck-slide relative h-full w-full max-w-[1280px] overflow-y-auto overflow-x-hidden rounded-[28px] border p-5 outline-none focus-visible:ring-2 focus-visible:ring-[#8ccbf2]/60 sm:p-8 lg:max-h-[calc((100vw-2.5rem)*9/16)] lg:p-12",
            slide.dark
              ? "border-white/15 bg-[linear-gradient(160deg,#0b4c8c_0%,#062f5e_55%,#041f42_100%)] text-white"
              : "border-white/70 bg-[linear-gradient(180deg,#ffffff_0%,#f3f8fd_100%)] text-ink shadow-[0_30px_80px_rgb(0_0_0/0.35)]",
          )}
        >
          {slide.render({ goToChapter: (n) => go(Math.max(0, slides.findIndex((s) => s.chapter === n))) })}
        </section>
      </main>

      <footer className="relative flex flex-col gap-2 px-3 pb-3 sm:px-5">
        <div className="flex items-center gap-2 sm:gap-3">
          <button type="button" onClick={() => go(index - 1)} disabled={index === 0} aria-label="Lâmina anterior" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20 disabled:opacity-40">
            <ArrowLeft className="size-5" aria-hidden />
          </button>
          <nav aria-label="Capítulos" className="flex min-w-0 flex-1 gap-1">
            {groups.map((g) => {
              const done = index >= g.start + g.count;
              const here = index >= g.start && !done;
              const pct = done ? 100 : here ? ((index - g.start + 1) / g.count) * 100 : 0;
              return (
                <button
                  key={g.chapter.n}
                  type="button"
                  onClick={() => go(g.start)}
                  aria-label={`Ir para ${g.chapter.title}`}
                  aria-current={here ? "step" : undefined}
                  style={{ flexGrow: g.count }}
                  className="group flex h-11 min-w-2 basis-0 items-center"
                >
                  <span className="relative block h-1.5 w-full overflow-hidden rounded-full bg-white/20 group-hover:bg-white/30">
                    <span className="absolute inset-y-0 left-0 rounded-full bg-[#8ccbf2] transition-[width] duration-300 motion-reduce:transition-none" style={{ width: `${pct}%` }} />
                  </span>
                </button>
              );
            })}
          </nav>
          <button type="button" onClick={() => go(index + 1)} disabled={index === slides.length - 1} aria-label="Próxima lâmina" className="grid size-11 shrink-0 place-items-center rounded-full bg-[#8ccbf2] text-[#062f5e] hover:brightness-105 disabled:opacity-40">
            <ArrowRight className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={() => tocRef.current?.showModal()} aria-label="Abrir sumário" className="grid size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20">
            <LayoutGrid className="size-5" aria-hidden />
          </button>
          <button type="button" onClick={toggleFull} aria-label={full ? "Sair da tela cheia" : "Tela cheia"} className="hidden size-11 shrink-0 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20 sm:grid">
            {full ? <Minimize2 className="size-5" aria-hidden /> : <Maximize2 className="size-5" aria-hidden />}
          </button>
        </div>
        <div className="flex justify-between gap-3 text-caption text-white/70">
          <span className="truncate">{next ? `A seguir: ${next.title}` : "Fim da apresentação"}</span>
          <span className="hidden shrink-0 sm:inline">← → navegar · F tela cheia · Esc sair</span>
        </div>
      </footer>

      <p aria-live="polite" className="sr-only">
        Lâmina {index + 1} de {slides.length}: {slide.title}
      </p>

      <Toc dialogRef={tocRef} slides={slides} index={index} onPick={(i) => go(i)} />
    </div>
  );
}

function Toc({ dialogRef, slides, index, onPick }: { dialogRef: React.RefObject<HTMLDialogElement | null>; slides: Slide[]; index: number; onPick: (i: number) => void }) {
  const [query, setQuery] = useState("");
  const groups = chapterGroups(slides);
  const hits = slides.map((s) => matchesQuery(s, query));
  return (
    <dialog
      ref={dialogRef}
      aria-labelledby="toc-title"
      {...({ closedby: "any" } as object)}
      onClose={() => setQuery("")}
      className="toc m-auto max-h-[min(88dvh,52rem)] w-[min(64rem,calc(100vw-1.5rem))] overflow-y-auto rounded-[28px] border border-white/15 bg-[#062f5e] p-0 text-white shadow-[0_30px_80px_rgb(0_0_0/0.5)]"
    >
      <div className="sticky top-0 z-10 flex flex-wrap items-center gap-3 border-b border-white/10 bg-[#062f5e]/95 p-4 backdrop-blur sm:p-5">
        <div className="mr-auto">
          <h2 id="toc-title" className="font-[family-name:var(--font-display)] text-title-2 font-semibold">
            Sumário
          </h2>
          <p className="text-caption text-white/70">
            {slides.length} lâminas · {groups.filter((g) => g.chapter.n > 0).length} capítulos
          </p>
        </div>
        <label className="relative order-3 w-full sm:order-none sm:w-80">
          <span className="sr-only">Buscar um tema</span>
          <Search className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-white/60" aria-hidden />
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Buscar: agenda, retorno, segurança…"
            className="h-11 w-full rounded-full border border-white/20 bg-white/10 pr-4 pl-9 text-body-sm text-white placeholder:text-white/60 focus-visible:border-[#8ccbf2] focus-visible:outline-none"
          />
        </label>
        <form method="dialog">
          <button aria-label="Fechar sumário" className="grid size-10 place-items-center rounded-full border border-white/15 bg-white/10 hover:bg-white/20" autoFocus>
            <X className="size-5" aria-hidden />
          </button>
        </form>
      </div>
      <div className="flex flex-col gap-5 p-4 sm:p-5">
        {groups.map((g) => {
          const items = slides.slice(g.start, g.start + g.count).map((s, k) => ({ s, i: g.start + k })).filter(({ i }) => hits[i]);
          if (!items.length) return null;
          return (
            <section key={g.chapter.n} aria-labelledby={`toc-ch-${g.chapter.n}`}>
              <h3 id={`toc-ch-${g.chapter.n}`} className="mb-2 flex items-baseline gap-2 font-semibold">
                <span className="tabular text-[#8ccbf2]">{String(g.chapter.n).padStart(2, "0")}</span> {g.chapter.title}
                <span className="text-caption font-normal text-white/60">{g.count} lâminas</span>
              </h3>
              <ol className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                {items.map(({ s, i }) => (
                  <li key={s.id}>
                    <form method="dialog">
                      <button
                        onClick={() => onPick(i)}
                        aria-current={i === index ? "true" : undefined}
                        className={cn(
                          "flex w-full items-start gap-3 rounded-[16px] border p-3 text-left text-body-sm hover:bg-white/10",
                          i === index ? "border-[#8ccbf2] bg-white/10" : "border-white/10",
                        )}
                      >
                        <span className="tabular grid size-7 shrink-0 place-items-center rounded-full bg-white/10 text-caption font-semibold">{i + 1}</span>
                        <span>{s.title}</span>
                      </button>
                    </form>
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
        {!hits.some(Boolean) && <p className="py-6 text-center text-body-sm text-white/70">Nenhuma lâmina com “{query}”.</p>}
      </div>
    </dialog>
  );
}
