"use client";

import Link from "next/link";
import { useParams, usePathname } from "next/navigation";
import { signOut } from "@/modules/auth/actions";
import * as Menu from "@radix-ui/react-dropdown-menu";
import { CalendarDays, Check, ChevronsUpDown, FlaskConical, Home, LogOut, Plus, RotateCcw, Settings2, Users, Wallet, type LucideIcon } from "lucide-react";
import { useEffect, type ReactNode } from "react";
import { actions, select, useDb } from "@/prototype/store";
import { canAccess, ROLE_LABEL, type Section } from "@/prototype/access";
import type { Role } from "@/prototype/types";
import { useSession, type ClinicSession } from "./session-context";
import { Avatar, EmptyState, Skeleton } from "@/ui/primitives";
import { Button } from "@/ui/button";
import { useToast } from "@/ui/toast";
import { cn } from "@/lib/cn";

const NAV: { section: Section; label: string; icon: LucideIcon }[] = [
  { section: "inicio", label: "Início", icon: Home },
  { section: "agenda", label: "Agenda", icon: CalendarDays },
  { section: "pacientes", label: "Pacientes", icon: Users },
  { section: "financeiro", label: "Financeiro", icon: Wallet },
  { section: "gestao", label: "Gestão", icon: Settings2 },
];

