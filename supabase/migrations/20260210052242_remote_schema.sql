drop trigger if exists "categories_update_timestamp" on "public"."categories";

drop trigger if exists "trigger_detective_visibility_updated_at" on "public"."detective_visibility";

drop trigger if exists "pages_update_timestamp" on "public"."pages";

drop trigger if exists "payment_gateways_updated_at" on "public"."payment_gateways";

drop trigger if exists "tags_update_timestamp" on "public"."tags";

alter table "public"."billing_history" drop constraint "billing_history_detective_id_detectives_id_fk";

alter table "public"."categories" drop constraint "categories_parent_id_fkey";

alter table "public"."categories" drop constraint "categories_status_check";

alter table "public"."claim_tokens" drop constraint "claim_tokens_detective_id_fkey";

alter table "public"."detective_applications" drop constraint "detective_applications_reviewed_by_users_id_fk";

alter table "public"."detective_visibility" drop constraint "detective_visibility_detective_id_fkey";

alter table "public"."detectives" drop constraint "detectives_user_id_users_id_fk";

alter table "public"."detectives" drop constraint "fk_detectives_subscription_package";

alter table "public"."favorites" drop constraint "favorites_service_id_services_id_fk";

alter table "public"."favorites" drop constraint "favorites_user_id_users_id_fk";

alter table "public"."orders" drop constraint "orders_detective_id_detectives_id_fk";

alter table "public"."orders" drop constraint "orders_package_id_service_packages_id_fk";

alter table "public"."orders" drop constraint "orders_service_id_services_id_fk";

alter table "public"."orders" drop constraint "orders_user_id_users_id_fk";

alter table "public"."page_tags" drop constraint "page_tags_page_id_fkey";

alter table "public"."page_tags" drop constraint "page_tags_tag_id_fkey";

alter table "public"."pages" drop constraint "pages_category_id_fkey";

alter table "public"."pages" drop constraint "pages_status_check";

alter table "public"."payment_gateways" drop constraint "payment_gateways_updated_by_fkey";

alter table "public"."payment_orders" drop constraint "payment_orders_detective_id_detectives_id_fk";

alter table "public"."payment_orders" drop constraint "payment_orders_detective_id_fkey";

alter table "public"."payment_orders" drop constraint "payment_orders_user_id_fkey";

alter table "public"."profile_claims" drop constraint "profile_claims_detective_id_detectives_id_fk";

alter table "public"."profile_claims" drop constraint "profile_claims_reviewed_by_users_id_fk";

alter table "public"."reviews" drop constraint "reviews_service_id_services_id_fk";

alter table "public"."reviews" drop constraint "reviews_user_id_users_id_fk";

alter table "public"."service_packages" drop constraint "service_packages_service_id_services_id_fk";

alter table "public"."services" drop constraint "services_detective_id_detectives_id_fk";

alter table "public"."tags" drop constraint "tags_parent_id_fkey";

alter table "public"."tags" drop constraint "tags_status_check";

alter table "public"."user_pages" drop constraint "user_pages_granted_by_fkey";

alter table "public"."user_pages" drop constraint "user_pages_page_id_fkey";

alter table "public"."user_pages" drop constraint "user_pages_user_id_fkey";

alter table "public"."detective_applications" alter column "status" set default 'pending'::public.claim_status;

alter table "public"."detective_applications" alter column "status" set data type public.claim_status using "status"::text::public.claim_status;

alter table "public"."detectives" alter column "created_by" set default 'self'::public.created_by;

alter table "public"."detectives" alter column "created_by" set data type public.created_by using "created_by"::text::public.created_by;

alter table "public"."detectives" alter column "level" set default 'level1'::public.detective_level;

alter table "public"."detectives" alter column "level" set data type public.detective_level using "level"::text::public.detective_level;

alter table "public"."detectives" alter column "status" set default 'pending'::public.detective_status;

alter table "public"."detectives" alter column "status" set data type public.detective_status using "status"::text::public.detective_status;

alter table "public"."orders" alter column "status" set default 'pending'::public.order_status;

alter table "public"."orders" alter column "status" set data type public.order_status using "status"::text::public.order_status;

alter table "public"."payment_gateways" alter column "id" set default nextval('public.payment_gateways_id_seq'::regclass);

alter table "public"."profile_claims" alter column "status" set default 'pending'::public.claim_status;

