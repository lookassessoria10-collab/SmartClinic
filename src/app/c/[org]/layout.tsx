import { Suspense } from "react";
import { AppShell, ShellSkeleton } from "@/components/app-shell";

// Protótipo: os dados vivem no localStorage, então não há conteúdo para pré-renderizar.
// Na Fase 3 (dados no servidor) esta exceção sai e a validação de navegação instantânea volta.
export const instant = false;

// O slug da clínica só é conhecido na requisição: o Suspense permite pré-renderizar o esqueleto.
export default function ClinicLayout({ children }: LayoutProps<"/c/[org]">) {
  return (
    <Suspense fallback={<ShellSkeleton />}>
      <AppShell>{children}</AppShell>
    </Suspense>
  );
}
