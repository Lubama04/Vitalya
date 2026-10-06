-- Remplace la politique « for all » de categories (qui doublait le SELECT)
-- par des politiques d'écriture distinctes : une seule politique SELECT par rôle.
drop policy if exists categories_write_staff on public.categories;

create policy categories_insert_staff on public.categories
  for insert to authenticated
  with check ((select public.is_staff()));

create policy categories_update_staff on public.categories
  for update to authenticated
  using ((select public.is_staff()))
  with check ((select public.is_staff()));

create policy categories_delete_staff on public.categories
  for delete to authenticated
  using ((select public.is_staff()));
