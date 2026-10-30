import { CalendarClock } from "lucide-react";

/**
 * Página pública de agendamento: chega na etapa C (Fase 6), com funções públicas no banco,
 * proteção anti-robô e limites. Até lá, mensagem neutra — sem revelar se a clínica existe.
 */
export default function PublicBookingPage() {
  return (
    <main className="grid min-h-dvh place-items-center bg-canvas px-4">
      <div className="max-w-sm text-center">
        <span className="mx-auto mb-4 grid size-14 place-items-center rounded-full bg-accent-subtle text-accent">
          <CalendarClock className="size-6" aria-hidden />
        </span>
        <h1 className="text-title-2 font-semibold">Agendamento online em breve</h1>
        <p className="mt-2 text-body-sm text-ink-2">Por enquanto, entre em contato com a clínica por telefone ou mensagem para marcar seu horário.</p>
      </div>
    </main>
  );
}
