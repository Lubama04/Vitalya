-- ═══════════════════════════════════════════════════════════════
-- Paiements mobile money (PawaPay, MoneyFusion) et notifications email
-- Principe : aucune écriture sensible depuis le navigateur.
--  - create_payment       : le lecteur connecté ouvre un paiement « incomplete »
--  - confirm_payment      : réservé au serveur (secret partagé), après
--                           vérification du statut auprès du prestataire
--  - current_tier()       : niveau effectif = profil OU abonnement actif non expiré
-- ═══════════════════════════════════════════════════════════════

-- ─── Secrets applicatifs (empreintes uniquement, jamais lisibles via l'API) ───
create table if not exists public.app_secrets (
  name       text primary key,
  sha256_hex text not null check (sha256_hex ~ '^[0-9a-f]{64}$'),
  created_at timestamptz not null default now()
);
alter table public.app_secrets enable row level security;
-- Aucune politique : table inaccessible via l'API.

-- ─── Abonnements : prestataires de paiement ───
alter table public.subscriptions
  add column if not exists payment_provider text not null default 'stripe'
    check (payment_provider in ('stripe', 'pawapay', 'moneyfusion', 'manual')),
  add column if not exists pawapay_checkout_id uuid unique,
  add column if not exists moneyfusion_token text unique check (char_length(moneyfusion_token) <= 200),
  add column if not exists amount integer check (amount > 0),
  add column if not exists currency text check (currency ~ '^[A-Z]{3}$'),
  add column if not exists country text check (country ~ '^[A-Z]{3}$'),
  add column if not exists operator text check (char_length(operator) <= 40),
  add column if not exists paid_at timestamptz,
  add column if not exists confirmation_sent_at timestamptz;

alter table public.subscriptions drop constraint if exists subscriptions_status_check;
alter table public.subscriptions add constraint subscriptions_status_check
  check (status in ('incomplete', 'trialing', 'active', 'past_due', 'canceled', 'unpaid', 'failed', 'expired'));

create index if not exists subscriptions_active_idx
  on public.subscriptions (user_id, current_period_end) where status = 'active';

-- Tarifs mensuels en francs CFA (XAF et XOF : même parité, 5 € ≈ 3 280 F, 10 € ≈ 6 560 F)
create or replace function public.subscription_price(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier when 'premium' then 3300 when 'expert' then 6600 end;
$$;

-- ─── Niveau d'accès effectif du lecteur connecté ───
create or replace function public.current_tier()
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case greatest(
           coalesce((select public.tier_rank(p.subscription_tier) from public.profiles p where p.id = (select auth.uid())), 0),
           coalesce((select max(public.tier_rank(s.tier)) from public.subscriptions s
                     where s.user_id = (select auth.uid()) and s.status = 'active'
                       and (s.current_period_end is null or s.current_period_end > now())), 0)
         )
         when 2 then 'expert' when 1 then 'premium' else 'free' end;
$$;

-- Paywall : utilise désormais le niveau effectif (abonnement mobile money inclus)
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

  select coalesce(p.role in ('admin', 'editor'), false)
    into v_staff
    from public.profiles p where p.id = (select auth.uid());
  v_staff := coalesce(v_staff, false);
  v_user_rank := public.tier_rank(public.current_tier());

  if not (v_article.published and v_article.published_at <= now()) and not v_staff then
    return;
  end if;

  if v_staff or v_user_rank >= public.tier_rank(v_article.access_level) then
    return query select v_article.content, true;
  else
    return query select
      array_to_string(
        (regexp_split_to_array(btrim(v_article.content, E' \t\r\n'), E'(\r\n|\r|\n)[ \t]*(\r\n|\r|\n)\\s*'))[1:3],
        E'\n\n'
      ),
      false;
  end if;
end;
$$;

-- ─── Ouverture d'un paiement par le lecteur connecté ───
create or replace function public.create_payment(
  p_tier text, p_provider text, p_currency text, p_country text, p_operator text
)
returns table (payment_id uuid, amount integer)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_user uuid := (select auth.uid());
  v_amount integer := public.subscription_price(p_tier);
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_amount is null or p_provider not in ('pawapay', 'moneyfusion') or p_currency not in ('XAF', 'XOF') then
    raise exception 'invalid_payment' using errcode = '22023';
  end if;
  -- Limite anti-abus : 10 paiements ouverts par heure et par lecteur
  if (select count(*) from public.subscriptions s
      where s.user_id = v_user and s.created_at > now() - interval '1 hour') >= 10 then
    raise exception 'too_many_payments' using errcode = '22023';
  end if;

  insert into public.subscriptions (id, user_id, tier, status, payment_provider, pawapay_checkout_id, amount, currency, country, operator)
  values (v_id, v_user, p_tier, 'incomplete', p_provider,
          case when p_provider = 'pawapay' then v_id end,
          v_amount, p_currency, nullif(p_country, ''), nullif(p_operator, ''));

  return query select v_id, v_amount;
end;
$$;

-- Rattache le jeton MoneyFusion au paiement (propriétaire, paiement encore ouvert)
create or replace function public.attach_moneyfusion_token(p_payment_id uuid, p_token text)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if p_token !~ '^[A-Za-z0-9_-]{6,200}$' then
    raise exception 'invalid_token' using errcode = '22023';
  end if;
  update public.subscriptions
     set moneyfusion_token = p_token
   where id = p_payment_id and user_id = (select auth.uid())
     and payment_provider = 'moneyfusion' and status = 'incomplete' and moneyfusion_token is null;
  if not found then
    raise exception 'payment_not_found' using errcode = '22023';
  end if;
end;
$$;

-- ─── Confirmation (serveur uniquement, après vérification auprès du prestataire) ───
create or replace function public.confirm_payment(
  p_secret text, p_provider text, p_reference text, p_status text, p_paid_amount integer
)
returns table (payment_id uuid, user_email text, user_name text, tier text, period_end timestamptz, newly_activated boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_start timestamptz;
  v_end timestamptz;
  v_new boolean := false;
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.name = 'payment_webhook'
      and s.sha256_hex = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  select * into v_sub from public.subscriptions s
   where (p_provider = 'pawapay' and s.pawapay_checkout_id::text = p_reference)
      or (p_provider = 'moneyfusion' and s.moneyfusion_token = p_reference)
   for update;
  if not found then
    raise exception 'payment_not_found' using errcode = '22023';
  end if;

  if p_status = 'paid' then
    if v_sub.status = 'incomplete' then
      if coalesce(p_paid_amount, 0) < v_sub.amount then
        raise exception 'amount_mismatch' using errcode = '22023';
      end if;
      -- Prolonge à partir de la fin de l'abonnement actif le plus lointain
      select greatest(now(), coalesce(max(s.current_period_end), now())) into v_start
        from public.subscriptions s
       where s.user_id = v_sub.user_id and s.status = 'active' and s.current_period_end > now();
      v_end := v_start + interval '30 days';
      update public.subscriptions
         set status = 'active', paid_at = now(), current_period_end = v_end
       where id = v_sub.id;
      v_new := true;
    end if;
  elsif p_status = 'failed' and v_sub.status = 'incomplete' then
    update public.subscriptions set status = 'failed' where id = v_sub.id;
  end if;

  return query
    select s.id, p.email, p.full_name, s.tier, s.current_period_end, v_new
      from public.subscriptions s join public.profiles p on p.id = s.user_id
     where s.id = v_sub.id;
end;
$$;

-- Marque l'email de confirmation comme envoyé (évite les doublons)
create or replace function public.mark_payment_email_sent(p_secret text, p_payment_id uuid)
returns void
language plpgsql
volatile
security definer
set search_path = ''
as $$
begin
  if not exists (
    select 1 from public.app_secrets s
    where s.name = 'payment_webhook'
      and s.sha256_hex = encode(extensions.digest(coalesce(p_secret, ''), 'sha256'), 'hex')
  ) then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  update public.subscriptions set confirmation_sent_at = now()
   where id = p_payment_id and confirmation_sent_at is null;
end;
$$;

revoke execute on function public.subscription_price(text) from public;
revoke execute on function public.current_tier() from public;
revoke execute on function public.create_payment(text, text, text, text, text) from public, anon;
revoke execute on function public.attach_moneyfusion_token(uuid, text) from public, anon;
revoke execute on function public.confirm_payment(text, text, text, text, integer) from public;
revoke execute on function public.mark_payment_email_sent(text, uuid) from public;
grant execute on function public.subscription_price(text) to anon, authenticated;
grant execute on function public.current_tier() to anon, authenticated;
grant execute on function public.create_payment(text, text, text, text, text) to authenticated;
grant execute on function public.attach_moneyfusion_token(uuid, text) to authenticated;
-- Le serveur appelle sans session : le secret partagé fait office d'authentification
grant execute on function public.confirm_payment(text, text, text, text, integer) to anon, authenticated;
grant execute on function public.mark_payment_email_sent(text, uuid) to anon, authenticated;

-- ─── Notifications email ───
-- Le lecteur choisit de recevoir un email à chaque nouvel article
alter table public.profiles
  add column if not exists notify_new_articles boolean not null default false;
grant update (notify_new_articles) on public.profiles to authenticated;

-- Article déjà annoncé par email (pas de second envoi)
alter table public.articles add column if not exists notified_at timestamptz;
grant select (notified_at) on public.articles to authenticated;
