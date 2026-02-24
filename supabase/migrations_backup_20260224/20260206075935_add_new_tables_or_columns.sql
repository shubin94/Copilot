set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.update_detective_visibility_timestamp()
 RETURNS trigger
 LANGUAGE plpgsql
AS $function$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$function$
;

