"use client";

import Link from "next/link";
import { useEffect, useMemo, useRef, useState } from "react";
import { addDays, addHours, isSameDay, startOfDay } from "date-fns";
import { ArrowLeft, CalendarCheck, Check, ChevronRight, Clock, Copy, ShieldCheck, Sparkles, UserRound } from "lucide-react";
import { freeSlots } from "@/modules/availability/rules";
import { PublicHeader } from "@/modules/public-booking/components/public-header";
import { actions, useDb } from "@/prototype/store";
import type { Db, Professional, Service } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input, Textarea } from "@/ui/field";
import { Avatar, EmptyState, Skeleton } from "@/ui/primitives";
import { useToast } from "@/ui/toast";
import { cap, fmt, maskPhone, money, time, toE164 } from "@/lib/format";
import { cn } from "@/lib/cn";

const ANY = "any";
const PRIVACY_VERSION = "2026-10-v1";

export default function PublicBookingPage() {
  const db = useDb();
  if (!db) {
    return (
      <div className="mx-auto max-w-xl p-4" aria-busy="true" aria-label="Carregando">
        <Skeleton className="h-14" />
        <Skeleton className="mt-6 h-8 w-2/3" />
        <Skeleton className="mt-4 h-20" />
        <Skeleton className="mt-3 h-20" />
      </div>
    );
  }
  return <Flow db={db} />;
}

type Step = "service" | "professional" | "time" | "details" | "done";

