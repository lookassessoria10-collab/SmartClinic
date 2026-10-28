import { MapPin, Phone } from "lucide-react";
import type { Organization } from "@/prototype/types";
import { phone } from "@/lib/format";

export function PublicHeader({ org }: { org: Organization }) {
  return (
    <header className="glass sticky top-0 z-20 border-b">
      <div className="mx-auto flex max-w-xl items-center gap-3 px-4 py-3">
        <span className="grid size-10 shrink-0 place-items-center rounded-md bg-accent text-headline font-semibold text-on-accent" aria-hidden>
          {org.name[0]}
        </span>
        <div className="min-w-0 flex-1">
          <p className="truncate text-headline font-semibold">{org.name}</p>
          <p className="flex items-center gap-1 truncate text-caption text-ink-2">
            <MapPin className="size-3 shrink-0" aria-hidden /> {org.address}
          </p>
        </div>
        <a href={`tel:${org.phone}`} className="grid size-11 place-items-center rounded-full text-accent hover:bg-accent-subtle" aria-label={`Ligar para a clínica: ${phone(org.phone)}`}>
          <Phone className="size-5" aria-hidden />
        </a>
      </div>
    </header>
  );
}
