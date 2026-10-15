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
alter table public.rep_reviews enable row level security;
create policy "public can read REP wallets" on public.rep_wallets for select using (true);
create policy "public can read REP reviews" on public.rep_reviews for select using (true);
create policy "service role writes REP wallets" on public.rep_wallets for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
create policy "service role writes REP reviews" on public.rep_reviews for all using (auth.role() = 'service_role') with check (auth.role() = 'service_role');
