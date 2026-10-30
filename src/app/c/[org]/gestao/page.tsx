"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, ChevronRight, Clock, Globe, ScrollText, Stethoscope, Tags, Upload, UsersRound, CreditCard, type LucideIcon } from "lucide-react";
import { useDb } from "@/modules/clinic/client";
import { Card, PageHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";

const AREAS: { icon: LucideIcon; title: string; description: string; path?: string; count?: (db: ReturnType<typeof useDb>) => string }[] = [
  { icon: Building2, title: "Clínica", description: "Nome, telefone e endereço da página de agendamento", path: "clinica" },
  {
    icon: Stethoscope, title: "Profissionais", description: "Quem atende, especialidade e serviços de cada um", path: "profissionais",
    count: (db) => `${db.professionals.filter((p) => p.active).length} ativo(s)`,
  },
  {
    icon: Tags, title: "Serviços", description: "Duração, intervalo, preço e quem realiza", path: "servicos",
    count: (db) => `${db.services.filter((s) => s.active).length} ativo(s)`,
  },
  { icon: Clock, title: "Horários", description: "Horário de atendimento, feriados, férias e bloqueios", path: "horarios" },
  { icon: UsersRound, title: "Equipe", description: "Membros, papéis e convites", path: "equipe" },
  { icon: ScrollText, title: "Auditoria", description: "Quem fez o quê e quando", path: "auditoria" },
  { icon: Globe, title: "Agendamento online", description: "Link público para o paciente pedir horário" },
  { icon: Upload, title: "Importar e exportar", description: "Planilhas CSV e XLSX" },
  { icon: CreditCard, title: "Assinatura", description: "Plano e limites" },
];

export default function GestaoPage() {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  return (
    <>
      <PageHeader title="Gestão" description="Configurações da clínica. Tudo que o onboarding sugeriu pode ser alterado aqui." />

      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
        {AREAS.map((a) => {
          const body = (
            <>
              <span className="grid size-10 shrink-0 place-items-center rounded-sm bg-accent-subtle text-accent">
                <a.icon className="size-5" aria-hidden />
              </span>
              <div className="min-w-0 flex-1">
                <p className="flex items-center justify-between gap-2 font-medium">
                  {a.title}
                  {a.path ? <ChevronRight className="size-4 text-ink-3" aria-hidden /> : <Badge>Em breve</Badge>}
                </p>
                <p className="text-body-sm text-ink-2">{a.description}</p>
                {a.count && <p className="mt-1 text-caption text-ink-3">{a.count(db)}</p>}
              </div>
            </>
          );
          return a.path ? (
            <Link
              key={a.title}
              href={`/c/${org}/gestao/${a.path}`}
              className="flex items-start gap-3 rounded-md border border-line bg-surface p-4 shadow-xs transition-[border-color,box-shadow] hover:border-accent hover:shadow-sm"
            >
              {body}
            </Link>
          ) : (
            <Card key={a.title} as="div" className="flex items-start gap-3 p-4 opacity-80">
              {body}
            </Card>
          );
        })}
      </div>
    </>
  );
}
