import { clsx, type ClassValue } from "clsx";
import { extendTailwindMerge } from "tailwind-merge";

// Ensina o tailwind-merge sobre os tamanhos de texto do design system,
// para não confundi-los com cores (ambos usam o prefixo "text-").
const twMerge = extendTailwindMerge({
  extend: {
    classGroups: {
      "font-size": [
        { text: ["display", "title-1", "title-2", "headline", "body", "body-sm", "caption"] },
      ],
    },
  },
});

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}
