-- ═══════════════════════════════════════════════════════════════
-- Sondages, profils auteurs et fichiers audio
-- ═══════════════════════════════════════════════════════════════

-- ─── SONDAGES ─────────────────────────────────────────────────
-- option_id = "<sondage>::<option>" (identifiants calculés depuis les libellés)
create table public.votes (
  article_id uuid not null references public.articles (id) on delete cascade,
  option_id  text not null check (option_id ~ '^[a-z0-9-]{1,80}::[a-z0-9-]{1,80}$'),
  count      integer not null default 0 check (count >= 0),
  updated_at timestamptz not null default now(),
  primary key (article_id, option_id)
);

-- Reçus de vote anonymisés : un vote par votant et par sondage.
-- voter_hash = SHA-256(article, sondage, identifiant du votant) : ni IP ni
-- identifiant ne sont stockés en clair.
create table public.vote_receipts (
  article_id uuid not null references public.articles (id) on delete cascade,
  poll_key   text not null,
  voter_hash text not null,
  created_at timestamptz not null default now(),
  primary key (article_id, poll_key, voter_hash)
);

alter table public.votes enable row level security;
alter table public.vote_receipts enable row level security;

-- Lecture publique des résultats (articles publiés uniquement) ; aucune écriture directe
create policy votes_select_public on public.votes
  for select to anon, authenticated
  using (exists (
    select 1 from public.articles a
    where a.id = votes.article_id and a.published and a.published_at <= now()
  ));
-- vote_receipts : aucune politique, table inaccessible via l'API

-- Vote : protégé par fonction (article publié, format, limite, un vote par votant)
create or replace function public.cast_vote(p_article_id uuid, p_option_id text)
returns table (option_id text, count integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_poll text;
  v_headers json;
  v_voter text;
  v_hash text;
begin
  if p_option_id !~ '^[a-z0-9-]{1,80}::[a-z0-9-]{1,80}$' then
    raise exception 'invalid_option' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.published and a.published_at <= now()
  ) then
    raise exception 'article_not_found' using errcode = '22023';
  end if;
  v_poll := split_part(p_option_id, '::', 1);

  -- Garde-fou contre la création massive d'options
  if (select count(*) from public.votes v where v.article_id = p_article_id) >= 200
     and not exists (select 1 from public.votes v where v.article_id = p_article_id and v.option_id = p_option_id) then
    raise exception 'too_many_options' using errcode = '22023';
  end if;

  -- Votant : compte connecté, sinon IP + navigateur (en-têtes PostgREST)
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_voter := coalesce(
    (select auth.uid())::text,
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), '') || '|' || coalesce(v_headers ->> 'user-agent', ''),
    gen_random_uuid()::text
  );
  v_hash := encode(extensions.digest(p_article_id::text || '|' || v_poll || '|' || v_voter, 'sha256'), 'hex');

  insert into public.vote_receipts (article_id, poll_key, voter_hash)
  values (p_article_id, v_poll, v_hash)
  on conflict do nothing;

  -- Premier vote de ce votant pour ce sondage : on comptabilise
  if found then
    insert into public.votes (article_id, option_id, count)
    values (p_article_id, p_option_id, 1)
    on conflict on constraint votes_pkey
      do update set count = public.votes.count + 1, updated_at = now();
  end if;

  return query
    select v.option_id, v.count from public.votes v
    where v.article_id = p_article_id and v.option_id like v_poll || '::%';
end;
$$;

revoke execute on function public.cast_vote(uuid, text) from public;
grant execute on function public.cast_vote(uuid, text) to anon, authenticated;

-- ─── AUTEURS ──────────────────────────────────────────────────
create table public.authors (
  id         uuid primary key default gen_random_uuid(),
  name       text not null check (char_length(name) between 2 and 120),
  photo_url  text check (photo_url is null or photo_url ~ '^(https://|/)'),
  bio        text check (char_length(bio) <= 400),
  specialty  text check (char_length(specialty) <= 120),
  email      text check (email is null or (email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create trigger authors_updated_at
  before update on public.authors
  for each row execute function public.set_updated_at();

alter table public.authors enable row level security;

create policy authors_select_all on public.authors
  for select to anon, authenticated using (true);
create policy authors_insert_staff on public.authors
  for insert to authenticated with check ((select public.is_staff()));
create policy authors_update_staff on public.authors
  for update to authenticated
  using ((select public.is_staff())) with check ((select public.is_staff()));
create policy authors_delete_admin on public.authors
  for delete to authenticated using ((select public.is_admin()));

-- L'email reste privé : jamais lisible via l'API (privilège de colonne)
revoke select on public.authors from anon, authenticated;
grant select (id, name, photo_url, bio, specialty, created_at, updated_at) on public.authors to anon, authenticated;

-- Liste complète (avec email) réservée à l'équipe éditoriale
create or replace function public.admin_list_authors()
returns setof public.authors
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.authors a order by a.name;
end;
$$;

revoke execute on function public.admin_list_authors() from public, anon;
grant execute on function public.admin_list_authors() to authenticated;

-- Auteur signataire de l'article
alter table public.articles
  add column author_profile_id uuid references public.authors (id) on delete set null;
create index articles_author_profile_idx on public.articles (author_profile_id);
grant select (author_profile_id) on public.articles to anon, authenticated;

-- ─── AUDIO ────────────────────────────────────────────────────
update storage.buckets
   set allowed_mime_types = array[
     'image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif',
     'video/mp4', 'video/webm',
     'audio/mpeg', 'audio/mp4', 'audio/x-m4a', 'audio/aac', 'audio/ogg', 'audio/wav', 'audio/webm'
   ]
 where id = 'article-media';
