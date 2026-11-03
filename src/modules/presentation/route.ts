import { CHAPTERS, PROFILES, SLIDES, type Profile, type Slide } from "./content";

/*
 * Endereço de cada lâmina no hash, para compartilhar e voltar ao mesmo ponto:
 *   #s/12            apresentação completa, lâmina 12
 *   #t/recepcao/3    trilha da recepção, lâmina 3
 *   qualquer outro   página inicial (âncoras como #trilhas)
 */

export type View = { mode: "home"; anchor: string } | { mode: "deck"; trail: Profile | null; index: number };

export function deckSlides(trail: Profile | null): Slide[] {
  return trail ? SLIDES.filter((s) => s.profiles.includes(trail)) : SLIDES;
}

const clamp = (n: number, max: number) => Math.min(Math.max(n, 0), max);

export function parseHash(hash: string): View {
  const h = hash.replace(/^#/, "");
  const full = /^s\/(\d{1,3})$/.exec(h);
  if (full) return { mode: "deck", trail: null, index: clamp(Number(full[1]) - 1, SLIDES.length - 1) };
  const trail = /^t\/([a-z]+)\/(\d{1,3})$/.exec(h);
  if (trail && trail[1] in PROFILES) {
    const p = trail[1] as Profile;
    return { mode: "deck", trail: p, index: clamp(Number(trail[2]) - 1, deckSlides(p).length - 1) };
  }
  return { mode: "home", anchor: h };
}

export function hashFor(trail: Profile | null, index: number): string {
  return trail ? `#t/${trail}/${index + 1}` : `#s/${index + 1}`;
}

/** Capítulos presentes numa sequência, com a primeira lâmina e a quantidade (barra de progresso). */
export function chapterGroups(slides: Slide[]) {
  const groups: { chapter: (typeof CHAPTERS)[number]; start: number; count: number }[] = [];
  slides.forEach((s, i) => {
    const last = groups.at(-1);
    if (last && last.chapter.n === s.chapter) last.count++;
    else groups.push({ chapter: CHAPTERS[s.chapter], start: i, count: 1 });
  });
  return groups;
}

/** Busca do sumário: título, capítulo e palavras-chave, sem acento e sem caixa. */
export function matchesQuery(slide: Slide, query: string) {
  const norm = (s: string) => s.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
  const q = norm(query.trim());
  if (!q) return true;
  return norm(`${slide.title} ${CHAPTERS[slide.chapter].title} ${slide.keywords}`).includes(q);
}
