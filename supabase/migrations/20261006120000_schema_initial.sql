-- ═══════════════════════════════════════════════════════════════
-- VITALYA — Schéma initial
-- Tables, contraintes, index, triggers, fonctions et RLS.
-- Principe : RLS activée partout, deny-by-default, écritures
-- sensibles (abonnements, rôles) réservées au service role.
-- ═══════════════════════════════════════════════════════════════

-- ─── Utilitaire : updated_at automatique ──────────────────────
create or replace function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at = now();
  return new;
end;
$$;

-- ─── PROFILES ─────────────────────────────────────────────────
create table public.profiles (
  id                uuid primary key references auth.users (id) on delete cascade,
  email             text not null,
  full_name         text check (char_length(full_name) <= 120),
  avatar_url        text check (avatar_url is null or avatar_url ~ '^https://'),
  subscription_tier text not null default 'free'
                      check (subscription_tier in ('free', 'premium', 'expert')),
  role              text not null default 'reader'
                      check (role in ('reader', 'editor', 'admin')),
  created_at        timestamptz not null default now(),
  updated_at        timestamptz not null default now()
);

create trigger profiles_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- ─── Liste blanche des administrateurs (lue uniquement par le trigger) ──
create table public.admin_allowlist (
  email      text primary key check (email = lower(email)),
  created_at timestamptz not null default now()
);

-- ─── CATEGORIES ───────────────────────────────────────────────
create table public.categories (
  id          uuid primary key default gen_random_uuid(),
  name        text not null unique check (char_length(name) between 2 and 80),
  slug        text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  description text check (char_length(description) <= 500),
  color       text not null default '#0D6B4A' check (color ~ '^#[0-9A-Fa-f]{6}$'),
  position    smallint not null default 0,
  created_at  timestamptz not null default now()
);

-- ─── ARTICLES ─────────────────────────────────────────────────
create table public.articles (
  id           uuid primary key default gen_random_uuid(),
  title        text not null check (char_length(title) between 3 and 200),
  subtitle     text check (char_length(subtitle) <= 400),
  slug         text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  content      text not null default '' check (char_length(content) <= 200000),
  cover_image  text check (cover_image is null or cover_image ~ '^(https://|/)'),
  category     uuid references public.categories (id) on delete set null,
  access_level text not null default 'free'
                 check (access_level in ('free', 'premium', 'expert')),
  published    boolean not null default false,
  published_at timestamptz,
  author_id    uuid references public.profiles (id) on delete set null,
  reading_time smallint not null default 1 check (reading_time between 1 and 300),
  view_count   integer not null default 0,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  -- Un article publié doit avoir une date de publication
  constraint articles_published_date check (not published or published_at is not null)
);

create index articles_category_idx on public.articles (category);
create index articles_author_idx on public.articles (author_id);
create index articles_published_idx on public.articles (published_at desc) where published;

create trigger articles_updated_at
  before update on public.articles
  for each row execute function public.set_updated_at();

-- ─── SUBSCRIPTIONS (écrites uniquement par le webhook Stripe / service role) ──
create table public.subscriptions (
  id                     uuid primary key default gen_random_uuid(),
  user_id                uuid not null references public.profiles (id) on delete cascade,
  tier                   text not null check (tier in ('premium', 'expert')),
  status                 text not null default 'incomplete'
                           check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid')),
  stripe_customer_id     text,
  stripe_subscription_id text unique,
  current_period_end     timestamptz,
  created_at             timestamptz not null default now(),
  updated_at             timestamptz not null default now()
);

create index subscriptions_user_idx on public.subscriptions (user_id);

create trigger subscriptions_updated_at
  before update on public.subscriptions
  for each row execute function public.set_updated_at();

-- ─── NEWSLETTERS (historique des envois) ──────────────────────
create table public.newsletters (
  id               uuid primary key default gen_random_uuid(),
  subject          text not null check (char_length(subject) between 3 and 200),
  content          text not null check (char_length(content) <= 100000),
  sent_at          timestamptz,
  recipients_count integer not null default 0,
  created_by       uuid references public.profiles (id) on delete set null,
  created_at       timestamptz not null default now()
);

create index newsletters_created_by_idx on public.newsletters (created_by);