alter table "public"."profile_claims" alter column "status" set data type public.claim_status using "status"::text::public.claim_status;

alter table "public"."users" alter column "role" set default 'user'::public.user_role;

alter table "public"."users" alter column "role" set data type public.user_role using "role"::text::public.user_role;

alter table "public"."billing_history" add constraint "billing_history_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."billing_history" validate constraint "billing_history_detective_id_detectives_id_fk";

alter table "public"."categories" add constraint "categories_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.categories(id) ON DELETE SET NULL not valid;

alter table "public"."categories" validate constraint "categories_parent_id_fkey";

alter table "public"."categories" add constraint "categories_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."categories" validate constraint "categories_status_check";

alter table "public"."claim_tokens" add constraint "claim_tokens_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."claim_tokens" validate constraint "claim_tokens_detective_id_fkey";

alter table "public"."detective_applications" add constraint "detective_applications_reviewed_by_users_id_fk" FOREIGN KEY (reviewed_by) REFERENCES public.users(id) not valid;

alter table "public"."detective_applications" validate constraint "detective_applications_reviewed_by_users_id_fk";

alter table "public"."detective_visibility" add constraint "detective_visibility_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."detective_visibility" validate constraint "detective_visibility_detective_id_fkey";

alter table "public"."detectives" add constraint "detectives_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."detectives" validate constraint "detectives_user_id_users_id_fk";

alter table "public"."detectives" add constraint "fk_detectives_subscription_package" FOREIGN KEY (subscription_package_id) REFERENCES public.subscription_plans(id) ON UPDATE CASCADE ON DELETE RESTRICT not valid;

alter table "public"."detectives" validate constraint "fk_detectives_subscription_package";

alter table "public"."favorites" add constraint "favorites_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_service_id_services_id_fk";

alter table "public"."favorites" add constraint "favorites_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."favorites" validate constraint "favorites_user_id_users_id_fk";

alter table "public"."orders" add constraint "orders_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."orders" validate constraint "orders_detective_id_detectives_id_fk";

alter table "public"."orders" add constraint "orders_package_id_service_packages_id_fk" FOREIGN KEY (package_id) REFERENCES public.service_packages(id) not valid;

alter table "public"."orders" validate constraint "orders_package_id_service_packages_id_fk";

alter table "public"."orders" add constraint "orders_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) not valid;

alter table "public"."orders" validate constraint "orders_service_id_services_id_fk";

alter table "public"."orders" add constraint "orders_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."orders" validate constraint "orders_user_id_users_id_fk";

alter table "public"."page_tags" add constraint "page_tags_page_id_fkey" FOREIGN KEY (page_id) REFERENCES public.pages(id) ON DELETE CASCADE not valid;

alter table "public"."page_tags" validate constraint "page_tags_page_id_fkey";

alter table "public"."page_tags" add constraint "page_tags_tag_id_fkey" FOREIGN KEY (tag_id) REFERENCES public.tags(id) ON DELETE CASCADE not valid;

alter table "public"."page_tags" validate constraint "page_tags_tag_id_fkey";

alter table "public"."pages" add constraint "pages_category_id_fkey" FOREIGN KEY (category_id) REFERENCES public.categories(id) ON DELETE CASCADE not valid;

alter table "public"."pages" validate constraint "pages_category_id_fkey";

alter table "public"."pages" add constraint "pages_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."pages" validate constraint "pages_status_check";

alter table "public"."payment_gateways" add constraint "payment_gateways_updated_by_fkey" FOREIGN KEY (updated_by) REFERENCES public.users(id) not valid;

alter table "public"."payment_gateways" validate constraint "payment_gateways_updated_by_fkey";

alter table "public"."payment_orders" add constraint "payment_orders_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_detective_id_detectives_id_fk";

alter table "public"."payment_orders" add constraint "payment_orders_detective_id_fkey" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_detective_id_fkey";

alter table "public"."payment_orders" add constraint "payment_orders_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) not valid;

alter table "public"."payment_orders" validate constraint "payment_orders_user_id_fkey";

alter table "public"."profile_claims" add constraint "profile_claims_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."profile_claims" validate constraint "profile_claims_detective_id_detectives_id_fk";

alter table "public"."profile_claims" add constraint "profile_claims_reviewed_by_users_id_fk" FOREIGN KEY (reviewed_by) REFERENCES public.users(id) not valid;

