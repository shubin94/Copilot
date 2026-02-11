-- Cascade category name updates from service_categories to services
-- This keeps services.category in sync with renamed categories.

create or replace function public.sync_service_category_name()
returns trigger
language plpgsql
as $$
begin
  if new.name is distinct from old.name then
    update public.services
      set category = new.name
      where category = old.name;
  end if;
  return new;
end;
$$;

drop trigger if exists service_categories_name_cascade on public.service_categories;

create trigger service_categories_name_cascade
after update of name on public.service_categories
for each row execute function public.sync_service_category_name();
