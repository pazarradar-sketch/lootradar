-- Pazar Radar şeması. Ders (smarttravel): RLS ilk günden açık; plan otoritesi kullanıcı tarafından yazılamaz.
create extension if not exists pgcrypto;

create table if not exists public.profiles (
  id uuid primary key references auth.users(id) on delete cascade,
  email text,
  lang text default 'tr',
  currency text default 'TRY',
  telegram_chat_id bigint,
  telegram_link_code text,
  created_at timestamptz default now()
);
-- Plan: kullanıcı yalnızca OKUR; yazma service_role (ödeme geri çağrısı / admin).
create table if not exists public.subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  plan text not null default 'free' check (plan in ('free','pro')),
  valid_until timestamptz,
  source text,
  updated_at timestamptz default now()
);
create table if not exists public.alert_rules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ko','cs2')),
  target text not null,              -- KO: sunucu adı; CS2: market_hash_name
  field text not null,               -- ko: buy|sell ; cs2: csfloat|skinport|steam|bynogame
  op text not null check (op in ('>=','<=')),
  threshold numeric not null,        -- KO: TL ; CS2: USD
  channel text not null default 'telegram' check (channel in ('telegram','email')),
  active boolean not null default true,
  cooldown_min int not null default 360,
  last_fired_at timestamptz,
  last_value numeric,
  created_at timestamptz default now()
);
create table if not exists public.watchlist (
  user_id uuid not null references auth.users(id) on delete cascade,
  kind text not null check (kind in ('ko','cs2')),
  target text not null,
  created_at timestamptz default now(),
  primary key (user_id, kind, target)
);
create table if not exists public.alert_events (
  id bigserial primary key,
  rule_id uuid references public.alert_rules(id) on delete cascade,
  user_id uuid not null,
  fired_at timestamptz default now(),
  value numeric,
  message text,
  delivered boolean default false
);

-- Yeni kullanıcı → profil + free abonelik
create or replace function public.handle_new_user() returns trigger language plpgsql security definer set search_path = public as $$
begin
  insert into public.profiles (id, email) values (new.id, new.email) on conflict (id) do nothing;
  insert into public.subscriptions (user_id) values (new.id) on conflict (user_id) do nothing;
  return new;
end $$;
drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created after insert on auth.users for each row execute function public.handle_new_user();

-- Free plan: en fazla 2 aktif kural (sunucu tarafında zorlanır)
create or replace function public.enforce_rule_limit() returns trigger language plpgsql security definer set search_path = public as $$
declare n int; p text;
begin
  select coalesce(plan,'free') into p from public.subscriptions where user_id = new.user_id and (valid_until is null or valid_until > now());
  if p is null then p := 'free'; end if;
  if p = 'free' then
    select count(*) into n from public.alert_rules where user_id = new.user_id and active and id <> new.id;
    if n >= 2 and new.active then raise exception 'FREE_LIMIT: ücretsiz planda en fazla 2 aktif kural'; end if;
  end if;
  return new;
end $$;
drop trigger if exists alert_rules_limit on public.alert_rules;
create trigger alert_rules_limit before insert or update on public.alert_rules for each row execute function public.enforce_rule_limit();

-- RLS
alter table public.profiles enable row level security;
alter table public.subscriptions enable row level security;
alter table public.alert_rules enable row level security;
alter table public.watchlist enable row level security;
alter table public.alert_events enable row level security;

drop policy if exists "profiles self" on public.profiles;
create policy "profiles self" on public.profiles for select using (auth.uid() = id);
drop policy if exists "profiles self update" on public.profiles;
create policy "profiles self update" on public.profiles for update using (auth.uid() = id) with check (auth.uid() = id);
drop policy if exists "subs self read" on public.subscriptions;
create policy "subs self read" on public.subscriptions for select using (auth.uid() = user_id);
drop policy if exists "rules self" on public.alert_rules;
create policy "rules self" on public.alert_rules for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "watch self" on public.watchlist;
create policy "watch self" on public.watchlist for all using (auth.uid() = user_id) with check (auth.uid() = user_id);
drop policy if exists "events self read" on public.alert_events;
create policy "events self read" on public.alert_events for select using (auth.uid() = user_id);

-- telegram_chat_id ve link kodu yalnızca service_role tarafından yazılsın (kullanıcı güncellemesinde korunur)
create or replace function public.protect_profile_cols() returns trigger language plpgsql as $$
begin
  if current_setting('request.jwt.claim.role', true) is distinct from 'service_role' then
    new.telegram_chat_id := old.telegram_chat_id;
  end if;
  return new;
end $$;
drop trigger if exists profiles_protect on public.profiles;
create trigger profiles_protect before update on public.profiles for each row execute function public.protect_profile_cols();
