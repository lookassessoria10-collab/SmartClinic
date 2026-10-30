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
          description="O financeiro básico (recebimentos, despesas e pendências) é a próxima etapa depois da agenda. Enquanto isso, o Início mostra uma estimativa pelo preço dos serviços."
        />
      </Card>
    </>
  );
}
