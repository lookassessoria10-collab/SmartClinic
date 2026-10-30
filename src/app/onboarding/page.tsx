"use client";

import { useEffect, useRef, useState, useTransition, type ReactNode } from "react";
import {
  ArrowLeft, Building2, CalendarCheck, Check, CircleAlert, Globe, HeartPulse, Layers, Loader2, Plus, Sparkles, Stethoscope, Upload, Wallet, type LucideIcon,
} from "lucide-react";
import { SEGMENT_SUGGESTIONS, segmentFamily } from "@/modules/organizations/suggestions";
import { checkSlug, createClinic } from "@/modules/organizations/actions";
import { slugify } from "@/modules/organizations/schemas";
import type { Need, Segment } from "@/prototype/types";
import { Button } from "@/ui/button";
import { Field, Input } from "@/ui/field";
import { cn } from "@/lib/cn";

const SEGMENTS: { value: Segment; label: string; icon: LucideIcon }[] = [
  { value: "medical_clinic", label: "Clínica médica", icon: Stethoscope },
  { value: "medical_office", label: "Consultório médico", icon: Stethoscope },
  { value: "dental_clinic", label: "Clínica odontológica", icon: HeartPulse },
  { value: "dental_office", label: "Consultório odontológico", icon: HeartPulse },
  { value: "aesthetic_clinic", label: "Clínica de estética", icon: Sparkles },
  { value: "aesthetic_office", label: "Consultório de estética", icon: Sparkles },
  { value: "multidisciplinary", label: "Clínica multidisciplinar", icon: Layers },
  { value: "other", label: "Outro", icon: Building2 },
];

const SIZES = ["Só eu", "2 a 5", "6 a 10", "Mais de 10"];

const NEEDS: { value: Need; label: string; description: string; icon: LucideIcon }[] = [
  { value: "schedule", label: "Organizar a agenda", description: "Substituir caderno, planilha ou agenda pessoal.", icon: CalendarCheck },
  { value: "online_booking", label: "Receber agendamentos online", description: "Um link para pacientes pedirem horário.", icon: Globe },
  { value: "finance", label: "Controlar o financeiro", description: "Recebimentos, despesas e pendências.", icon: Wallet },
  { value: "migrate", label: "Migrar de outro sistema", description: "Importar pacientes, profissionais e serviços.", icon: Upload },
];

const FUTURE: Record<string, string> = {
  dental: "Odontograma",
  aesthetic: "Pacotes de sessões",
  medical: "Prontuário",
  multidisciplinary: "Serviços por profissional",
};

