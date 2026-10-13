-- ═══════════════════════════════════════════════════════════════
-- Numéros du magazine (compilation PDF des articles d'un numéro)
-- ═══════════════════════════════════════════════════════════════

create table if not exists public.magazine_editions (
  id               uuid primary key default gen_random_uuid(),
  numero           integer not null unique check (numero > 0),
  titre            text not null check (char_length(titre) between 3 and 200),
  date_publication date not null,
  article_ids      uuid[] not null default '{}',
  couverture_url   text check (char_length(couverture_url) <= 1000),
  created_at       timestamptz not null default now()
);

alter table public.magazine_editions enable row level security;

-- Liste des numéros publique (le contenu des articles reste protégé par get_article_body)
create policy magazine_editions_select_all on public.magazine_editions
  for select to anon, authenticated using (true);
create policy magazine_editions_write_admin on public.magazine_editions
  for all to authenticated
  using ((select public.is_admin()))
  with check ((select public.is_admin()));

-- N°01 : les 8 articles du Volume 01, dans l'ordre éditorial
insert into public.magazine_editions (numero, titre, date_publication, article_ids, couverture_url)
select 1, 'Vitalya N°01 · Avril 2026', date '2026-04-01',
       array(
         select a.id from public.articles a
           join (values
             ('huile-de-baobab-le-secret-que-lafrique-gardait', 1),
             ('routine-beaute-peau-noire-5-etapes', 2),
             ('cheveux-afro-7-erreurs-qui-cassent-boucles', 3),
             ('moringa-verites-et-mensonges', 4),
             ('7-signaux-diabete-type-2', 5),
             ('burn-out-afrique-personne-en-parle', 6),
             ('fonio-sorgho-millet-superaliments-africains', 7),
             ('5-erreurs-skincare-peau-foncee', 8)
           ) as ordre(slug, rang) on ordre.slug = a.slug
          order by ordre.rang
       ),
       '/covers/volume-01.webp'
on conflict (numero) do nothing;
