/**
 * Aceita só caminhos internos ("/c/x/agenda"). Recusa URLs absolutas, "//outro-site",
 * barras invertidas e caracteres de controle — evita redirecionamento aberto (open redirect).
 */
export function safeNextPath(value: unknown, fallback = "/"): string {
  if (typeof value !== "string" || value.length === 0 || value.length > 512) return fallback;
  if (!value.startsWith("/") || value.startsWith("//") || value.startsWith("/\\")) return fallback;
  if (/[\u0000-\u001f\\]/.test(value)) return fallback;
  try {
    // Resolve contra uma origem fictícia: se a origem mudar, não era um caminho interno.
    const url = new URL(value, "https://interno.invalid");
    if (url.origin !== "https://interno.invalid") return fallback;
    return url.pathname + url.search + url.hash;
  } catch {
    return fallback;
  }
}