function Flow({ db }: { db: Db }) {
  const toast = useToast();
  const services = db.services.filter((s) => s.isPublic);
  const [step, setStep] = useState<Step>("service");
  const [serviceId, setServiceId] = useState<string | null>(null);
  const [profChoice, setProfChoice] = useState<string | null>(null);
  const [day, setDay] = useState<Date | null>(null);
  const [slot, setSlot] = useState<{ start: Date; professionalId: string } | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [token, setToken] = useState<string | null>(null);
  const [contact, setContact] = useState<Contact>({ name: "", tel: "", email: "", message: "", consent: false });
  const heading = useRef<HTMLHeadingElement>(null);

  const service = services.find((s) => s.id === serviceId) ?? null;
  const professionals = service ? db.professionals.filter((p) => p.acceptsPublic && service.professionalIds.includes(p.id)) : [];
  const skipProfessional = professionals.length <= 1;
  const steps: Step[] = skipProfessional ? ["service", "time", "details"] : ["service", "professional", "time", "details"];
  const index = steps.indexOf(step);

  useEffect(() => {
    heading.current?.focus();
    window.scrollTo({ top: 0, behavior: "instant" as ScrollBehavior });
  }, [step]);

  function back() {
    setNotice(null);
    setStep(steps[index - 1]);
  }

  const titles: Record<Step, string> = {
    service: "Qual atendimento você procura?",
    professional: "Com quem você prefere?",
    time: "Escolha o dia e o horário",
    details: "Seus dados",
    done: "Solicitação enviada",
  };

  return (
    <div className="min-h-dvh bg-[radial-gradient(700px_400px_at_50%_-10%,var(--color-accent-subtle),transparent_70%)]">
      <PublicHeader org={db.org} />
      <main className="mx-auto max-w-xl px-4 pt-5 pb-16">
        {step !== "done" && (
          <div className="mb-5 flex items-center justify-between">
            {index > 0 ? (
              <Button variant="ghost" size="sm" onClick={back} className="-ml-2">
                <ArrowLeft className="size-4" aria-hidden /> Voltar
              </Button>
            ) : (
              <span />
            )}
            <span className="text-body-sm text-ink-2">
              Passo {index + 1} de {steps.length}
            </span>
          </div>
        )}

        <h1 ref={heading} tabIndex={-1} className="text-title-1 font-semibold outline-none">
          {titles[step]}
        </h1>

        {notice && (
          <p role="alert" className="mt-4 rounded-sm border border-warning/30 bg-warning-subtle p-3 text-body-sm text-warning">
            {notice}
          </p>
        )}

        <div className="mt-5">
          {step === "service" &&
            (services.length === 0 ? (
              <EmptyState icon={CalendarCheck} title="Agendamento online indisponível" description="Entre em contato com a clínica por telefone." />
            ) : (
              <ul className="flex flex-col gap-3">
                {services.map((s) => (
                  <li key={s.id}>
                    <ServiceCard s={s} selected={s.id === serviceId} onClick={() => {
                      setServiceId(s.id);
                      setSlot(null);
                      setDay(null);
                      const profs = db.professionals.filter((p) => p.acceptsPublic && s.professionalIds.includes(p.id));
                      setProfChoice(profs.length === 1 ? profs[0].id : null);
                      setStep(profs.length <= 1 ? "time" : "professional");
                    }} />
                  </li>
                ))}
              </ul>
            ))}

          {step === "professional" && service && (
            <ul className="flex flex-col gap-3">
              <li>
                <ChoiceRow selected={profChoice === ANY} onClick={() => { setProfChoice(ANY); setSlot(null); setStep("time"); }} icon={<span className="grid size-11 place-items-center rounded-full bg-muted text-ink-2"><Sparkles className="size-5" aria-hidden /></span>} title="Sem preferência" subtitle="Mostramos todos os horários disponíveis" />
              </li>
              {professionals.map((p) => (
                <li key={p.id}>
                  <ChoiceRow selected={profChoice === p.id} onClick={() => { setProfChoice(p.id); setSlot(null); setStep("time"); }} icon={<Avatar name={p.name} color={p.color} />} title={p.name} subtitle={p.specialty} />
                </li>
              ))}
            </ul>
          )}

          {step === "time" && service && (
            <TimePicker
              db={db}
              service={service}
              professionals={profChoice && profChoice !== ANY ? professionals.filter((p) => p.id === profChoice) : professionals}
              day={day}
              onDay={(d) => { setDay(d); setSlot(null); }}
              slot={slot}
              onSlot={(s) => { setSlot(s); setNotice(null); setStep("details"); }}
            />
          )}

          {step === "details" && service && slot && (
            <Details
              db={db}
              service={service}
              slot={slot}
              contact={contact}
              onContact={setContact}
              onSubmit={(data) => {
                const res = actions.requestPublic({ ...data, professionalId: slot.professionalId, serviceId: service.id, startsAt: slot.start });
                if (!res.ok) {
                  setNotice(res.error);
                  if (res.error.includes("horário")) {
                    setSlot(null);
                    setStep("time");
                  }
                  return;
                }
                setToken(res.token);
                setStep("done");
              }}
            />
          )}

          {step === "done" && service && slot && token && (
            <Done
              db={db}
              service={service}
              slot={slot}
              token={token}
              onCopy={async (url) => {
                try {
                  await navigator.clipboard.writeText(url);
                  toast({ message: "Link copiado.", tone: "success" });
                } catch {
                  toast({ message: "Não foi possível copiar. Guarde o link exibido.", tone: "info" });
                }
              }}
            />
          )}
        </div>
      </main>
    </div>
  );
}

function ServiceCard({ s, selected, onClick }: { s: Service; selected: boolean; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-20 w-full items-center gap-4 rounded-md border bg-surface p-4 text-left shadow-xs transition-[border-color,box-shadow] active:scale-[.99] motion-reduce:active:scale-100",
        selected ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:border-line-strong",
      )}
    >
      <div className="min-w-0 flex-1">
        <p className="text-headline font-semibold">{s.name}</p>
        <p className="mt-0.5 flex flex-wrap items-center gap-x-3 text-body-sm text-ink-2">
          <span className="inline-flex items-center gap-1"><Clock className="size-3.5" aria-hidden /> {s.durationMin} min</span>
          {s.showPrice && s.priceCents != null && <span className="tabular">{money(s.priceCents)}</span>}
        </p>
      </div>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </button>
  );
}

function ChoiceRow({ selected, onClick, icon, title, subtitle }: { selected: boolean; onClick: () => void; icon: React.ReactNode; title: string; subtitle: string }) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "flex min-h-18 w-full items-center gap-4 rounded-md border bg-surface p-4 text-left shadow-xs",
        selected ? "border-accent shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:border-line-strong",
      )}
    >
      {icon}
      <span className="min-w-0 flex-1">
        <span className="block text-headline font-semibold">{title}</span>
        <span className="block text-body-sm text-ink-2">{subtitle}</span>
      </span>
      <ChevronRight className="size-5 text-ink-3" aria-hidden />
    </button>
  );
}