export function AppShell({ children }: { children: ReactNode }) {
  const db = useDb();
  const session = useSession();
  const { org } = useParams<{ org: string }>();
  const pathname = usePathname();
  const current = (pathname.split("/")[3] ?? "inicio") as Section;
  const base = `/c/${org}`;

  const role = session.role;

  // As telas de agenda/pacientes ainda usam dados de demonstração (D-18): alinha o "visualizador"
  // desses dados ao papel REAL, para a interface não mostrar mais do que o papel permite.
  useEffect(() => {
    if (db && db.viewer.role !== role) actions.setViewer(role);
  }, [db, role]);

  if (!db) return <ShellSkeleton />;

  const items = NAV.filter((n) => canAccess(role, n.section));
  const pending = select.pendingRequests(db).length;

  return (
    <div className="min-h-dvh bg-[radial-gradient(1200px_600px_at_100%_-10%,var(--color-accent-subtle),transparent_60%)]">
      <a href="#conteudo" className="sr-only z-[70] rounded-sm bg-surface px-3 py-2 focus:not-sr-only focus:fixed focus:top-2 focus:left-2">
        Pular para o conteúdo
      </a>
      <DemoDataBar />

      {/* Barra lateral (desktop/tablet) */}
      <aside className="glass fixed top-10 bottom-3 left-3 z-20 hidden w-[76px] flex-col rounded-lg border p-2 md:flex lg:w-[240px] lg:p-3">
        <OrgSwitcher session={session} />
        <nav aria-label="Principal" className="mt-4 flex flex-col gap-1">
          {items.map((n) => {
            const active = current === n.section;
            return (
              <Link
                key={n.section}
                href={`${base}/${n.section}`}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "relative flex h-11 items-center justify-center gap-3 rounded-sm px-3 text-body-sm font-medium transition-colors lg:justify-start",
                  active ? "bg-surface text-accent shadow-sm" : "text-ink-2 hover:bg-white/60 hover:text-ink",
                )}
              >
                <n.icon className="size-5 shrink-0" aria-hidden />
                <span className="sr-only lg:not-sr-only">{n.label}</span>
                {n.section === "agenda" && pending > 0 && (
                  <span className="absolute top-1.5 right-1.5 grid h-5 min-w-5 place-items-center rounded-full bg-warning px-1 text-caption text-white lg:static lg:ml-auto">
                    {pending}
                    <span className="sr-only"> solicitações pendentes</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>
        <div className="mt-auto">
          <UserMenu name={session.user.name} email={session.user.email} role={role} />
        </div>
      </aside>

      {/* Cabeçalho (celular) */}
      <header className="glass sticky top-8 z-20 mx-2 mt-2 flex h-14 items-center justify-between rounded-lg border px-3 md:hidden">
        <OrgSwitcher session={session} compact />
        <UserMenu name={session.user.name} email={session.user.email} role={role} compact />
      </header>

      <main id="conteudo" className="px-4 pt-6 pb-28 md:pt-14 md:pr-6 md:pb-10 md:pl-[100px] lg:pl-[272px]">
        <div className="mx-auto max-w-[1400px]">{canAccess(role, current) ? children : <NoAccess />}</div>
      </main>

      {/* Barra inferior (celular) */}
      <nav aria-label="Principal" className="glass fixed inset-x-2 bottom-2 z-20 flex rounded-xl border p-1 pb-[max(0.25rem,env(safe-area-inset-bottom))] md:hidden">
        {items.map((n) => {
          const active = current === n.section;
          return (
            <Link
              key={n.section}
              href={`${base}/${n.section}`}
              aria-current={active ? "page" : undefined}
              className={cn(
                "relative flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 rounded-lg text-caption font-medium",
                active ? "bg-surface text-accent shadow-sm" : "text-ink-2",
              )}
            >
              <n.icon className="size-5" aria-hidden />
              {n.label}
              {n.section === "agenda" && pending > 0 && (
                <span className="absolute top-1.5 right-[calc(50%-20px)] grid h-4 min-w-4 place-items-center rounded-full bg-warning px-1 text-[10px] text-white">
                  {pending}
                  <span className="sr-only"> solicitações pendentes</span>
                </span>
              )}
            </Link>
          );
        })}
      </nav>
    </div>
  );
}

/** Avisa que agenda e pacientes ainda usam dados de demonstração (D-18) e permite restaurá-los. */
function DemoDataBar() {
  const toast = useToast();
  return (
    <div className="sticky top-0 z-30 flex h-8 items-center justify-center gap-2 bg-ink px-3 text-caption text-white md:fixed md:inset-x-0">
      <FlaskConical className="size-3.5 shrink-0" aria-hidden />
      <span>
        <span className="hidden sm:inline">Login e clínica reais · </span>agenda e pacientes com dados de demonstração
      </span>
      <button
        onClick={() => {
          actions.reset();
          toast({ message: "Dados de demonstração restaurados.", tone: "info" });
        }}
        className="ml-1 inline-flex h-6 items-center gap-1 rounded-xs px-1.5 hover:bg-white/15"
      >
        <RotateCcw className="size-3.5" aria-hidden />
        <span className="hidden sm:inline">Restaurar</span>
        <span className="sr-only sm:hidden">Restaurar dados de demonstração</span>
      </button>
    </div>
  );
}

function OrgSwitcher({ session, compact }: { session: ClinicSession; compact?: boolean }) {
  const { name, slug } = session.organization;
  return (
    <Menu.Root>
      <Menu.Trigger
        className={cn(
          "flex h-12 w-full items-center gap-2.5 rounded-sm px-1.5 text-left hover:bg-white/60",
          !compact && "justify-center lg:justify-start",
        )}
        aria-label={`Clínica atual: ${name}. Trocar de clínica`}
      >
        <span className="grid size-9 shrink-0 place-items-center rounded-sm bg-accent text-body-sm font-semibold text-on-accent" aria-hidden>
          {name[0]}
        </span>
        <span className={cn("min-w-0 flex-1", !compact && "hidden lg:block")}>
          <span className="block truncate text-body-sm font-semibold">{name}</span>
          <span className="block text-caption text-ink-3">{ROLE_LABEL[session.role]}</span>
        </span>
        <ChevronsUpDown className={cn("size-4 text-ink-3", !compact && "hidden lg:block")} aria-hidden />
      </Menu.Trigger>
      <MenuContent>
        <Menu.Label className="px-2 py-1.5 text-caption text-ink-3">Suas clínicas</Menu.Label>
        {session.clinics.map((c) => (
          <Menu.Item key={c.slug} asChild>
            <Link
              href={`/c/${c.slug}/inicio`}
              aria-current={c.slug === slug ? "true" : undefined}
              className="flex min-h-10 items-center gap-2 rounded-sm px-2 py-1.5 text-body-sm outline-none data-[highlighted]:bg-accent-subtle"
            >
              <Check className={cn("size-4 shrink-0 text-accent", c.slug !== slug && "invisible")} aria-hidden />
              <span className="min-w-0 flex-1">
                <span className="block truncate">{c.name}</span>
                <span className="block text-caption text-ink-3">{ROLE_LABEL[c.role]}</span>
              </span>
            </Link>
          </Menu.Item>
        ))}
        <Menu.Separator className="my-1 h-px bg-line" />
        <Menu.Item asChild>
          <Link href="/onboarding" className="flex h-10 items-center gap-2 rounded-sm px-2 text-body-sm outline-none data-[highlighted]:bg-accent-subtle">
            <Plus className="size-4 text-ink-2" aria-hidden /> Criar outra clínica
          </Link>
        </Menu.Item>
      </MenuContent>
    </Menu.Root>
  );
}

function UserMenu({ name, email, role, compact }: { name: string; email: string | null; role: Role; compact?: boolean }) {
  return (
    <Menu.Root>
      <Menu.Trigger className="flex w-full items-center gap-2.5 rounded-sm p-1.5 text-left hover:bg-white/60" aria-label={`Conta: ${name}, ${ROLE_LABEL[role]}`}>
        <Avatar name={name} />
        <span className={cn("min-w-0 flex-1", compact ? "hidden" : "hidden lg:block")}>
          <span className="block truncate text-body-sm font-medium">{name}</span>
          <span className="block text-caption text-ink-3">{ROLE_LABEL[role]}</span>
        </span>
      </Menu.Trigger>
      <MenuContent>
        <Menu.Label className="px-2 py-1.5">
          <span className="block text-body-sm font-medium">{name}</span>
          {email && <span className="block text-caption text-ink-3">{email}</span>}
        </Menu.Label>
        <MenuItem onSelect={() => void signOut()}>
          <LogOut className="size-4" aria-hidden /> Sair
        </MenuItem>
      </MenuContent>
    </Menu.Root>
  );
}

function MenuContent({ children }: { children: ReactNode }) {
  return (
    <Menu.Portal>
      <Menu.Content
        sideOffset={6}
        align="start"
        className="glass-strong z-30 min-w-56 rounded-md border p-1 animate-[fade-in_var(--duration-base)]"
      >
        {children}
      </Menu.Content>
    </Menu.Portal>
  );
}

function MenuItem({ children, onSelect, disabled }: { children: ReactNode; onSelect?: () => void; disabled?: boolean }) {
  return (
    <Menu.Item
      onSelect={onSelect}
      disabled={disabled}
      className="flex h-10 cursor-default items-center gap-2 rounded-sm px-2 text-body-sm outline-none data-[disabled]:text-ink-3 data-[highlighted]:bg-accent-subtle"
    >
      {children}
    </Menu.Item>
  );
}

function NoAccess() {
  return (
    <EmptyState
      icon={Settings2}
      title="Você não tem acesso a esta área"
      description="Fale com o gestor da clínica se precisar desta permissão."
      action={
        <Button variant="secondary" onClick={() => history.back()}>
          Voltar
        </Button>
      }
    />
  );
}

export function ShellSkeleton() {
  return (
    <div className="p-4 md:pt-14 md:pl-[100px] lg:pl-[272px]" aria-busy="true" aria-label="Carregando">
      <Skeleton className="h-8 w-48" />
      <div className="mt-6 grid gap-4 md:grid-cols-3">
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
        <Skeleton className="h-40" />
      </div>
    </div>
  );
}
