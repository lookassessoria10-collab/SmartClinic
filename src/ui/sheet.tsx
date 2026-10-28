"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { X } from "lucide-react";
import type { ReactNode } from "react";
import { cn } from "@/lib/cn";

interface SheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: string;
  children: ReactNode;
  footer?: ReactNode;
  /** Mantém o conteúdo de fundo interativo (ex.: agenda visível ao lado no desktop). */
  modal?: boolean;
}

/**
 * Painel contextual: folha inferior no celular, painel lateral direito a partir de md.
 * Vidro no contorno; o corpo (formulário) é opaco para legibilidade (D-13).
 */
export function Sheet({ open, onOpenChange, title, description, children, footer, modal = true }: SheetProps) {
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange} modal={modal}>
      <Dialog.Portal>
        {modal && (
          <Dialog.Overlay className="fixed inset-0 z-40 bg-(--overlay-scrim) animate-[fade-in_var(--duration-base)_var(--ease-standard)] md:bg-transparent" />
        )}
        <Dialog.Content
          className={cn(
            "glass-strong fixed z-40 flex flex-col border outline-none",
            "inset-x-0 bottom-0 max-h-[92dvh] rounded-t-xl animate-[slide-in-up_var(--duration-slow)_var(--ease-standard)]",
            "md:inset-y-3 md:right-3 md:left-auto md:max-h-none md:w-[420px] md:rounded-lg md:animate-[slide-in-right_var(--duration-slow)_var(--ease-standard)]",
          )}
          onInteractOutside={(e) => {
            if (!modal) e.preventDefault();
          }}
        >
          <div className="mx-auto mt-2 h-1 w-10 rounded-full bg-line-strong md:hidden" aria-hidden />
          <header className="flex items-start justify-between gap-3 px-5 pt-4 pb-3">
            <div>
              <Dialog.Title className="text-title-2 font-semibold">{title}</Dialog.Title>
              {description ? (
                <Dialog.Description className="mt-0.5 text-body-sm text-ink-2">{description}</Dialog.Description>
              ) : (
                <Dialog.Description className="sr-only">{title}</Dialog.Description>
              )}
            </div>
            <Dialog.Close className="-mr-2 grid size-10 place-items-center rounded-full text-ink-2 hover:bg-muted" aria-label="Fechar">
              <X className="size-5" aria-hidden />
            </Dialog.Close>
          </header>
          <div className="mx-3 flex-1 overflow-y-auto rounded-md bg-surface p-4 shadow-xs">{children}</div>
          {footer && <footer className="flex flex-wrap justify-end gap-2 px-5 py-4">{footer}</footer>}
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
