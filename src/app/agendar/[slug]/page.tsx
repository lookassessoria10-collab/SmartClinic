import { CalendarClock } from "lucide-react";
import { Wordmark } from "@/ui/brand";

/**
 * Página pública de agendamento: chega na etapa C (Fase 6), com funções públicas no banco,
 * proteção anti-robô e limites. Até lá, mensagem neutra — sem revelar se a clínica existe.
 */
export default function PublicBookingPage() {
  return (
    <main className="grid min-h-dvh place-items-center px-4">
      <div className="glass-strong max-w-sm rounded-xl border p-8 text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-subtle text-accent">
          <CalendarClock className="size-6" aria-hidden />
        </span>
        <h1 className="text-title-2 font-semibold">Agendamento online em breve</h1>
        <p className="mt-2 text-body-sm text-ink-2">Por enquanto, entre em contato com a clínica por telefone ou mensagem para marcar seu horário.</p>
        <p className="mt-6 text-caption text-ink-2">
          Agenda por <Wordmark className="text-body-sm text-accent" />
        </p>
      </div>
    </main>
  );
}
