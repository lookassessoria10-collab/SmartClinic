import type { NextConfig } from "next";

/*
 * Cabeçalhos de segurança (docs/09 §3; revisão da Fase 3 em docs/13).
 * CSP: por enquanto só as diretivas que não dependem de nonce (impedir o app dentro de
 * iframes alheios, plugins, troca da base de URLs e envio de formulários para fora).
 * O `script-src` com nonce fica para a Fase 10, junto com o domínio de produção.
 */
const securityHeaders = [
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "X-Frame-Options", value: "DENY" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  { key: "Permissions-Policy", value: "camera=(), microphone=(), geolocation=(), payment=(), usb=(), interest-cohort=()" },
  { key: "Cross-Origin-Opener-Policy", value: "same-origin" },
  // Só tem efeito em HTTPS (navegadores ignoram em http://localhost).
  { key: "Strict-Transport-Security", value: "max-age=63072000; includeSubDomains" },
  { key: "Content-Security-Policy", value: "frame-ancestors 'none'; base-uri 'self'; form-action 'self'; object-src 'none'" },
];

// Páginas com código secreto no endereço: o código não pode vazar no cabeçalho Referer.
const noReferrer = [{ key: "Referrer-Policy", value: "no-referrer" }];

const nextConfig: NextConfig = {
  cacheComponents: true,
  partialPrefetching: true,
  poweredByHeader: false,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
  async headers() {
    // Em regras que se sobrepõem, a última vence: as de no-referrer vêm depois.
    return [
      { source: "/:path*", headers: securityHeaders },
      { source: "/convite/:path*", headers: noReferrer },
      { source: "/auth/confirm", headers: noReferrer },
      { source: "/agendar/:slug/status/:path*", headers: noReferrer },
    ];
  },
  async redirects() {
    return [
      { source: "/", destination: "/login", permanent: false },
      { source: "/c/:org", destination: "/c/:org/inicio", permanent: false },
    ];
  },
};

export default nextConfig;
