-- Paywall : l'aperçu d'un article réservé montre les 2 premiers paragraphes de texte
-- (le chapeau compte comme paragraphe ; les intertitres rencontrés avant sont gardés).
-- Les composants (À retenir, encadrés…), listes, images et tableaux ne sont jamais divulgués.
create or replace function public.get_article_body(p_slug text)
returns table(content text, has_access boolean)
language plpgsql
stable
security definer
set search_path to ''
as $function$
declare
  v_article public.articles%rowtype;
  v_user_rank smallint := 0;
  v_staff boolean := false;
  v_block text;
  v_parts text[] := '{}';
  v_count int := 0;
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
    return;
  end if;

  foreach v_block in array regexp_split_to_array(
    btrim(coalesce(v_article.content, ''), E' \t\r\n'),
    E'(\\r\\n|\\r|\\n)[ \\t]*(\\r\\n|\\r|\\n)\\s*'
  ) loop
    v_block := btrim(v_block, E' \t\r\n');
    continue when v_block = '';

    if v_block ~ '^<Chapeau[\s>]' then
      -- Chapeau complet uniquement (balise fermante présente), sinon le MDX serait invalide
      continue when position('</Chapeau>' in v_block) = 0;
      -- Coupé juste après la balise fermante : rien de ce qui suit dans le même bloc
      v_parts := v_parts || left(v_block, position('</Chapeau>' in v_block) + length('</Chapeau>') - 1);
      v_count := v_count + 1;
    elsif v_block ~ '^#{1,6}\s' then
      v_parts := v_parts || v_block;
    elsif v_block ~ '^(<|>|\||!\[|```|[-*+]\s|\d+[.)]\s|import\s|export\s|---)' then
      continue;
    else
      v_parts := v_parts || v_block;
      v_count := v_count + 1;
    end if;

    exit when v_count >= 2;
  end loop;

  return query select array_to_string(v_parts, E'\n\n'), false;
end;
$function$;
