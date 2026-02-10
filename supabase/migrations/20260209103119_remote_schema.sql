alter table "public"."categories" drop constraint "categories_status_check";

alter table "public"."pages" drop constraint "pages_status_check";

alter table "public"."tags" drop constraint "tags_status_check";

alter table "public"."categories" add constraint "categories_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."categories" validate constraint "categories_status_check";

alter table "public"."pages" add constraint "pages_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."pages" validate constraint "pages_status_check";

alter table "public"."tags" add constraint "tags_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."tags" validate constraint "tags_status_check";


