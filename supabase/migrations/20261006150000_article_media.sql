-- ═══════════════════════════════════════════════════════════════
-- Bucket "article-media" : images et vidéos insérées dans les articles.
-- Lecture publique (médias affichés dans des pages publiques),
-- écriture réservée à l'équipe éditoriale. Types et taille limités.
-- ═══════════════════════════════════════════════════════════════
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'article-media',
  'article-media',
  true,
  52428800, -- 50 Mo (vidéos)
  array['image/jpeg', 'image/png', 'image/webp', 'image/avif', 'image/gif', 'video/mp4', 'video/webm']
)
on conflict (id) do update
  set public = excluded.public,
      file_size_limit = excluded.file_size_limit,
      allowed_mime_types = excluded.allowed_mime_types;

create policy article_media_insert_staff on storage.objects
  for insert to authenticated
  with check (bucket_id = 'article-media' and (select public.is_staff()));

create policy article_media_update_staff on storage.objects
  for update to authenticated
  using (bucket_id = 'article-media' and (select public.is_staff()))
  with check (bucket_id = 'article-media' and (select public.is_staff()));

create policy article_media_delete_staff on storage.objects
  for delete to authenticated
  using (bucket_id = 'article-media' and (select public.is_staff()));
