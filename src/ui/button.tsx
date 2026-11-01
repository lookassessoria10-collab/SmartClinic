import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

// Cápsulas, como os controles do Liquid Glass: principal em vidro tingido com o azul da marca,
// secundário em vidro claro, fantasma só ganha vidro ao passar o mouse.
const variants: Record<Variant, string> = {
  primary: "glass-tint hover:brightness-[1.06]",
  secondary: "glass border text-ink hover:bg-white/80",
  ghost: "text-ink-2 hover:bg-white/70 hover:text-ink",
  destructive: "bg-danger text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_4px_12px_rgb(180_35_53/0.25)] hover:brightness-95",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3.5 text-body-sm gap-1.5",
  md: "h-10 px-4.5 text-body-sm gap-2",
  lg: "h-12 px-6 text-body gap-2",
  icon: "h-10 w-10 justify-center",
};

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, disabled, className, children, type = "button", ...props },
  ref,
) {
  return (
    <button
      ref={ref}
      type={type}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      className={cn(
        "inline-flex select-none items-center justify-center rounded-full font-medium whitespace-nowrap",
        "transition-[background-color,color,box-shadow,filter,transform] duration-(--duration-fast) ease-(--ease-spring)",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.97] motion-reduce:active:scale-100",
        variants[variant],
        sizes[size],
        className,
      )}
      {...props}
    >
      {loading && <Loader2 className="size-4 animate-spin motion-reduce:animate-none" aria-hidden />}
      {children}
    </button>
  );
});
