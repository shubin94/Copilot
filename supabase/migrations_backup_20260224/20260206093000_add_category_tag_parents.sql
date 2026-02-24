-- Add optional parent relationships for CMS categories and tags

alter table "public"."categories"
  add column if not exists "parent_id" uuid;

alter table "public"."tags"
  add column if not exists "parent_id" uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'categories_parent_id_fkey'
  ) then
    alter table "public"."categories"
      add constraint "categories_parent_id_fkey"
      foreign key ("parent_id")
      references "public"."categories"("id")
      on delete set null;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'tags_parent_id_fkey'
  ) then
    alter table "public"."tags"
      add constraint "tags_parent_id_fkey"
      foreign key ("parent_id")
      references "public"."tags"("id")
      on delete set null;
  end if;
end $$;

create index if not exists "idx_categories_parent_id" on "public"."categories" ("parent_id");
create index if not exists "idx_tags_parent_id" on "public"."tags" ("parent_id");
