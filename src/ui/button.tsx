import { forwardRef, type ButtonHTMLAttributes } from "react";
import { Loader2 } from "lucide-react";
import { cn } from "@/lib/cn";

type Variant = "primary" | "secondary" | "ghost" | "destructive";
type Size = "sm" | "md" | "lg" | "icon";

const variants: Record<Variant, string> = {
  primary: "bg-accent text-on-accent hover:bg-accent-hover shadow-xs",
  secondary: "bg-surface text-ink border border-line-strong hover:bg-muted shadow-xs",
  ghost: "text-ink-2 hover:bg-muted hover:text-ink",
  destructive: "bg-danger text-white hover:brightness-95 shadow-xs",
};

const sizes: Record<Size, string> = {
  sm: "h-9 px-3 text-body-sm gap-1.5",
  md: "h-10 px-4 text-body-sm gap-2",
  lg: "h-12 px-5 text-body gap-2",
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
        "inline-flex select-none items-center justify-center rounded-sm font-medium whitespace-nowrap",
        "transition-[background-color,color,box-shadow,filter] duration-(--duration-fast) ease-standard",
        "disabled:cursor-not-allowed disabled:opacity-50 active:scale-[.98] motion-reduce:active:scale-100",
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