function TimePicker({
  db, service, professionals, day, onDay, slot, onSlot,
}: {
  db: Db;
  service: Service;
  professionals: Professional[];
  day: Date | null;
  onDay: (d: Date) => void;
  slot: { start: Date; professionalId: string } | null;
  onSlot: (s: { start: Date; professionalId: string }) => void;
}) {
  const { minLeadHours, maxDaysAhead } = db.org.settings;
  const notBefore = addHours(new Date(), minLeadHours);

  // Horários por dia, unindo profissionais quando "sem preferência" (o primeiro livre é atribuído).
  const byDay = useMemo(() => {
    const days = Array.from({ length: Math.min(maxDaysAhead, 28) }, (_, i) => addDays(startOfDay(new Date()), i));
    return days.map((d) => {
      const merged = new Map<number, { start: Date; professionalId: string }>();
      for (const p of professionals) {
        for (const s of freeSlots({
          day: d, professionalId: p.id, durationMin: service.durationMin, bufferAfterMin: service.bufferAfterMin,
          stepMin: db.org.settings.slotStepMin, rules: db.availability, blocks: db.blocks, appointments: db.appointments, notBefore,
        })) {
          if (!merged.has(+s)) merged.set(+s, { start: s, professionalId: p.id });
        }
      }
      return { day: d, slots: [...merged.values()].sort((a, b) => +a.start - +b.start) };
    });
    // notBefore muda a cada render; o cálculo só precisa refazer quando os dados mudam.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [db, service, professionals, maxDaysAhead]);
  const slotsFor = (d: Date) => byDay.find((x) => isSameDay(x.day, d))?.slots ?? [];

  const days = byDay.map((x) => x.day);
  const firstAvailable = days.find((d) => slotsFor(d).length > 0);
  const current = day ?? firstAvailable ?? null;
  const list = current ? slotsFor(current) : [];
  const groups = [
    { label: "Manhã", items: list.filter((s) => s.start.getHours() < 12) },
    { label: "Tarde", items: list.filter((s) => s.start.getHours() >= 12 && s.start.getHours() < 18) },
    { label: "Noite", items: list.filter((s) => s.start.getHours() >= 18) },
  ].filter((g) => g.items.length);

  if (!firstAvailable) {
    return <EmptyState icon={CalendarCheck} title="Sem horários nas próximas semanas" description="Ligue para a clínica para verificar outras opções." />;
  }

  return (
    <div className="flex flex-col gap-6">
      <div className="-mx-4 flex snap-x gap-2 overflow-x-auto px-4 pb-2" role="radiogroup" aria-label="Dia">
        {days.map((d) => {
          const available = slotsFor(d).length > 0;
          const selected = current && isSameDay(d, current);
          return (
            <button
              key={+d}
              role="radio"
              aria-checked={!!selected}
              disabled={!available}
              onClick={() => onDay(d)}
              aria-label={`${fmt(d, "EEEE, d 'de' MMMM")}${available ? "" : ", sem horários"}`}
              className={cn(
                "flex h-[72px] w-[60px] shrink-0 snap-start flex-col items-center justify-center rounded-md border text-body-sm transition-colors",
                selected ? "border-accent bg-accent text-on-accent shadow-sm" : available ? "border-line bg-surface hover:border-accent" : "border-transparent bg-transparent text-ink-3 line-through",
              )}
            >
              <span className={cn("text-caption capitalize", !selected && available && "text-ink-2")}>{fmt(d, "EEE")}</span>
              <span className="tabular text-title-2 font-semibold">{d.getDate()}</span>
              <span className={cn("text-[11px] capitalize", !selected && "text-ink-3")}>{fmt(d, "MMM")}</span>
            </button>
          );
        })}
      </div>

      <p className="-mt-3 text-body-sm font-medium text-ink-2" aria-live="polite">
        {current && cap(fmt(current, "EEEE, d 'de' MMMM"))}
      </p>

      {groups.map((g) => (
        <section key={g.label} aria-label={g.label}>
          <h2 className="mb-2 text-caption font-semibold tracking-wide text-ink-2 uppercase">{g.label}</h2>
          <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
            {g.items.map((s) => (
              <button
                key={+s.start}
                onClick={() => onSlot(s)}
                aria-pressed={slot ? +slot.start === +s.start : false}
                className="tabular h-12 rounded-sm border border-line-strong bg-surface text-body font-medium shadow-xs hover:border-accent hover:bg-accent-subtle active:bg-accent active:text-on-accent"
              >
                {time(s.start)}
              </button>
            ))}
          </div>
        </section>
      ))}
    </div>
  );
}

function Summary({ db, service, slot }: { db: Db; service: Service; slot: { start: Date; professionalId: string } }) {
  const prof = db.professionals.find((p) => p.id === slot.professionalId)!;
  return (
    <div className="flex items-center gap-3 rounded-md border border-line bg-surface p-4 shadow-xs">
      <Avatar name={prof.name} color={prof.color} />
      <div className="min-w-0 text-body-sm">
        <p className="font-semibold">{service.name}</p>
        <p className="text-ink-2">
          {cap(fmt(slot.start, "EEEE, d 'de' MMMM"))} · {time(slot.start)}
        </p>
        <p className="text-ink-2">{prof.name}</p>
      </div>
    </div>
  );
}

export interface Contact {
  name: string;
  tel: string;
  email: string;
  message: string;
  consent: boolean;
}

function Details({
  db, service, slot, contact, onContact, onSubmit,
}: {
  db: Db;
  service: Service;
  slot: { start: Date; professionalId: string };
  contact: Contact;
  onContact: (c: Contact) => void;
  onSubmit: (d: { name: string; phone: string; email?: string; message?: string }) => void;
}) {
  // Os dados ficam no fluxo (não neste passo) para sobreviver a "Voltar" e a conflitos de horário.
  const { name, tel, email, message, consent } = contact;
  const set = (patch: Partial<Contact>) => onContact({ ...contact, ...patch });
  const setName = (v: string) => set({ name: v });
  const setTel = (v: string) => set({ tel: v });
  const setEmail = (v: string) => set({ email: v });
  const setMessage = (v: string) => set({ message: v });
  const setConsent = (v: boolean) => set({ consent: v });
  const [privacyOpen, setPrivacyOpen] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [sending, setSending] = useState(false);

  return (
    <form
      noValidate
      className="flex flex-col gap-4"
      onSubmit={(e) => {
        e.preventDefault();
        const err: Record<string, string> = {};
        const e164 = toE164(tel);
        if (name.trim().split(/\s+/).length < 2) err.name = "Informe nome e sobrenome.";
        if (!e164) err.tel = "Informe um celular com DDD.";
        if (email && !/^\S+@\S+\.\S+$/.test(email)) err.email = "E-mail inválido.";
        if (!consent) err.consent = "É preciso concordar para enviar.";
        setErrors(err);
        if (Object.keys(err).length) return;
        setSending(true);
        setTimeout(() => {
          setSending(false);
          onSubmit({ name: name.trim(), phone: e164!, email: email || undefined, message: message.trim() || undefined });
        }, 500);
      }}
    >
      <Summary db={db} service={service} slot={slot} />

      <Field label="Nome completo" error={errors.name}>
        <Input value={name} onChange={(e) => setName(e.target.value)} autoComplete="name" autoCapitalize="words" />
      </Field>
      <Field label="Celular" error={errors.tel} hint="A clínica usa para confirmar o horário.">
        <Input type="tel" inputMode="tel" autoComplete="tel-national" value={tel} onChange={(e) => setTel(maskPhone(e.target.value))} placeholder="(11) 90000-0000" />
      </Field>
      <Field label="E-mail" optional error={errors.email} hint="Para receber a confirmação.">
        <Input type="email" inputMode="email" autoComplete="email" value={email} onChange={(e) => setEmail(e.target.value)} />
      </Field>
      <Field label="Mensagem para a clínica" optional hint="Não é preciso informar detalhes de saúde.">
        <Textarea value={message} onChange={(e) => setMessage(e.target.value)} rows={2} className="min-h-16" maxLength={300} />
      </Field>

      <div>
        <label className="flex cursor-pointer items-start gap-3 rounded-sm p-1 text-body-sm">
          <input
            type="checkbox"
            checked={consent}
            onChange={(e) => setConsent(e.target.checked)}
            aria-invalid={!!errors.consent}
            aria-describedby={errors.consent ? "consent-error" : undefined}
            className="mt-0.5 size-5 shrink-0 accent-[var(--color-accent)]"
          />
          <span>
            Li e concordo com o{" "}
            <button type="button" onClick={() => setPrivacyOpen((v) => !v)} aria-expanded={privacyOpen} className="font-medium text-accent underline underline-offset-2">
              aviso de privacidade
            </button>{" "}
            para o tratamento dos meus dados pela {db.org.name}.
          </span>
        </label>
        {errors.consent && <p id="consent-error" className="mt-1 ml-9 text-caption text-danger">{errors.consent}</p>}
        {privacyOpen && (
          <div className="mt-2 ml-9 rounded-sm bg-canvas p-3 text-caption text-ink-2">
            <p className="font-semibold text-ink">Aviso de privacidade (texto provisório · versão {PRIVACY_VERSION})</p>
            <p className="mt-1">
              Usamos seu nome, celular e e-mail somente para responder a esta solicitação e organizar seu atendimento. A {db.org.name} é a controladora dos dados. O texto definitivo será revisado juridicamente na Fase 10.
            </p>
          </div>
        )}
      </div>

      <p className="flex items-center gap-2 text-caption text-ink-3">
        <ShieldCheck className="size-4 shrink-0" aria-hidden /> Verificação anti-robô invisível (simulada no protótipo).
      </p>

      <Button type="submit" size="lg" loading={sending} className="mt-1">
        Enviar solicitação
      </Button>
      <p className="text-center text-caption text-ink-2">O horário fica reservado até a clínica responder (até {db.org.settings.holdHours} h).</p>
    </form>
  );
}

function Done({ db, service, slot, token, onCopy }: { db: Db; service: Service; slot: { start: Date; professionalId: string }; token: string; onCopy: (url: string) => void }) {
  const path = `/agendar/${db.org.slug}/status/${token}`;
  const url = typeof window !== "undefined" ? `${window.location.origin}${path}` : path;
  return (
    <div className="flex flex-col gap-5">
      <div className="flex flex-col items-center rounded-lg border border-line bg-surface p-6 text-center shadow-sm">
        <span className="grid size-14 place-items-center rounded-full bg-success-subtle text-success">
          <Check className="size-7" aria-hidden />
        </span>
        <p className="mt-4 text-headline font-semibold">Recebemos seu pedido</p>
        <p className="mt-1 text-body-sm text-ink-2">
          A {db.org.name} vai confirmar em até {db.org.settings.holdHours} horas. Você pode acompanhar pelo link abaixo.
        </p>
      </div>
      <Summary db={db} service={service} slot={slot} />
      <div className="rounded-md border border-line bg-surface p-4">
        <p className="flex items-center gap-2 text-body-sm font-semibold">
          <UserRound className="size-4 text-ink-2" aria-hidden /> Link de acompanhamento
        </p>
        <p className="mt-1 text-caption text-ink-2">Guarde este link. Ele é pessoal e permite ver o status ou cancelar.</p>
        <p className="mt-3 rounded-sm bg-canvas px-3 py-2 font-mono text-caption break-all text-ink-2">{url}</p>
        <div className="mt-3 grid grid-cols-2 gap-2">
          <Button variant="secondary" onClick={() => onCopy(url)}>
            <Copy className="size-4" aria-hidden /> Copiar
          </Button>
          <Link href={path} className="inline-flex h-10 items-center justify-center rounded-sm bg-accent px-4 text-body-sm font-medium text-on-accent hover:bg-accent-hover">
            Acompanhar
          </Link>
        </div>
      </div>
    </div>
  );
}
