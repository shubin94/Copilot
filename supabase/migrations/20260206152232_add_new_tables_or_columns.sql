drop index if exists "public"."detectives_plan_idx";

alter table "public"."detectives" drop column "subscription_plan";

alter table "public"."detectives" alter column "subscription_package_id" set not null;


