-- ═══════════════════════════════════════════════════════════════
-- Newsletter : prénom des destinataires, modèles réutilisables.
-- Magazine : couverture PDF, couverture « déjà composée », cache des PDF.
-- ═══════════════════════════════════════════════════════════════

-- ─── Destinataires avec prénom (premier mot du nom du profil) ───
drop function if exists public.newsletter_recipients(text);
create function public.newsletter_recipients(p_audience text)
returns table (email text, unsubscribe_token uuid, first_name text)
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
    select s.email, s.unsubscribe_token, nullif(split_part(btrim(coalesce(p.full_name, '')), ' ', 1), '')
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
revoke execute on function public.newsletter_recipients(text) from public, anon;
grant execute on function public.newsletter_recipients(text) to authenticated;

-- ─── Modèles de newsletter (équipe uniquement) ───
create table if not exists public.newsletter_templates (
  id         uuid primary key default gen_random_uuid(),
  name       text not null unique check (char_length(name) between 2 and 120),
  -- markdown : corps mis en page par Vitalya ; html : document HTML complet
  format     text not null check (format in ('markdown', 'html')),
  subject    text not null default '' check (char_length(subject) <= 200),
  content    text not null check (char_length(content) <= 200000),
  updated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);
alter table public.newsletter_templates enable row level security;
create policy newsletter_templates_all_staff on public.newsletter_templates
  for all to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

alter table public.newsletters
  add column if not exists format text not null default 'markdown' check (format in ('markdown', 'html'));

-- ─── Numéros du magazine ───
alter table public.magazine_editions
  add column if not exists couverture_pdf_url text check (char_length(couverture_pdf_url) <= 1000),
  -- La couverture contient déjà logo, titre et date (maquette Canva) : rien n'est superposé dans le PDF
  add column if not exists couverture_complete boolean not null default false,
  add column if not exists updated_at timestamptz not null default now();

update public.magazine_editions set couverture_complete = true where numero = 1 and couverture_url = '/covers/volume-01.webp';

create or replace trigger magazine_editions_updated_at
  before update on public.magazine_editions
  for each row execute function public.set_updated_at();

-- ─── Cache des PDF générés (privé : écrit et lu uniquement par la fonction serveur) ───
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('magazines-pdf', 'magazines-pdf', false, 52428800, array['application/pdf'])
on conflict (id) do nothing;
