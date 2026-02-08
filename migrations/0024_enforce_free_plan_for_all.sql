-- DATA REPAIR: Assign FREE plan to all detectives with NULL subscriptionPackageId
-- This is a ONE-TIME fix to ensure platform rule: Every detective MUST have a subscription

DO $$
DECLARE
  free_plan_id TEXT;
  affected_count INTEGER;
  detective_rec RECORD;
BEGIN
  -- Find the FREE plan (price = 0, active)
  SELECT id INTO free_plan_id
  FROM subscription_plans
  WHERE monthly_price = '0' 
  AND is_active = true
  ORDER BY name ASC
  LIMIT 1;

  IF free_plan_id IS NULL THEN
    RAISE EXCEPTION 'CRITICAL: FREE plan not found in database';
  END IF;

  RAISE NOTICE 'Found FREE plan ID: %', free_plan_id;

  -- Log and update detectives that need the free plan
  RAISE NOTICE 'Detectives with NULL subscriptionPackageId:';
  FOR detective_rec IN 
    SELECT id, business_name FROM detectives WHERE subscription_package_id IS NULL
  LOOP
    RAISE NOTICE '  - Detective: % assigned to FREE plan', detective_rec.business_name;
  END LOOP;

  -- Update all detectives with NULL subscriptionPackageId
  UPDATE detectives
  SET 
    subscription_package_id = free_plan_id,
    subscription_activated_at = CURRENT_TIMESTAMP,
    billing_cycle = NULL,
    updated_at = CURRENT_TIMESTAMP
  WHERE subscription_package_id IS NULL;

  GET DIAGNOSTICS affected_count = ROW_COUNT;
  
  RAISE NOTICE '✅ Fixed % detective(s) - assigned FREE plan', affected_count;

  -- Verify no NULL subscriptions remain
  SELECT COUNT(*) INTO affected_count
  FROM detectives
  WHERE subscription_package_id IS NULL;

  IF affected_count > 0 THEN
    RAISE EXCEPTION 'VERIFICATION FAILED: Still have % detectives with NULL subscription', affected_count;
  END IF;

  RAISE NOTICE '✅ VERIFICATION PASSED: All detectives now have subscription plans';

END $$;