export default function OnboardingPage() {
  const [step, setStep] = useState(0);
  const [name, setName] = useState("");
  // Endereço da página pública: sugerido pelo nome até a pessoa editá-lo.
  const [slug, setSlug] = useState("");
  const [slugEdited, setSlugEdited] = useState(false);
  const [slugStatus, setSlugStatus] = useState<{ state: "idle" | "checking" | "ok" | "bad"; message?: string }>({ state: "idle" });
  const [attends, setAttends] = useState<boolean | null>(null);
  const [specialty, setSpecialty] = useState("");
  const [saving, startSaving] = useTransition();
  const [segment, setSegment] = useState<Segment | null>(null);
  const [size, setSize] = useState<string | null>(null);
  const [services, setServices] = useState<string[]>([]);
  const [custom, setCustom] = useState("");
  const [need, setNeed] = useState<Need | null>(null);
  const [error, setError] = useState<string | null>(null);
  const heading = useRef<HTMLHeadingElement>(null);

  const family = segment ? segmentFamily(segment) : "multidisciplinary";
  const suggestions = SEGMENT_SUGGESTIONS[family];

  // Ao mudar de passo, o foco vai para o título (leitores de tela anunciam o novo passo).
  useEffect(() => heading.current?.focus(), [step]);

  // Verificação do endereço no banco, ~400 ms depois da última digitação.
  useEffect(() => {
    if (!slug) return;
    const t = setTimeout(async () => {
      const r = await checkSlug(slug);
      setSlugStatus(r.available ? { state: "ok" } : { state: "bad", message: r.message });
    }, 400);
    return () => clearTimeout(t);
  }, [slug]);

  function changeSlug(value: string, edited: boolean) {
    setSlug(value);
    setSlugEdited(edited);
    setSlugStatus(value ? { state: "checking" } : { state: "idle" });
  }

  function chooseSegment(s: Segment) {
    setSegment(s);
    setServices(SEGMENT_SUGGESTIONS[segmentFamily(s)].slice(0, 3).map((x) => x.name));
  }

  function next() {
    setError(null);
    if (step === 0 && !name.trim()) return setError("Informe o nome do estabelecimento.");
    if (step === 0 && slugStatus.state !== "ok")
      return setError(slugStatus.state === "checking" ? "Aguarde a verificação do endereço." : (slugStatus.message ?? "Escolha um endereço para a página de agendamento."));
    if (step === 0 && !segment) return setError("Escolha o tipo de estabelecimento.");
    if (step === 1 && !size) return setError("Escolha quantos profissionais atendem.");
    if (step === 1 && attends === null) return setError("Conte se você também atende os pacientes.");
    if (step === 2 && services.length === 0) return setError("Escolha ao menos um serviço. Você pode mudar depois.");
    if (step === 3 && !need) return setError("Escolha a principal necessidade.");
    setStep((s) => s + 1);
  }

  function finish() {
    setError(null);
    startSaving(async () => {
      // Sucesso: a Server Action redireciona para a clínica criada. Aqui só chegam erros.
      const r = await createClinic({ name, slug, segment, size, services, need, attends, specialty: specialty || undefined });
      if (r.fields?.slug) {
        setSlugStatus({ state: "bad", message: r.fields.slug });
        setStep(0);
      }
      setError(r.fields?.slug ?? r.message ?? "Não foi possível criar a clínica.");
    });
  }

  const titles = [
    "Qual é o tipo de estabelecimento?",
    "Quantos profissionais atendem?",
    "Quais serviços vocês oferecem?",
    "Qual é a principal necessidade agora?",
    "Preparamos tudo para você",
  ];

  return (
    <main className="min-h-dvh bg-[radial-gradient(900px_500px_at_50%_-20%,var(--color-accent-subtle),transparent_70%)] px-4 py-8 sm:py-14">
      <div className="mx-auto w-full max-w-2xl">
        <div className="mb-6 flex items-center justify-between">
          {step > 0 ? (
            <Button variant="ghost" size="sm" onClick={() => setStep((s) => s - 1)}>
              <ArrowLeft className="size-4" aria-hidden /> Voltar
            </Button>
          ) : (
            <span />
          )}
          {step < 4 && <span className="text-body-sm text-ink-2">Passo {step + 1} de 4</span>}
        </div>

        {step < 4 && (
          <div className="mb-8 flex gap-1.5" aria-hidden>
            {[0, 1, 2, 3].map((i) => (
              <span key={i} className={cn("h-1 flex-1 rounded-full transition-colors duration-(--duration-base)", i <= step ? "bg-accent" : "bg-line")} />
            ))}
          </div>
        )}

        <h1 ref={heading} tabIndex={-1} className="text-title-1 font-semibold outline-none sm:text-display">
          {titles[step]}
        </h1>

        <div className="mt-6">
          {step === 0 && (
            <div className="flex flex-col gap-6">
              <Field label="Nome do estabelecimento" hint="Aparece na sua página de agendamento.">
                <Input
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (!slugEdited) changeSlug(slugify(e.target.value), false);
                  }}
                  placeholder="Ex.: Clínica Aurora"
                  autoComplete="organization"
                />
              </Field>
              <Field
                label="Endereço da página de agendamento"
                error={slugStatus.state === "bad" ? slugStatus.message : undefined}
                hint={<SlugHint slug={slug} state={slugStatus.state} />}
              >
                <Input
                  value={slug}
                  onChange={(e) => changeSlug(e.target.value.toLowerCase().replace(/\s+/g, "-"), true)}
                  placeholder="clinica-aurora"
                  autoComplete="off"
                  autoCapitalize="none"
                  spellCheck={false}
                  inputMode="url"
                  maxLength={48}
                />
              </Field>
              <ChoiceGrid label="Tipo de estabelecimento">
                {SEGMENTS.map((s) => (
                  <Choice key={s.value} selected={segment === s.value} onSelect={() => chooseSegment(s.value)} icon={s.icon} label={s.label} />
                ))}
              </ChoiceGrid>
            </div>
          )}

          {step === 1 && (
            <div className="flex flex-col gap-8">
              <ChoiceGrid label="Número de profissionais" cols="sm:grid-cols-4">
                {SIZES.map((s) => (
                  <Choice
                    key={s}
                    selected={size === s}
                    onSelect={() => {
                      setSize(s);
                      if (s === "Só eu") setAttends(true);
                    }}
                    label={s}
                  />
                ))}
              </ChoiceGrid>
              <div>
                <h2 className="mb-3 text-headline font-semibold">Você também atende os pacientes?</h2>
                <ChoiceGrid label="Você também atende os pacientes?" cols="sm:grid-cols-2">
                  <Choice selected={attends === true} onSelect={() => setAttends(true)} label="Sim, eu atendo" description="Você terá a sua própria agenda." />
                  <Choice selected={attends === false} onSelect={() => setAttends(false)} label="Não, só administro" description="Você cadastra os profissionais depois." />
                </ChoiceGrid>
                {attends && (
                  <Field label="Sua especialidade" optional hint="Ex.: Dentista — ortodontia, Esteticista, Fisioterapeuta." className="mt-4">
                    <Input value={specialty} onChange={(e) => setSpecialty(e.target.value)} maxLength={80} />
                  </Field>
                )}
              </div>
            </div>
          )}

          {step === 2 && (
            <div>
              <p className="mb-4 text-body-sm text-ink-2">Sugestões para o seu tipo de estabelecimento. Duração e preço você ajusta depois.</p>
              <div className="flex flex-wrap gap-2" role="group" aria-label="Serviços">
                {[...new Set([...suggestions.map((s) => s.name), ...services])].map((n) => {
                  const on = services.includes(n);
                  return (
                    <button
                      key={n}
                      aria-pressed={on}
                      onClick={() => setServices((all) => (on ? all.filter((x) => x !== n) : [...all, n]))}
                      className={cn(
                        "inline-flex h-11 items-center gap-1.5 rounded-full border px-4 text-body-sm font-medium transition-colors",
                        on ? "border-accent bg-accent-subtle text-accent" : "border-line-strong bg-surface text-ink hover:bg-muted",
                      )}
                    >
                      {on && <Check className="size-4" aria-hidden />}
                      {n}
                    </button>
                  );
                })}
              </div>
              <form
                className="mt-5 flex gap-2"
                onSubmit={(e) => {
                  e.preventDefault();
                  const v = custom.trim();
                  if (v && !services.includes(v)) setServices((all) => [...all, v]);
                  setCustom("");
                }}
              >
                <label htmlFor="custom-service" className="sr-only">
                  Adicionar outro serviço
                </label>
                <Input id="custom-service" value={custom} onChange={(e) => setCustom(e.target.value)} placeholder="Adicionar outro serviço" />
                <Button type="submit" variant="secondary" size="icon" aria-label="Adicionar serviço" className="h-11 w-11 shrink-0">
                  <Plus className="size-4" aria-hidden />
                </Button>
              </form>
            </div>
          )}

          {step === 3 && (
            <ChoiceGrid label="Principal necessidade" cols="sm:grid-cols-2">
              {NEEDS.map((n) => (
                <Choice key={n.value} selected={need === n.value} onSelect={() => setNeed(n.value)} icon={n.icon} label={n.label} description={n.description} />
              ))}
            </ChoiceGrid>
          )}

          {step === 4 && (
            <div className="flex flex-col gap-4">
              <p className="text-body text-ink-2">Revise e ajuste quando quiser em <strong className="font-medium text-ink">Gestão</strong>. Nada aqui é definitivo.</p>
              <Summary title="Clínica">
                <p className="text-body-sm font-medium">{name}</p>
                <p className="text-body-sm text-ink-2">Página de agendamento: /agendar/{slug}</p>
              </Summary>
              <Summary title="Serviços">
                <ul className="divide-y divide-line">
                  {services.map((n) => {
                    const s = suggestions.find((x) => x.name === n);
                    return (
                      <li key={n} className="flex justify-between py-2.5 text-body-sm">
                        <span>{n}</span>
                        <span className="tabular text-ink-2">{s?.durationMin ?? 30} min</span>
                      </li>
                    );
                  })}
                </ul>
              </Summary>
              <Summary title="Horário de atendimento">
                <p className="text-body-sm">Segunda a sexta, 08:00–12:00 e 13:00–18:00</p>
              </Summary>
              <Summary title="Módulos ativos">
                <ul className="flex flex-wrap gap-2 text-body-sm">
                  <Pill on>Agenda</Pill>
                  <Pill on>Agendamento online</Pill>
                  <Pill on>Financeiro</Pill>
                  {need === "migrate" && <Pill on>Importação de dados</Pill>}
                  <Pill>{FUTURE[family]} · em breve</Pill>
                </ul>
              </Summary>
              {size === "Só eu" && (
                <p className="rounded-md bg-info-subtle p-3 text-body-sm text-info">Como você atende sozinho(a), o filtro de profissionais ficará oculto na agenda.</p>
              )}
            </div>
          )}
        </div>

        {error && (
          <p role="alert" className="mt-4 text-body-sm text-danger">
            {error}
          </p>
        )}

        <div className="mt-8 flex justify-end">
          {step < 4 ? (
            <Button size="lg" onClick={next} className="w-full sm:w-auto">
              Continuar
            </Button>
          ) : (
            <Button size="lg" onClick={finish} loading={saving} className="w-full sm:w-auto">
              Começar a usar
            </Button>
          )}
        </div>
      </div>
    </main>
  );
}

