-- cast_vote indique si le vote a été comptabilisé (false : ce votant avait déjà voté)
drop function if exists public.cast_vote(uuid, text);

create function public.cast_vote(p_article_id uuid, p_option_id text)
returns table (option_id text, count integer, accepted boolean)
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_poll text;
  v_headers json;
  v_voter text;
  v_hash text;
  v_accepted boolean := false;
begin
  if p_option_id !~ '^[a-z0-9-]{1,80}::[a-z0-9-]{1,80}$' then
    raise exception 'invalid_option' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.articles a
    where a.id = p_article_id and a.published and a.published_at <= now()
  ) then
    raise exception 'article_not_found' using errcode = '22023';
  end if;
  v_poll := split_part(p_option_id, '::', 1);

  -- Garde-fou contre la création massive d'options
  if (select count(*) from public.votes v where v.article_id = p_article_id) >= 200
     and not exists (select 1 from public.votes v where v.article_id = p_article_id and v.option_id = p_option_id) then
    raise exception 'too_many_options' using errcode = '22023';
  end if;

  -- Votant : compte connecté, sinon IP + navigateur (en-têtes PostgREST), haché
  v_headers := nullif(current_setting('request.headers', true), '')::json;
  v_voter := coalesce(
    (select auth.uid())::text,
    nullif(split_part(coalesce(v_headers ->> 'x-forwarded-for', ''), ',', 1), '') || '|' || coalesce(v_headers ->> 'user-agent', ''),
    gen_random_uuid()::text
  );
  v_hash := encode(extensions.digest(p_article_id::text || '|' || v_poll || '|' || v_voter, 'sha256'), 'hex');

  insert into public.vote_receipts (article_id, poll_key, voter_hash)
  values (p_article_id, v_poll, v_hash)
  on conflict do nothing;
  v_accepted := found;

  if v_accepted then
    insert into public.votes (article_id, option_id, count)
    values (p_article_id, p_option_id, 1)
    on conflict on constraint votes_pkey
      do update set count = public.votes.count + 1, updated_at = now();
  end if;

  return query
    select v.option_id, v.count, v_accepted from public.votes v
    where v.article_id = p_article_id and v.option_id like v_poll || '::%';
end;
$$;

revoke execute on function public.cast_vote(uuid, text) from public;
grant execute on function public.cast_vote(uuid, text) to anon, authenticated;
