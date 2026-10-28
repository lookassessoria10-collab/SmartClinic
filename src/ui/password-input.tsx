"use client";

import { forwardRef, useState, type InputHTMLAttributes } from "react";
import { Eye, EyeOff } from "lucide-react";
import { Input } from "./field";

/**
 * Campo de senha com mostrar/ocultar. Recebe id/aria-* do <Field> e repassa ao <input>,
 * então o rótulo e as mensagens de erro continuam ligados ao campo certo.
 */
export const PasswordInput = forwardRef<HTMLInputElement, Omit<InputHTMLAttributes<HTMLInputElement>, "type">>(
  function PasswordInput({ className, ...props }, ref) {
    const [visible, setVisible] = useState(false);
    return (
      <div className="relative">
        <Input ref={ref} type={visible ? "text" : "password"} className={`pr-11 ${className ?? ""}`} {...props} />
        <button
          type="button"
          onClick={() => setVisible((v) => !v)}
          aria-label={visible ? "Ocultar senha" : "Mostrar senha"}
          aria-pressed={visible}
          className="absolute top-1/2 right-1 grid size-9 -translate-y-1/2 place-items-center rounded-sm text-ink-3 hover:bg-muted hover:text-ink"
        >
          {visible ? <EyeOff className="size-4" aria-hidden /> : <Eye className="size-4" aria-hidden />}
        </button>
      </div>
    );
  },
);
