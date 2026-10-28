"use client";

import * as Dialog from "@radix-ui/react-dialog";
import { useRef, type ReactNode } from "react";
import { Button } from "./button";

interface ConfirmDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description?: ReactNode;
  confirmLabel: string;
  cancelLabel?: string;
  destructive?: boolean;
  onConfirm: () => void;
  children?: ReactNode;
}

/** Confirmação de ação. Foco inicial em "Cancelar" quando a ação é destrutiva. */
export function ConfirmDialog({
  open,
  onOpenChange,
  title,
  description,
  confirmLabel,
  cancelLabel = "Voltar",
  destructive,
  onConfirm,
  children,
}: ConfirmDialogProps) {
  const cancelRef = useRef<HTMLButtonElement>(null);
  return (
    <Dialog.Root open={open} onOpenChange={onOpenChange}>
      <Dialog.Portal>
        <Dialog.Overlay className="fixed inset-0 z-50 bg-(--overlay-scrim) animate-[fade-in_var(--duration-base)]" />
        <Dialog.Content
          role="alertdialog"
          onOpenAutoFocus={(e) => {
            if (destructive) {
              e.preventDefault();
              cancelRef.current?.focus();
            }
          }}
          className="fixed top-1/2 left-1/2 z-50 w-[calc(100%-2rem)] max-w-md -translate-x-1/2 -translate-y-1/2 rounded-lg bg-surface p-6 shadow-lg outline-none animate-[toast-in_var(--duration-base)_var(--ease-standard)]"
        >
          <Dialog.Title className="text-title-2 font-semibold">{title}</Dialog.Title>
          {description ? (
            <Dialog.Description asChild>
              <div className="mt-2 text-body-sm text-ink-2">{description}</div>
            </Dialog.Description>
          ) : (
            <Dialog.Description className="sr-only">{title}</Dialog.Description>
          )}
          {children && <div className="mt-4">{children}</div>}
          <div className="mt-6 flex flex-col-reverse gap-2 sm:flex-row sm:justify-end">
            <Dialog.Close asChild>
              <Button ref={cancelRef} variant="secondary">
                {cancelLabel}
              </Button>
            </Dialog.Close>
            <Button
              variant={destructive ? "destructive" : "primary"}
              onClick={() => {
                onConfirm();
                onOpenChange(false);
              }}
            >
              {confirmLabel}
            </Button>
          </div>
        </Dialog.Content>
      </Dialog.Portal>
    </Dialog.Root>
  );
}
