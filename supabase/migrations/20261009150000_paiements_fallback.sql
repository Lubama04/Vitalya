-- ═══════════════════════════════════════════════════════════════
-- Paiements : journal des tentatives (bascule PawaPay → MoneyFusion),
-- nouveaux montants, période d'un mois, détection du premier abonnement.
-- ═══════════════════════════════════════════════════════════════

-- ─── Journal des tentatives de paiement (analyse des échecs) ───
create table if not exists public.payment_logs (
  id                 uuid primary key default gen_random_uuid(),
  user_id            uuid references public.profiles (id) on delete set null,
  payment_id         uuid references public.subscriptions (id) on delete set null,
  amount             integer,
  currency           text,
  provider_attempted text not null check (provider_attempted in ('pawapay', 'moneyfusion')),
  provider_used      text check (provider_used in ('pawapay', 'moneyfusion')),
  status             text not null check (status in ('initiated', 'fallback', 'failed', 'paid', 'payment_failed', 'pending')),
  error_message      text check (char_length(error_message) <= 1000),
  created_at         timestamptz not null default now()
);

create index if not exists payment_logs_user_idx on public.payment_logs (user_id);
create index if not exists payment_logs_created_idx on public.payment_logs (created_at desc);

-- Écriture uniquement par les fonctions serveur (clé de service) ; lecture réservée aux administrateurs
alter table public.payment_logs enable row level security;
create policy payment_logs_select_admin on public.payment_logs
  for select to authenticated
  using ((select public.is_admin()));
revoke insert, update, delete on public.payment_logs from anon, authenticated;

-- ─── Montants (francs CFA) : Premium 2 950, Expert 5 900 ───
create or replace function public.subscription_price(p_tier text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_tier when 'premium' then 2950 when 'expert' then 5900 end;
$$;

-- ─── Confirmation : période d'un mois + premier abonnement payant ───
drop function if exists public.confirm_payment(text, text, text, text, integer);
create function public.confirm_payment(
  p_secret text, p_provider text, p_reference text, p_status text, p_paid_amount integer
)
returns table (
  payment_id uuid, user_email text, user_name text, tier text,
  period_end timestamptz, newly_activated boolean, first_subscription boolean
)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_sub public.subscriptions%rowtype;
  v_start timestamptz;
  v_new boolean := false;
  v_first boolean := false;
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
      -- Premier abonnement payant du lecteur (email de bienvenue)
      v_first := not exists (
        select 1 from public.subscriptions s
         where s.user_id = v_sub.user_id and s.id <> v_sub.id and s.paid_at is not null
      );
      -- Prolonge à partir de la fin de l'abonnement actif le plus lointain
      select greatest(now(), coalesce(max(s.current_period_end), now())) into v_start
        from public.subscriptions s
       where s.user_id = v_sub.user_id and s.status = 'active' and s.current_period_end > now();
      update public.subscriptions
         set status = 'active', paid_at = now(), current_period_end = v_start + interval '1 month'
       where id = v_sub.id;
      v_new := true;
    end if;
  elsif p_status = 'failed' and v_sub.status = 'incomplete' then
    update public.subscriptions set status = 'failed' where id = v_sub.id;
  end if;

  return query
    select s.id, p.email, p.full_name, s.tier, s.current_period_end, v_new, v_first
      from public.subscriptions s join public.profiles p on p.id = s.user_id
     where s.id = v_sub.id;
end;
$$;

revoke execute on function public.confirm_payment(text, text, text, text, integer) from public;
grant execute on function public.confirm_payment(text, text, text, text, integer) to anon, authenticated, service_role;
