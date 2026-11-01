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
          title="Em breve"
          description="Recebimentos, despesas e pendências da clínica num só lugar. Enquanto isso, o Início mostra uma estimativa do mês pelo preço dos serviços."
        />
      </Card>
    </>
  );
}
