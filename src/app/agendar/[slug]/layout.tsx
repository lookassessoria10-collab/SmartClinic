import type { Metadata } from "next";

export const metadata: Metadata = { title: "Agendar horário", robots: { index: false } };

export default function PublicLayout({ children }: LayoutProps<"/agendar/[slug]">) {
  return children;
}