-- ─── NEWSLETTER_SUBSCRIBERS (abonnés à la lettre d'information) ──
create table public.newsletter_subscribers (
  id                uuid primary key default gen_random_uuid(),
  email             text not null unique
                      check (email = lower(email) and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' and char_length(email) <= 254),
  unsubscribe_token uuid not null unique default gen_random_uuid(),
  unsubscribed_at   timestamptz,
  created_at        timestamptz not null default now()
);

-- ─── COMMENTS ─────────────────────────────────────────────────
create table public.comments (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  content    text not null check (char_length(btrim(content)) between 2 and 2000),
  created_at timestamptz not null default now()
);

create index comments_article_idx on public.comments (article_id, created_at desc);
create index comments_user_idx on public.comments (user_id);

-- ─── LIKES ────────────────────────────────────────────────────
create table public.likes (
  id         uuid primary key default gen_random_uuid(),
  article_id uuid not null references public.articles (id) on delete cascade,
  user_id    uuid not null references public.profiles (id) on delete cascade,
  created_at timestamptz not null default now(),
  unique (article_id, user_id)
);

create index likes_user_idx on public.likes (user_id);

-- ─── PUSH_SUBSCRIPTIONS (notifications push — préparées) ──────
create table public.push_subscriptions (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references public.profiles (id) on delete cascade,
  endpoint   text not null unique check (endpoint ~ '^https://'),
  p256dh     text not null,
  auth       text not null,
  created_at timestamptz not null default now()
);

create index push_subscriptions_user_idx on public.push_subscriptions (user_id);

-- ═══════════════════════════════════════════════════════════════
-- FONCTIONS D'AUTORISATION
-- SECURITY DEFINER + search_path vide pour éviter les détournements.
-- ═══════════════════════════════════════════════════════════════

-- L'utilisateur courant est-il administrateur / éditeur ?
create or replace function public.is_staff()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role in ('admin', 'editor')
  );
$$;

create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles p
    where p.id = (select auth.uid()) and p.role = 'admin'
  );
$$;

-- Rang d'un niveau d'accès (free < premium < expert)
create or replace function public.tier_rank(tier text)
returns smallint
language sql
immutable
set search_path = ''
as $$
  select case tier when 'expert' then 2 when 'premium' then 1 else 0 end::smallint;
$$;

-- Création automatique du profil à l'inscription
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text := lower(coalesce(new.email, ''));
begin
  insert into public.profiles (id, email, full_name, avatar_url, role)
  values (
    new.id,
    v_email,
    left(coalesce(new.raw_user_meta_data ->> 'full_name', split_part(v_email, '@', 1)), 120),
    case when (new.raw_user_meta_data ->> 'avatar_url') ~ '^https://'
         then new.raw_user_meta_data ->> 'avatar_url' end,
    case when exists (select 1 from public.admin_allowlist a where a.email = v_email)
         then 'admin' else 'reader' end
  );
  return new;
end;
$$;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- ═══════════════════════════════════════════════════════════════
-- ROW LEVEL SECURITY
-- ═══════════════════════════════════════════════════════════════
alter table public.profiles               enable row level security;
alter table public.admin_allowlist        enable row level security;
alter table public.categories             enable row level security;
alter table public.articles               enable row level security;
alter table public.subscriptions          enable row level security;
alter table public.newsletters            enable row level security;
alter table public.newsletter_subscribers enable row level security;
alter table public.comments               enable row level security;
alter table public.likes                  enable row level security;
alter table public.push_subscriptions     enable row level security;

-- admin_allowlist : aucune politique → inaccessible via l'API.

-- ─── profiles ─────────────────────────────────────────────────
create policy profiles_select_self_or_staff on public.profiles
  for select to authenticated
  using (id = (select auth.uid()) or (select public.is_staff()));

create policy profiles_update_self on public.profiles
  for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- Un lecteur ne peut modifier QUE son nom et son avatar (privilèges de colonnes).
revoke update on public.profiles from anon, authenticated;
grant update (full_name, avatar_url) on public.profiles to authenticated;

-- ─── categories ───────────────────────────────────────────────
create policy categories_select_all on public.categories
  for select to anon, authenticated using (true);

create policy categories_write_staff on public.categories
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ─── articles ─────────────────────────────────────────────────
-- Les métadonnées des articles publiés sont publiques ; le contenu
-- est protégé par privilège de colonne (voir get_article_body).
create policy articles_select_published on public.articles
  for select to anon, authenticated
  using ((published and published_at <= now()) or (select public.is_staff()));

