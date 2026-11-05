"use client";

import Link from "next/link";
import type { ReactNode } from "react";
import { useParams } from "next/navigation";
import { LayoutGrid } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import type { ModuleKey } from "@/prototype/types";
import { EmptyState } from "@/ui/primitives";
import { useSession } from "./session-context";

/** Seção de um módulo que a clínica não usa (Gestão → Módulos). Nada é apagado ao desligar. */
export function ModuleOff() {
  const { org } = useParams<{ org: string }>();
  const manager = useSession().role === "manager";
  return (
    <EmptyState
      icon={LayoutGrid}
      title="Este módulo está desligado"
      description={manager ? "Ligue o módulo em Gestão → Módulos para usar esta área. Nenhum dado é apagado ao desligar." : "Fale com o gestor da clínica se precisar desta área."}
      action={
        manager ? (
          <Link href={`/c/${org}/gestao/modulos`} className="inline-flex h-11 items-center glass-tint rounded-full px-4 text-body-sm font-medium hover:brightness-[1.06]">
            Abrir Módulos
          </Link>
        ) : undefined
      }
    />
  );
}

/** Mostra o conteúdo só com o módulo ligado (áreas fora das seções do menu, ex.: Oportunidades). */
export function RequireModule({ module, children }: { module: ModuleKey; children: ReactNode }) {
  return useDb().org.features.includes(module) ? children : <ModuleOff />;
}
