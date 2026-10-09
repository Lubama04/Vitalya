-- ═══════════════════════════════════════════════════════════════
-- Prix par devise : le Mobile Money se paie dans la devise locale du pays.
-- Référence : Premium 6 000 FCFA, Expert 11 000 FCFA (franc CFA BEAC et BCEAO).
-- Les autres devises sont des équivalents arrondis, À VALIDER / AJUSTER par
-- l'équipe (simple UPDATE, aucun redéploiement nécessaire).
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.subscription_prices (
  tier       text not null check (tier in ('premium', 'expert')),
  currency   text not null check (currency ~ '^[A-Z]{3}$'),
  amount     integer not null check (amount > 0),
  updated_at timestamptz not null default now(),
  primary key (tier, currency)
);

alter table public.subscription_prices enable row level security;
-- Tarifs publics en lecture ; modification réservée aux administrateurs
create policy subscription_prices_select_all on public.subscription_prices
  for select to anon, authenticated using (true);
create policy subscription_prices_write_admin on public.subscription_prices
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

insert into public.subscription_prices (tier, currency, amount) values
  ('premium', 'XAF', 6000),   ('expert', 'XAF', 11000),   -- Afrique centrale (FCFA)
  ('premium', 'XOF', 6000),   ('expert', 'XOF', 11000),   -- Afrique de l'Ouest (FCFA)
  ('premium', 'CDF', 30000),  ('expert', 'CDF', 55000),   -- RD Congo
  ('premium', 'GHS', 120),    ('expert', 'GHS', 220),     -- Ghana
  ('premium', 'KES', 1400),   ('expert', 'KES', 2500),    -- Kenya
  ('premium', 'MWK', 18000),  ('expert', 'MWK', 33000),   -- Malawi
  ('premium', 'MZN', 650),    ('expert', 'MZN', 1200),    -- Mozambique
  ('premium', 'NGN', 16000),  ('expert', 'NGN', 29000),   -- Nigeria
  ('premium', 'RWF', 15000),  ('expert', 'RWF', 27000),   -- Rwanda
  ('premium', 'SLE', 220),    ('expert', 'SLE', 400),     -- Sierra Leone
  ('premium', 'TZS', 26000),  ('expert', 'TZS', 48000),   -- Tanzanie
  ('premium', 'UGX', 37000),  ('expert', 'UGX', 67000),   -- Ouganda
  ('premium', 'ZMW', 250),    ('expert', 'ZMW', 450)      -- Zambie
on conflict (tier, currency) do update set amount = excluded.amount, updated_at = now();

-- Prix d'une formule dans une devise (null si la devise n'est pas proposée)
create or replace function public.price_for(p_tier text, p_currency text)
returns integer
language sql
stable
set search_path = ''
as $$
  select amount from public.subscription_prices where tier = p_tier and currency = p_currency;
$$;

-- Référence en francs CFA (affichage, emails)
create or replace function public.subscription_price(p_tier text)
returns integer
language sql
stable
set search_path = ''
as $$
  select public.price_for(p_tier, 'XAF');
$$;

-- Ouverture d'un paiement : le montant vient TOUJOURS de la table des prix
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
  v_amount integer := public.price_for(p_tier, p_currency);
  v_id uuid := gen_random_uuid();
begin
  if v_user is null then
    raise exception 'not_authenticated' using errcode = '42501';
  end if;
  if v_amount is null or p_provider not in ('pawapay', 'moneyfusion') then
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

grant execute on function public.price_for(text, text) to anon, authenticated, service_role;
