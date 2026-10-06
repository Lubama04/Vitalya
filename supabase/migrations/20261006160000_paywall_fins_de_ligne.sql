-- ═══════════════════════════════════════════════════════════════
-- Correctif paywall : les formulaires HTML envoient les retours à la
-- ligne en CRLF (\r\n). Le découpage de l'aperçu sur '\n\n' échouait
-- alors et un article réservé aurait été servi en entier.
-- 1. Normalisation CRLF → LF à l'écriture (trigger)
-- 2. Découpage de l'aperçu tolérant à tout type de fin de ligne
-- 3. Normalisation des contenus existants
-- ═══════════════════════════════════════════════════════════════

create or replace function public.normalize_article_content()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.content = replace(replace(new.content, E'\r\n', E'\n'), E'\r', E'\n');
  return new;
end;
$$;

revoke execute on function public.normalize_article_content() from public, anon, authenticated;

drop trigger if exists articles_normalize_content on public.articles;
create trigger articles_normalize_content
  before insert or update of content on public.articles
  for each row execute function public.normalize_article_content();

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

  if not (v_article.published and v_article.published_at <= now()) and not v_staff then
    return;
  end if;

  if v_staff or v_user_rank >= public.tier_rank(v_article.access_level) then
    return query select v_article.content, true;
  else
    -- Aperçu : 3 premiers blocs, quelle que soit la fin de ligne (LF, CRLF, CR)
    return query select
      array_to_string(
        (regexp_split_to_array(btrim(v_article.content, E' \t\r\n'), E'(\r\n|\r|\n)[ \t]*(\r\n|\r|\n)\\s*'))[1:3],
        E'\n\n'
      ),
      false;
  end if;
end;
$$;

-- Les droits d'exécution sont conservés par CREATE OR REPLACE ; on les réaffirme.
revoke execute on function public.get_article_body(text) from public;
grant execute on function public.get_article_body(text) to anon, authenticated;

update public.articles
   set content = replace(replace(content, E'\r\n', E'\n'), E'\r', E'\n')
 where content like '%' || chr(13) || '%';