function SlugHint({ slug, state }: { slug: string; state: "idle" | "checking" | "ok" | "bad" }) {
  if (state === "checking")
    return (
      <span className="inline-flex items-center gap-1" role="status">
        <Loader2 className="size-3.5 animate-spin motion-reduce:animate-none" aria-hidden /> Verificando disponibilidade…
      </span>
    );
  if (state === "ok")
    return (
      <span className="inline-flex items-center gap-1 text-success" role="status">
        <Check className="size-3.5" aria-hidden /> Disponível: /agendar/{slug}
      </span>
    );
  return (
    <span className="inline-flex items-center gap-1">
      <CircleAlert className="size-3.5" aria-hidden /> Letras minúsculas, números e hífens. Você pode mudar depois.
    </span>
  );
}

function ChoiceGrid({ label, children, cols = "sm:grid-cols-2" }: { label: string; children: ReactNode; cols?: string }) {
  return (
    <div role="radiogroup" aria-label={label} className={cn("grid grid-cols-1 gap-3", cols)}>
      {children}
    </div>
  );
}

function Choice({ selected, onSelect, label, description, icon: Icon }: { selected: boolean; onSelect: () => void; label: string; description?: string; icon?: LucideIcon }) {
  return (
    <button
      role="radio"
      aria-checked={selected}
      onClick={onSelect}
      className={cn(
        "flex min-h-14 items-center gap-3 rounded-md border bg-surface p-4 text-left transition-[border-color,box-shadow,background-color] duration-(--duration-fast)",
        selected ? "border-accent bg-accent-subtle shadow-[0_0_0_1px_var(--color-accent)]" : "border-line hover:border-line-strong hover:bg-canvas",
      )}
    >
      {Icon && (
        <span className={cn("grid size-10 shrink-0 place-items-center rounded-sm", selected ? "bg-accent text-on-accent" : "bg-muted text-ink-2")}>
          <Icon className="size-5" aria-hidden />
        </span>
      )}
      <span className="flex-1">
        <span className="block text-body font-medium">{label}</span>
        {description && <span className="mt-0.5 block text-body-sm text-ink-2">{description}</span>}
      </span>
      <span className={cn("grid size-5 shrink-0 place-items-center rounded-full border", selected ? "border-accent bg-accent text-on-accent" : "border-line-strong")} aria-hidden>
        {selected && <Check className="size-3" />}
      </span>
    </button>
  );
}

function Summary({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="rounded-md border border-line bg-surface p-4">
      <h2 className="mb-2 text-caption font-semibold tracking-wide text-ink-2 uppercase">{title}</h2>
      {children}
    </section>
  );
}

function Pill({ children, on }: { children: ReactNode; on?: boolean }) {
  return (
    <li className={cn("inline-flex h-8 items-center gap-1.5 rounded-full px-3", on ? "bg-success-subtle text-success" : "bg-muted text-ink-2")}>
      {on && <Check className="size-3.5" aria-hidden />}
      {children}
    </li>
  );
}