create policy articles_insert_staff on public.articles
  for insert to authenticated
  with check ((select public.is_staff()));

create policy articles_update_staff on public.articles
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy articles_delete_admin on public.articles
  for delete to authenticated
  using ((select public.is_admin()));

-- Le contenu n'est jamais lisible directement : seule la fonction
-- get_article_body (paywall côté base) ou get_article_for_edit le renvoie.
revoke select on public.articles from anon, authenticated;
grant select (id, title, subtitle, slug, cover_image, category, access_level,
              published, published_at, author_id, reading_time, view_count,
              created_at, updated_at)
  on public.articles to anon, authenticated;

-- ─── subscriptions (lecture seule côté client) ───────────────
create policy subscriptions_select_own on public.subscriptions
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_admin()));

-- ─── newsletters (staff uniquement) ──────────────────────────
create policy newsletters_all_staff on public.newsletters
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

-- ─── newsletter_subscribers (lecture staff ; inscription via fonction) ──
create policy newsletter_subscribers_select_staff on public.newsletter_subscribers
  for select to authenticated
  using ((select public.is_staff()));

create policy newsletter_subscribers_delete_admin on public.newsletter_subscribers
  for delete to authenticated
  using ((select public.is_admin()));

-- ─── comments ─────────────────────────────────────────────────
create policy comments_select_published on public.comments
  for select to anon, authenticated
  using (exists (
    select 1 from public.articles a
    where a.id = comments.article_id and a.published and a.published_at <= now()
  ));

create policy comments_insert_own on public.comments
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    and exists (
      select 1 from public.articles a
      where a.id = article_id and a.published and a.published_at <= now()
    )
  );

create policy comments_delete_own_or_staff on public.comments
  for delete to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

-- ─── likes ────────────────────────────────────────────────────
create policy likes_select_own on public.likes
  for select to authenticated
  using (user_id = (select auth.uid()) or (select public.is_staff()));

create policy likes_insert_own on public.likes
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy likes_delete_own on public.likes
  for delete to authenticated
  using (user_id = (select auth.uid()));

-- ─── push_subscriptions ──────────────────────────────────────
create policy push_subscriptions_own on public.push_subscriptions
  for all to authenticated
  using (user_id = (select auth.uid()))
  with check (user_id = (select auth.uid()));

-- ═══════════════════════════════════════════════════════════════
-- FONCTIONS PUBLIQUES (RPC)
-- ═══════════════════════════════════════════════════════════════

-- Paywall : renvoie le contenu complet si l'utilisateur y a droit,
-- sinon un aperçu (3 premiers paragraphes) et has_access = false.
create or replace function public.get_article_body(p_slug text)
returns table (content text, has_access boolean)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_article public.articles%rowtype;
  v_user_rank smallint := 0;
  v_staff boolean := false;
begin
  select * into v_article from public.articles a where a.slug = p_slug;
  if not found then
    return;
  end if;

  select public.tier_rank(p.subscription_tier), p.role in ('admin', 'editor')
    into v_user_rank, v_staff
    from public.profiles p where p.id = (select auth.uid());

  v_user_rank := coalesce(v_user_rank, 0);
  v_staff := coalesce(v_staff, false);

  -- Article non publié : visible uniquement par l'équipe éditoriale
  if not (v_article.published and v_article.published_at <= now()) and not v_staff then
    return;
  end if;

  if v_staff or v_user_rank >= public.tier_rank(v_article.access_level) then
    return query select v_article.content, true;
  else
    return query select
      array_to_string((string_to_array(v_article.content, E'\n\n'))[1:3], E'\n\n'),
      false;
  end if;
end;
$$;

-- Lecture complète pour l'édition (staff uniquement)
create or replace function public.get_article_for_edit(p_id uuid)
returns setof public.articles
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  return query select * from public.articles a where a.id = p_id;
end;
$$;

-- Statistiques publiques d'un article (sans exposer les identités)
create or replace function public.get_article_stats(p_article_id uuid)
returns table (likes_count bigint, comments_count bigint, liked_by_me boolean)
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select count(*) from public.likes l where l.article_id = p_article_id),
    (select count(*) from public.comments c where c.article_id = p_article_id),
    exists (select 1 from public.likes l
            where l.article_id = p_article_id and l.user_id = (select auth.uid()));
