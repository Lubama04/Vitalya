-- Nouveaux tarifs mensuels (francs CFA) : Premium 6 000, Expert 11 000
create or replace function public.subscription_price(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier when 'premium' then 6000 when 'expert' then 11000 end;
$$;
