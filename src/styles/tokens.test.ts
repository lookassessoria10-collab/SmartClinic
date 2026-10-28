// Verifica o contraste WCAG 2.2 AA dos pares de tokens usados com texto.
import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";

const css = readFileSync(fileURLToPath(new URL("./tokens.css", import.meta.url)), "utf8");
const token = (name: string) => {
  const m = css.match(new RegExp(`${name}:\\s*(#[0-9a-f]{6})`, "i"));
  if (!m) throw new Error(`token ${name} não encontrado`);
  return m[1];
};

function luminance(hex: string) {
  const [r, g, b] = [1, 3, 5].map((i) => {
    const c = parseInt(hex.slice(i, i + 2), 16) / 255;
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4;
  });
  return 0.2126 * r + 0.7152 * g + 0.0722 * b;
}

export function contrast(a: string, b: string) {
  const [l1, l2] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (l1 + 0.05) / (l2 + 0.05);
}

// [texto, fundo, mínimo]
const pairs: [string, string, number][] = [
  ["--color-text", "--color-bg", 4.5],
  ["--color-text", "--color-bg-subtle", 4.5],
  ["--color-text-secondary", "--color-bg", 4.5],
  ["--color-text-secondary", "--color-bg-muted", 4.5],
  ["--color-text-tertiary", "--color-bg", 4.5],
  ["--color-on-accent", "--color-accent", 4.5],
  ["--color-accent", "--color-bg", 4.5],
  ["--color-accent", "--color-accent-subtle", 4.5],
  ["--color-success", "--color-success-subtle", 4.5],
  ["--color-warning", "--color-warning-subtle", 4.5],
  ["--color-danger", "--color-danger-subtle", 4.5],
  ["--color-info", "--color-info-subtle", 4.5],
  ["--color-border-strong", "--color-bg", 1.5], // borda de campo: reforçada por sombra e rótulo
  ...[1, 2, 3, 4, 5, 6, 7, 8].map((n) => [`--agenda-${n}`, `--agenda-${n}-bg`, 4.5] as [string, string, number]),
];

describe("contraste dos tokens", () => {
  it.each(pairs)("%s sobre %s ≥ %d:1", (fg, bg, min) => {
    expect(contrast(token(fg), token(bg))).toBeGreaterThanOrEqual(min);
  });
});
