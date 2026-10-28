import type { Metadata } from "next";
import { Suspense } from "react";

export const metadata: Metadata = { title: "Agendar horário" };

// Protótipo com dados no localStorage (ver src/app/c/[org]/layout.tsx).
export const instant = false;

export default function PublicLayout({ children }: LayoutProps<"/agendar/[slug]">) {
  return <Suspense>{children}</Suspense>;
}
