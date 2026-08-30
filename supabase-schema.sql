-- SmartClinic — esquema MULTI-CLÍNICA (cada clínica com seu próprio login e dados isolados)
-- Se você já rodou a versão anterior (single-tenant), este script começa apagando
-- aquelas tabelas antes de recriar tudo — não tem problema, ainda não existe dado real.
-- Como usar: Supabase > SQL Editor > New query > colar tudo > Run

drop table if exists appointment_contacts cascade;
drop table if exists appointments cascade;
drop table if exists patients cascade;
drop table if exists procedures cascade;
drop table if exists professionals cascade;
drop table if exists clinic_settings cascade;
drop table if exists clinics cascade;

create extension if not exists "pgcrypto";
create extension if not exists "unaccent";

-- ========== CLÍNICAS (uma linha por clínica, criada automaticamente no cadastro) ==========
create table clinics (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid references auth.users(id) not null unique,
  name text not null default 'Minha Clínica',
  slug text not null unique,          -- usado no link público: ?c=slug
  booking_link text,
  availability jsonb not null default '{
    "sun":{"enabled":false,"start":"09:00","end":"18:00"},
    "mon":{"enabled":true,"start":"09:00","end":"19:00"},
    "tue":{"enabled":true,"start":"09:00","end":"19:00"},
    "wed":{"enabled":true,"start":"09:00","end":"19:00"},
    "thu":{"enabled":true,"start":"09:00","end":"19:00"},
    "fri":{"enabled":true,"start":"09:00","end":"19:00"},
    "sat":{"enabled":true,"start":"09:00","end":"14:00"}
  }',
  campaign_messages jsonb not null default '{
    "retorno":"Olá {nome}! Faz um tempinho que você não vem aqui na {clinica} 💆 Que tal agendar um novo horário? Você pode marcar direto por aqui: {link}",
    "posprocedimento":"Oi {nome}! Passando pra saber como você está se sentindo depois do seu procedimento na {clinica}. Qualquer coisa, é só chamar! 💛",
    "aniversario":"Feliz aniversário, {nome}! 🎉 A equipe da {clinica} deseja tudo de bom pra você!",
    "confirmacao":"Olá {nome}! Passando para confirmar seu horário de {procedimento} no dia {data} às {hora} na {clinica}. Podemos confirmar? 😊"
  }',
  created_at timestamptz not null default now()
);

-- Cria a clínica automaticamente assim que alguém se cadastra (signUp)
create or replace function handle_new_clinic_signup()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  base_slug text;
  final_slug text;
  counter int := 0;
  clinic_name text;
begin
  clinic_name := coalesce(new.raw_user_meta_data->>'clinic_name', 'Minha Clínica');
  base_slug := lower(regexp_replace(unaccent(clinic_name), '[^a-zA-Z0-9]+', '-', 'g'));
  base_slug := trim(both '-' from base_slug);
  if base_slug = '' then base_slug := 'clinica'; end if;
  final_slug := base_slug;
  while exists(select 1 from clinics where slug = final_slug) loop
    counter := counter + 1;
    final_slug := base_slug || '-' || counter;
  end loop;
  insert into clinics (owner_id, name, slug) values (new.id, clinic_name, final_slug);
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function handle_new_clinic_signup();

-- ========== PROFISSIONAIS ==========
create table professionals (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) not null,
  name text not null,
  created_at timestamptz not null default now()
);

-- ========== PROCEDIMENTOS ==========
create table procedures (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) not null,
  name text not null,
  category text,
  duration int,
  price numeric,
  active boolean not null default true,
  created_at timestamptz not null default now()
);

-- ========== PACIENTES (dado sensível — só a própria clínica logada lê) ==========
create table patients (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) not null,
  name text not null,
  phone text not null,
  cpf text,
  birth_date date,
  sex text,
  profession text,
  health_plan text,
  cep text,
  address text,
  address_number text,
  neighborhood text,
  city text,
  uf text,
  referred_by text,
  source text default 'manual',
  created_at timestamptz not null default now()
);
create index patients_clinic_phone_idx on patients (clinic_id, phone);

-- ========== AGENDAMENTOS — parte pública (sem nome/telefone) ==========
create table appointments (
  id uuid primary key default gen_random_uuid(),
  clinic_id uuid references clinics(id) not null,
  procedure_id uuid references procedures(id),
  professional text,
  date date not null,
  start_time time not null,
  end_time time not null,
  status text not null default 'marcado',
  created_at timestamptz not null default now()
);
create index appointments_clinic_date_idx on appointments (clinic_id, date);

-- ========== DADOS DO PACIENTE NO AGENDAMENTO (privado) ==========
create table appointment_contacts (
  appointment_id uuid primary key references appointments(id) on delete cascade,
  patient_id uuid references patients(id),
  client_name text not null,
  client_phone text not null
);

-- ========== SEGURANÇA (RLS) ==========
alter table clinics enable row level security;
alter table professionals enable row level security;
alter table procedures enable row level security;
alter table patients enable row level security;
alter table appointments enable row level security;
alter table appointment_contacts enable row level security;

-- Leitura pública (necessária pra página de agendamento do cliente funcionar).
-- Importante: o app sempre filtra por clinic_id nas consultas; nesta fase de teste
-- não criamos uma trava extra no banco pra isso — dado exposto aqui é só o operacional
-- (nome de procedimento, horário ocupado), nunca nome/telefone de paciente.
create policy "public read clinics" on clinics for select using (true);
create policy "public read professionals" on professionals for select using (true);
create policy "public read procedures" on procedures for select using (true);
create policy "public read appointments" on appointments for select using (true);

create policy "public insert appointments" on appointments for insert with check (true);
create policy "public insert appointment_contacts" on appointment_contacts for insert with check (true);
create policy "public insert patients" on patients for insert with check (true);

-- Acesso total: só o dono logado, e só dos dados da própria clínica
create policy "owner full clinics" on clinics for all
  using (owner_id = auth.uid());

create policy "owner full professionals" on professionals for all
  using (clinic_id = (select id from clinics where owner_id = auth.uid()));

create policy "owner full procedures" on procedures for all
  using (clinic_id = (select id from clinics where owner_id = auth.uid()));

create policy "owner full patients" on patients for all
  using (clinic_id = (select id from clinics where owner_id = auth.uid()));

create policy "owner full appointments" on appointments for all
  using (clinic_id = (select id from clinics where owner_id = auth.uid()));

create policy "owner full appointment_contacts" on appointment_contacts for all
  using (appointment_id in (select id from appointments where clinic_id = (select id from clinics where owner_id = auth.uid())));
