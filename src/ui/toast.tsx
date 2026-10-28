"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CheckCircle2, Info, AlertTriangle, X } from "lucide-react";
import { cn } from "@/lib/cn";

type Tone = "success" | "info" | "danger";
interface ToastItem {
  id: number;
  message: string;
  tone: Tone;
  action?: { label: string; onClick: () => void };
}

const ToastContext = createContext<(t: Omit<ToastItem, "id">) => void>(() => {});

export function useToast() {
  return useContext(ToastContext);
}

const icons = { success: CheckCircle2, info: Info, danger: AlertTriangle };

export function ToastProvider({ children }: { children: ReactNode }) {
  const [items, setItems] = useState<ToastItem[]>([]);
  const seq = useRef(0);

  const dismiss = useCallback((id: number) => setItems((all) => all.filter((t) => t.id !== id)), []);
  const push = useCallback((t: Omit<ToastItem, "id">) => {
    const id = ++seq.current;
    setItems((all) => [...all.slice(-2), { ...t, id }]);
  }, []);

  return (
    <ToastContext.Provider value={push}>
      {children}
      <div
        aria-live="polite"
        aria-atomic="false"
        className="pointer-events-none fixed inset-x-0 bottom-20 z-[60] flex flex-col items-center gap-2 px-4 md:bottom-6"
      >
        {items.map((t) => (
          <ToastView key={t.id} item={t} onDismiss={() => dismiss(t.id)} />
        ))}
      </div>
    </ToastContext.Provider>
  );
}

function ToastView({ item, onDismiss }: { item: ToastItem; onDismiss: () => void }) {
  const Icon = icons[item.tone];
  // Com ação "Desfazer", o toast fica 10 s (tempo suficiente para reagir).
  useEffect(() => {
    const t = setTimeout(onDismiss, item.action ? 10000 : 4500);
    return () => clearTimeout(t);
  }, [item.action, onDismiss]);

  return (
    <div
      role="status"
      className="pointer-events-auto flex w-full max-w-md items-center gap-3 rounded-md bg-ink px-4 py-3 text-body-sm text-white shadow-lg animate-[toast-in_var(--duration-base)_var(--ease-standard)]"
    >
      <Icon className={cn("size-5 shrink-0", item.tone === "danger" ? "text-danger-subtle" : "text-accent-subtle")} aria-hidden />
      <span className="flex-1">{item.message}</span>
      {item.action && (
        <button
          className="rounded-xs px-2 py-1 font-semibold text-accent-subtle underline-offset-2 hover:underline"
          onClick={() => {
            item.action!.onClick();
            onDismiss();
          }}
        >
          {item.action.label}
        </button>
      )}
      <button className="grid size-8 place-items-center rounded-full hover:bg-white/10" onClick={onDismiss} aria-label="Fechar aviso">
        <X className="size-4" aria-hidden />
      </button>
    </div>
  );
}
