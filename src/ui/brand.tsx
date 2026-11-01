import { cn } from "@/lib/cn";

/**
 * Logotipo smartclin: palavra em Poppins, minúsculas, como na arte da marca (D-01).
 * Texto de verdade (não imagem): leitor de tela lê "smartclin" e a cor segue `currentColor`.
 */
export function Wordmark({ className }: { className?: string }) {
  return <span className={cn("font-[family-name:var(--font-display)] font-medium tracking-[-0.01em] lowercase", className)}>smartclin</span>;
}

/** Ícone do app: quadrado de vidro azul com o "s" da marca (mesmo desenho do favicon). */
export function BrandMark({ className }: { className?: string }) {
  return (
    <span
      aria-hidden
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[30%] text-white",
        "bg-[radial-gradient(120%_120%_at_20%_0%,#8ccbf2_0%,#0e6bb8_45%,#062f5e_100%)]",
        "shadow-[inset_0_1px_0_rgb(255_255_255/0.55),inset_0_-1px_0_rgb(6_47_94/0.4),0_4px_12px_rgb(14_107_184/0.3)]",
        className,
      )}
    >
      <span className="absolute inset-x-0 top-0 h-1/2 bg-[linear-gradient(180deg,rgb(255_255_255/0.35),transparent)]" />
      <span className="relative font-[family-name:var(--font-display)] leading-none font-semibold">s</span>
    </span>
  );
}