alter table "public"."profile_claims" validate constraint "profile_claims_reviewed_by_users_id_fk";

alter table "public"."reviews" add constraint "reviews_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_service_id_services_id_fk";

alter table "public"."reviews" add constraint "reviews_user_id_users_id_fk" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."reviews" validate constraint "reviews_user_id_users_id_fk";

alter table "public"."service_packages" add constraint "service_packages_service_id_services_id_fk" FOREIGN KEY (service_id) REFERENCES public.services(id) ON DELETE CASCADE not valid;

alter table "public"."service_packages" validate constraint "service_packages_service_id_services_id_fk";

alter table "public"."services" add constraint "services_detective_id_detectives_id_fk" FOREIGN KEY (detective_id) REFERENCES public.detectives(id) ON DELETE CASCADE not valid;

alter table "public"."services" validate constraint "services_detective_id_detectives_id_fk";

alter table "public"."tags" add constraint "tags_parent_id_fkey" FOREIGN KEY (parent_id) REFERENCES public.tags(id) ON DELETE SET NULL not valid;

alter table "public"."tags" validate constraint "tags_parent_id_fkey";

alter table "public"."tags" add constraint "tags_status_check" CHECK (((status)::text = ANY ((ARRAY['published'::character varying, 'draft'::character varying, 'archived'::character varying])::text[]))) not valid;

alter table "public"."tags" validate constraint "tags_status_check";

alter table "public"."user_pages" add constraint "user_pages_granted_by_fkey" FOREIGN KEY (granted_by) REFERENCES public.users(id) ON DELETE SET NULL not valid;

alter table "public"."user_pages" validate constraint "user_pages_granted_by_fkey";

alter table "public"."user_pages" add constraint "user_pages_page_id_fkey" FOREIGN KEY (page_id) REFERENCES public.access_pages(id) ON DELETE CASCADE not valid;

alter table "public"."user_pages" validate constraint "user_pages_page_id_fkey";

alter table "public"."user_pages" add constraint "user_pages_user_id_fkey" FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE not valid;

alter table "public"."user_pages" validate constraint "user_pages_user_id_fkey";

CREATE TRIGGER categories_update_timestamp BEFORE UPDATE ON public.categories FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."categories" DISABLE TRIGGER "categories_update_timestamp";

CREATE TRIGGER trigger_detective_visibility_updated_at BEFORE UPDATE ON public.detective_visibility FOR EACH ROW EXECUTE FUNCTION public.update_detective_visibility_timestamp();
ALTER TABLE "public"."detective_visibility" DISABLE TRIGGER "trigger_detective_visibility_updated_at";

CREATE TRIGGER pages_update_timestamp BEFORE UPDATE ON public.pages FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."pages" DISABLE TRIGGER "pages_update_timestamp";

CREATE TRIGGER payment_gateways_updated_at BEFORE UPDATE ON public.payment_gateways FOR EACH ROW EXECUTE FUNCTION public.update_payment_gateways_updated_at();
ALTER TABLE "public"."payment_gateways" DISABLE TRIGGER "payment_gateways_updated_at";

CREATE TRIGGER tags_update_timestamp BEFORE UPDATE ON public.tags FOR EACH ROW EXECUTE FUNCTION public.update_timestamp();
ALTER TABLE "public"."tags" DISABLE TRIGGER "tags_update_timestamp";

CREATE TRIGGER objects_delete_delete_prefix AFTER DELETE ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();

CREATE TRIGGER objects_insert_create_prefix BEFORE INSERT ON storage.objects FOR EACH ROW EXECUTE FUNCTION storage.objects_insert_prefix_trigger();

CREATE TRIGGER objects_update_create_prefix BEFORE UPDATE ON storage.objects FOR EACH ROW WHEN (((new.name <> old.name) OR (new.bucket_id <> old.bucket_id))) EXECUTE FUNCTION storage.objects_update_prefix_trigger();

CREATE TRIGGER prefixes_create_hierarchy BEFORE INSERT ON storage.prefixes FOR EACH ROW WHEN ((pg_trigger_depth() < 1)) EXECUTE FUNCTION storage.prefixes_insert_trigger();

CREATE TRIGGER prefixes_delete_hierarchy AFTER DELETE ON storage.prefixes FOR EACH ROW EXECUTE FUNCTION storage.delete_prefix_hierarchy_trigger();


