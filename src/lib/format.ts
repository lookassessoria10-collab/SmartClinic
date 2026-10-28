import { differenceInMinutes, format, isToday, isTomorrow } from "date-fns";
import { ptBR } from "date-fns/locale";

/** Maiúscula só na primeira letra ("Quarta-feira, 28 de outubro"); CSS `capitalize` erraria o "de". */
export const cap = (s: string) => s.charAt(0).toUpperCase() + s.slice(1);

export const fmt = (d: Date | string, pattern: string) => format(new Date(d), pattern, { locale: ptBR });
export const time = (d: Date | string) => fmt(d, "HH:mm");

export function dayLabel(d: Date | string) {
  const date = new Date(d);
  if (isToday(date)) return "Hoje";
  if (isTomorrow(date)) return "Amanhã";
  return cap(fmt(date, "EEE, d 'de' MMM"));
}

export function money(cents: number | null | undefined) {
  if (cents == null) return "—";
  return (cents / 100).toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
}

/** +5511900001000 → (11) 90000-1000 */
export function phone(e164: string) {
  const d = e164.replace(/\D/g, "").replace(/^55/, "");
  if (d.length < 10) return e164;
  return `(${d.slice(0, 2)}) ${d.slice(2, d.length - 4)}-${d.slice(-4)}`;
}

/** Normaliza entrada brasileira para E.164; retorna null se inválida. */
export function toE164(input: string) {
  const d = input.replace(/\D/g, "").replace(/^0+/, "");
  const local = d.startsWith("55") && d.length >= 12 ? d.slice(2) : d;
  if (local.length !== 10 && local.length !== 11) return null;
  return `+55${local}`;
}

/** Máscara progressiva para o campo de celular. */
export function maskPhone(input: string) {
  const d = input.replace(/\D/g, "").slice(0, 11);
  if (d.length <= 2) return d.length ? `(${d}` : "";
  if (d.length <= 6) return `(${d.slice(0, 2)}) ${d.slice(2)}`;
  if (d.length <= 10) return `(${d.slice(0, 2)}) ${d.slice(2, 6)}-${d.slice(6)}`;
  return `(${d.slice(0, 2)}) ${d.slice(2, 7)}-${d.slice(7)}`;
}

export function expiresIn(iso: string, now = new Date()) {
  const m = differenceInMinutes(new Date(iso), now);
  if (m <= 0) return "expirada";
  if (m < 60) return `${m} min`;
  const h = Math.floor(m / 60);
  return h < 24 ? `${h} h` : `${Math.floor(h / 24)} d ${h % 24} h`;
}
