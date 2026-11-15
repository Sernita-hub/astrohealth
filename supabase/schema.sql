-- =========================================================================
-- AstroHealth · Supabase schema (reports to Earth)
-- Each browser signs in anonymously (no registration). Row Level Security
-- lets every crew device read, send and delete only its own reports.
-- Run this once in the Supabase SQL editor, then turn on
-- Authentication > Sign In / Providers > "Allow anonymous sign-ins".
-- SI notice: generated with Claude (Anthropic), a Super Intelligence (SI)
-- tool. See README, "Use of Super Intelligence (SI)".
-- =========================================================================

create table if not exists public.reports (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null default auth.uid() references auth.users (id) on delete cascade,
  client_id   text not null check (char_length(client_id) between 1 and 40),
  created_at  timestamptz not null default now(),   -- received by Mission Control
  onboard_at  timestamptz,                          -- generated on board
  astronaut   text check (char_length(astronaut) <= 60),
  mission     text check (char_length(mission) <= 60),
  environment text check (environment in ('iss', 'lunar', 'rover', 'transit', 'mars')),
  mission_day integer check (mission_day between 0 and 5000),
  delay_sec   numeric check (delay_sec between 0 and 3600),
  score       integer check (score between 0 and 100),
  level       text check (level in ('ok', 'watch', 'crit')),
  alert_count integer check (alert_count between 0 and 100),
  lang        text check (lang in ('en', 'es')),
  report      text not null check (char_length(report) <= 20000),
  unique (user_id, client_id)
);

create index if not exists reports_user_created_idx
  on public.reports (user_id, created_at desc);

-- Only signed-in crew devices (anonymous sessions included) reach the table
alter table public.reports enable row level security;
revoke all on public.reports from anon;
grant select, insert, delete on public.reports to authenticated;

drop policy if exists "Crew devices read their own reports" on public.reports;
create policy "Crew devices read their own reports" on public.reports
  for select to authenticated using ((select auth.uid()) = user_id);

drop policy if exists "Crew devices send their own reports" on public.reports;
create policy "Crew devices send their own reports" on public.reports
  for insert to authenticated with check ((select auth.uid()) = user_id);

drop policy if exists "Crew devices delete their own reports" on public.reports;
create policy "Crew devices delete their own reports" on public.reports
  for delete to authenticated using ((select auth.uid()) = user_id);

-- Keep the free database tidy: at most 200 stored reports per device
create or replace function public.reports_limit()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Runs with the caller's rights: RLS already limits the count to this device
  if (select count(*) from public.reports r where r.user_id = new.user_id) >= 200 then
    raise exception 'Report limit reached for this device' using errcode = 'P0001';
  end if;
  return new;
end;
$$;

drop trigger if exists reports_limit on public.reports;
create trigger reports_limit
  before insert on public.reports
  for each row execute function public.reports_limit();

-- Projects created with "Enable automatic RLS" get this helper function.
-- App users never need to call it (Supabase Security Advisor recommendation).
do $$
begin
  if to_regprocedure('public.rls_auto_enable()') is not null then
    revoke execute on function public.rls_auto_enable() from public, anon, authenticated;
  end if;
end;
$$;

-- Keep-alive: free Supabase projects are paused after about a week without activity.
-- A scheduled GitHub Action (.github/workflows/keep-supabase-active.yml) calls this
-- function twice a week, which runs a real query and keeps the database awake.
-- It reads no table and returns only the server time.
create or replace function public.keep_alive()
returns timestamptz
language sql
stable
security invoker
set search_path = ''
as $$ select now() $$;

revoke all on function public.keep_alive() from public;
grant execute on function public.keep_alive() to anon, authenticated;