$$;

-- Commentaires avec nom d'auteur (sans exposer l'email)
create or replace function public.get_article_comments(p_article_id uuid)
returns table (id uuid, content text, created_at timestamptz, user_id uuid,
               author_name text, author_avatar text)
language sql
stable
security definer
set search_path = ''
as $$
  select c.id, c.content, c.created_at, c.user_id,
         coalesce(nullif(p.full_name, ''), 'Lecteur Vitalya'), p.avatar_url
  from public.comments c
  join public.profiles p on p.id = c.user_id
  join public.articles a on a.id = c.article_id
  where c.article_id = p_article_id
    and a.published and a.published_at <= now()
  order by c.created_at desc
  limit 200;
$$;

-- Incrément du compteur de vues (articles publiés uniquement)
create or replace function public.increment_article_view(p_slug text)
returns void
language sql
volatile
security definer
set search_path = ''
as $$
  update public.articles
     set view_count = view_count + 1
   where slug = p_slug and published and published_at <= now();
$$;

-- Inscription newsletter (idempotente, ne révèle pas si l'email existe)
create or replace function public.subscribe_newsletter(p_email text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_email text := lower(btrim(p_email));
begin
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' or char_length(v_email) > 254 then
    raise exception 'invalid_email' using errcode = '22023';
  end if;
  insert into public.newsletter_subscribers (email)
  values (v_email)
  on conflict (email) do update set unsubscribed_at = null;
end;
$$;

-- Désinscription via jeton unique (lien dans chaque email)
create or replace function public.unsubscribe_newsletter(p_token uuid)
returns boolean
language sql
volatile
security definer
set search_path = ''
as $$
  with u as (
    update public.newsletter_subscribers
       set unsubscribed_at = now()
     where unsubscribe_token = p_token and unsubscribed_at is null
    returning 1
  )
  select exists (select 1 from u);
$$;

-- Gestion des abonnés par un administrateur (rôle et niveau d'accès)
create or replace function public.admin_set_profile(p_user_id uuid, p_role text, p_tier text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not public.is_admin() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_role not in ('reader', 'editor', 'admin') or p_tier not in ('free', 'premium', 'expert') then
    raise exception 'invalid_value' using errcode = '22023';
  end if;
  -- Un administrateur ne peut pas se rétrograder lui-même (évite de perdre l'accès)
  if p_user_id = (select auth.uid()) and p_role <> 'admin' then
    raise exception 'cannot_demote_self' using errcode = '42501';
  end if;
  update public.profiles
     set role = p_role, subscription_tier = p_tier
   where id = p_user_id;
end;
$$;

-- Restreindre l'exécution des fonctions (par défaut PUBLIC peut tout exécuter)
revoke execute on all functions in schema public from public, anon, authenticated;

grant execute on function public.get_article_body(text)          to anon, authenticated;
grant execute on function public.get_article_stats(uuid)         to anon, authenticated;
grant execute on function public.get_article_comments(uuid)      to anon, authenticated;
grant execute on function public.increment_article_view(text)    to anon, authenticated;
grant execute on function public.subscribe_newsletter(text)      to anon, authenticated;
grant execute on function public.unsubscribe_newsletter(uuid)    to anon, authenticated;
grant execute on function public.get_article_for_edit(uuid)      to authenticated;
grant execute on function public.admin_set_profile(uuid, text, text) to authenticated;
grant execute on function public.is_staff()                      to anon, authenticated;
grant execute on function public.is_admin()                      to anon, authenticated;
grant execute on function public.tier_rank(text)                 to anon, authenticated;

-- ═══════════════════════════════════════════════════════════════
-- STORAGE — bucket des couvertures (lecture publique justifiée :
-- les couvertures sont affichées publiquement ; écriture staff).
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('covers', 'covers', true, 5242880,
        array['image/jpeg', 'image/png', 'image/webp', 'image/avif'])
on conflict (id) do nothing;

create policy covers_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'covers' and (select public.is_staff()));

create policy covers_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'covers' and (select public.is_staff()))
  with check (bucket_id = 'covers' and (select public.is_staff()));

create policy covers_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'covers' and (select public.is_staff()));

-- ═══════════════════════════════════════════════════════════════
-- REALTIME — commentaires en direct
-- ═══════════════════════════════════════════════════════════════
alter publication supabase_realtime add table public.comments;
