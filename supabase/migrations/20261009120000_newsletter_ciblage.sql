-- ═══════════════════════════════════════════════════════════════
-- Newsletter : ciblage par niveau d'abonnement et notifications
-- de nouveaux articles. Fonctions réservées à l'équipe (staff).
-- ═══════════════════════════════════════════════════════════════

-- Audience de chaque envoi (historique)
alter table public.newsletters
  add column if not exists audience text not null default 'tous'
    check (audience in ('tous', 'gratuits', 'premium', 'expert'));

-- Niveau effectif d'un membre (profil OU abonnement actif non expiré)
create or replace function public.user_tier(p_user uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select case greatest(
           coalesce((select public.tier_rank(p.subscription_tier) from public.profiles p where p.id = p_user), 0),
           coalesce((select max(public.tier_rank(s.tier)) from public.subscriptions s
                     where s.user_id = p_user and s.status = 'active'
                       and (s.current_period_end is null or s.current_period_end > now())), 0)
         )
         when 2 then 'expert' when 1 then 'premium' else 'free' end;
$$;

-- Destinataires d'une newsletter : uniquement les inscrits actifs (consentement),
-- filtrés par le niveau du compte associé à leur adresse.
-- « gratuits » inclut les inscrits sans compte.
create or replace function public.newsletter_recipients(p_audience text)
returns table (email text, unsubscribe_token uuid)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;
  if p_audience not in ('tous', 'gratuits', 'premium', 'expert') then
    raise exception 'invalid_audience' using errcode = '22023';
  end if;

  return query
    select s.email, s.unsubscribe_token
    from public.newsletter_subscribers s
    left join public.profiles p on lower(p.email) = s.email
    where s.unsubscribed_at is null
      and (
        p_audience = 'tous'
        or (p_audience = 'gratuits' and (p.id is null or public.user_tier(p.id) = 'free'))
        or (p.id is not null and public.user_tier(p.id) = case p_audience when 'premium' then 'premium' else 'expert' end)
      )
    order by s.created_at;
end;
$$;

-- Effectifs par audience (affichés dans le compositeur)
create or replace function public.newsletter_audience_counts()
returns table (tous integer, gratuits integer, premium integer, expert integer)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    with inscrits as (
      select coalesce(public.user_tier(p.id), 'free') as tier
      from public.newsletter_subscribers s
      left join public.profiles p on lower(p.email) = s.email
      where s.unsubscribed_at is null
    )
    select count(*)::integer,
           count(*) filter (where tier = 'free')::integer,
           count(*) filter (where tier = 'premium')::integer,
           count(*) filter (where tier = 'expert')::integer
    from inscrits;
end;
$$;

-- Lecteurs ayant demandé un email à chaque nouvel article
create or replace function public.article_notification_recipients()
returns table (email text, full_name text)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if not public.is_staff() then
    raise exception 'forbidden' using errcode = '42501';
  end if;

  return query
    select p.email, p.full_name
    from public.profiles p
    where p.notify_new_articles
    order by p.created_at;
end;
$$;

revoke execute on function public.user_tier(uuid) from public, anon, authenticated;
revoke execute on function public.newsletter_recipients(text) from public, anon;
revoke execute on function public.newsletter_audience_counts() from public, anon;
revoke execute on function public.article_notification_recipients() from public, anon;
grant execute on function public.newsletter_recipients(text) to authenticated;
grant execute on function public.newsletter_audience_counts() to authenticated;
grant execute on function public.article_notification_recipients() to authenticated;
