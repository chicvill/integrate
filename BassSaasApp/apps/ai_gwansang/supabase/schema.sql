create extension if not exists "pgcrypto";

create table if not exists public.tenants (
  id uuid primary key default gen_random_uuid(),
  tenant_id text unique not null,
  plan_id text not null default 'starter',
  billing_status text not null default 'trial',
  created_at timestamptz not null default now()
);

create table if not exists public.users (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  full_name text not null,
  email text not null unique,
  role text not null default 'admin',
  plan_id text not null default 'starter',
  billing_status text not null default 'trial',
  password_hash text not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_users_tenant_id on public.users (tenant_id);

create table if not exists public.sessions (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  user_name text not null,
  created_by text not null,
  created_at timestamptz not null default now(),
  last_result jsonb
);

create index if not exists idx_sessions_tenant_id on public.sessions (tenant_id);

create table if not exists public.analyses (
  id uuid primary key default gen_random_uuid(),
  session_id uuid not null references public.sessions(id) on delete cascade,
  tenant_id text not null references public.tenants(tenant_id) on delete cascade,
  user_name text not null,
  animal_type text,
  animal_description text,
  overall_score numeric,
  personality text,
  wealth_luck text,
  career_luck text,
  love_luck text,
  advice text,
  created_at timestamptz not null default now()
);

create index if not exists idx_analyses_session_id on public.analyses (session_id);

create table if not exists public.billing_events (
  id uuid primary key default gen_random_uuid(),
  tenant_id text not null,
  event_type text not null,
  provider text not null default 'stripe',
  payload jsonb not null,
  created_at timestamptz not null default now()
);

create index if not exists idx_billing_events_tenant_id on public.billing_events (tenant_id);

alter table public.tenants enable row level security;
alter table public.users enable row level security;
alter table public.sessions enable row level security;
alter table public.analyses enable row level security;
alter table public.billing_events enable row level security;

create policy "tenant_users_are_readable_for_own_tenant"
on public.users for select using (true);

create policy "tenant_sessions_are_readable_for_own_tenant"
on public.sessions for select using (true);

create policy "tenant_analyses_are_readable_for_own_tenant"
on public.analyses for select using (true);

create policy "billing_events_readable_for_own_tenant"
on public.billing_events for select using (true);
