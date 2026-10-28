"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { Building2, CalendarClock, ChevronRight, Clock, Globe, ScrollText, Stethoscope, Tags, Upload, UsersRound, CreditCard, type LucideIcon } from "lucide-react";
import { useDb } from "@/prototype/store";
import { Card, PageHeader } from "@/ui/primitives";
import { Badge } from "@/ui/status-badge";
import { money } from "@/lib/format";

const AREAS: { icon: LucideIcon; title: string; description: string; phase: number; path?: string }[] = [
  { icon: Building2, title: "Clínica", description: "Nome, telefone e endereço da página de agendamento", phase: 3, path: "clinica" },
  { icon: Stethoscope, title: "Profissionais", description: "Cadastro, especialidade e serviços de cada um", phase: 4 },
  { icon: Tags, title: "Serviços", description: "Duração, intervalo, preço e visibilidade pública", phase: 4 },
  { icon: Clock, title: "Horários", description: "Disponibilidade, feriados, férias e bloqueios", phase: 5 },
  { icon: Globe, title: "Agendamento online", description: "Link público, antecedência, reserva e textos", phase: 6 },
  { icon: UsersRound, title: "Equipe", description: "Membros, papéis e convites", phase: 3, path: "equipe" },
  { icon: Upload, title: "Importar e exportar", description: "Planilhas CSV e XLSX", phase: 7 },
  { icon: CreditCard, title: "Assinatura", description: "Plano e limites", phase: 9 },
  { icon: ScrollText, title: "Auditoria", description: "Quem fez o quê e quando", phase: 3 },
];

export default function GestaoPage() {
  const db = useDb();
  const { org } = useParams<{ org: string }>();
  if (!db) return null;
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
                  {a.path ? <ChevronRight className="size-4 text-ink-3" aria-hidden /> : <Badge>Fase {a.phase}</Badge>}
                </p>
                <p className="text-body-sm text-ink-2">{a.description}</p>
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
            <Card key={a.title} as="div" className="flex items-start gap-3 p-4">
              {body}
            </Card>
          );
        })}
      </div>

      <h2 className="mt-8 mb-3 flex items-center gap-2 text-headline font-semibold">
        <CalendarClock className="size-4 text-ink-2" aria-hidden /> Serviços cadastrados (dados fictícios)
      </h2>
      <Card className="overflow-x-auto">
        <table className="w-full min-w-[560px] text-body-sm">
          <thead className="bg-canvas text-left text-caption text-ink-2">
            <tr>
              <th scope="col" className="px-5 py-3 font-semibold">Serviço</th>
              <th scope="col" className="px-5 py-3 font-semibold">Duração</th>
              <th scope="col" className="px-5 py-3 font-semibold">Preço</th>
              <th scope="col" className="px-5 py-3 font-semibold">Página pública</th>
              <th scope="col" className="px-5 py-3 font-semibold">Profissionais</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {db.services.map((s) => (
              <tr key={s.id}>
                <td className="px-5 py-3 font-medium">{s.name}</td>
                <td className="tabular px-5 py-3 text-ink-2">{s.durationMin} min{s.bufferAfterMin ? ` + ${s.bufferAfterMin}` : ""}</td>
                <td className="tabular px-5 py-3 text-ink-2">{money(s.priceCents)}</td>
                <td className="px-5 py-3">{s.isPublic ? <Badge className="bg-success-subtle text-success">Visível</Badge> : <Badge>Oculto</Badge>}</td>
                <td className="px-5 py-3 text-ink-2">{s.professionalIds.map((id) => db.professionals.find((p) => p.id === id)?.name.split(" ").slice(0, 2).join(" ")).join(", ")}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </Card>

      <p className="mt-6 text-body-sm text-ink-2">
        Link público:{" "}
        <Link href={`/agendar/${db.org.slug}`} className="font-medium text-accent underline-offset-2 hover:underline">
          /agendar/{db.org.slug}
        </Link>
      </p>
    </>
  );
}
