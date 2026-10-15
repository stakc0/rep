create table if not exists public.rep_wallets (
  wallet text primary key,
  display_name text,
  score integer not null default 0 check (score between 0 and 100),
  grade text not null default 'C',
  indicators jsonb not null default '{}'::jsonb,
  last_balance_sol numeric,
  last_seen_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

alter table public.rep_wallets add column if not exists performance jsonb;
alter table public.rep_wallets add column if not exists transactions jsonb not null default '[]'::jsonb;
alter table public.rep_wallets add column if not exists profile jsonb not null default '{}'::jsonb;
alter table public.rep_wallets add column if not exists display_name text;
alter table public.rep_wallets add column if not exists avatar_url text;
alter table public.rep_wallets add column if not exists kolscan_profit numeric;

create table if not exists public.rep_profiles (
  wallet text primary key references public.rep_wallets(wallet) on delete cascade,
  x_handle text,
  display_name text,
  bio text,
  avatar_url text,
  verified_x boolean not null default false,
  updated_at timestamptz not null default now()
);

create table if not exists public.rep_wallet_transactions (
  wallet text not null references public.rep_wallets(wallet) on delete cascade,
  signature text not null,
  payload jsonb not null default '{}'::jsonb,
  observed_at timestamptz not null default now(),
  primary key (wallet, signature)
);

create index if not exists rep_wallet_transactions_observed_idx on public.rep_wallet_transactions(wallet, observed_at desc);

create table if not exists public.rep_score_events (
  id bigint generated always as identity primary key,
  wallet text not null references public.rep_wallets(wallet) on delete cascade,
  score integer not null,
  grade text not null,
  indicators jsonb not null default '{}'::jsonb,
  reason text not null default 'index_refresh',
  created_at timestamptz not null default now()
);
create index if not exists rep_score_events_wallet_created_idx on public.rep_score_events(wallet, created_at desc);

create table if not exists public.rep_reviews (
  id bigint generated always as identity primary key,
  wallet text not null references public.rep_wallets(wallet) on delete cascade,
  author_wallet text,
  category text not null default 'observation',
  text text not null check (char_length(text) between 12 and 1200),
  evidence_url text,
  created_at timestamptz not null default now()
);

create index if not exists rep_reviews_wallet_created_idx on public.rep_reviews(wallet, created_at desc);
alter table public.rep_wallets enable row level security;
alter table public.rep_profiles enable row level security;
alter table public.rep_wallet_transactions enable row level security;
alter table public.rep_score_events enable row level security;
alter table public.rep_reviews enable row level security;
create policy "public can read REP profiles" on public.rep_profiles for select using (true);
create policy "public can read REP transactions" on public.rep_wallet_transactions for select using (true);
create policy "public can read REP score events" on public.rep_score_events for select using (true);
create policy "public can read REP wallets" on public.rep_wallets for select using (true);
create policy "public can read REP reviews" on public.rep_reviews for select using (true);
create policy "service role writes REP wallets" on public.rep_wallets for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role writes REP profiles" on public.rep_profiles for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role writes REP transactions" on public.rep_wallet_transactions for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role writes REP score events" on public.rep_score_events for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role writes REP reviews" on public.rep_reviews for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
