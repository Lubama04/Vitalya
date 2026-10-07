-- ═══════════════════════════════════════════════════════════════
-- Lecteur configurable : mode préféré et position de lecture
-- ═══════════════════════════════════════════════════════════════

-- Mode de lecture préféré (défilement ou livre)
alter table public.profiles
  add column if not exists reading_mode text not null default 'scroll'
    check (reading_mode in ('scroll', 'book'));

-- Le lecteur peut modifier ce réglage (en plus de son nom et de son avatar)
grant update (reading_mode) on public.profiles to authenticated;

-- Dernière position de lecture par lecteur et par article
create table if not exists public.reading_positions (
  user_id    uuid not null references public.profiles (id) on delete cascade,
  article_id uuid not null references public.articles (id) on delete cascade,
  progress   real not null default 0 check (progress >= 0 and progress <= 1),
  page       smallint check (page is null or page >= 0),
  mode       text not null default 'scroll' check (mode in ('scroll', 'book')),
  updated_at timestamptz not null default now(),
  primary key (user_id, article_id)
);

create index if not exists reading_positions_article_idx on public.reading_positions (article_id);

alter table public.reading_positions enable row level security;

create policy reading_positions_select_own on public.reading_positions
  for select to authenticated
  using (user_id = (select auth.uid()));

create policy reading_positions_insert_own on public.reading_positions
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy reading_positions_update_own on public.reading_positions
  for update to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

create policy reading_positions_delete_own on public.reading_positions
  for delete to authenticated
  using (user_id = (select auth.uid()));

create trigger reading_positions_updated_at
  before update on public.reading_positions
  for each row execute function public.set_updated_at();
