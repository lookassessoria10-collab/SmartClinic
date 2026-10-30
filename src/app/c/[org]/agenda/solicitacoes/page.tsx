"use client";

import { Inbox } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";

export default function SolicitacoesPage() {
  return (
    <>
      <PageHeader title="Solicitações" description="Pedidos de horário feitos pelos pacientes na página pública." />
      <Card>
        <EmptyState
          icon={Inbox}
          title="Chega com o agendamento online"
          description="Quando a página pública estiver ligada, os pedidos dos pacientes aparecem aqui para a equipe aprovar ou recusar."
        />
      </Card>
    </>
  );
}
