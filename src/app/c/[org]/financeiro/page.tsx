"use client";

import { Wallet } from "lucide-react";
import { Card, EmptyState, PageHeader } from "@/ui/primitives";

export default function FinanceiroPage() {
  return (
    <>
      <PageHeader title="Financeiro" description="Recebimentos, despesas e pendências." />
      <Card>
        <EmptyState
          icon={Wallet}
          title="Chega na Fase 8"
          description="Este protótipo cobre login, configuração inicial, Início, agenda, página pública e aprovação. O financeiro básico será prototipado na sua fase."
        />
      </Card>
    </>
  );
}
