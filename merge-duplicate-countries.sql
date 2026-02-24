-- =====================================================
-- MERGE DUPLICATE COUNTRIES & NORMALIZE
-- =====================================================
-- Purpose: 
--   1. Merge "IN" (id=2) into "India" (id=1)
--   2. Normalize "US" (id=3) to "United States"
-- 
-- Safety:
--   - Transaction-wrapped
--   - Idempotent (can run multiple times safely)
--   - Validates before deletion
--   - NO detective data loss
-- =====================================================

BEGIN;

-- =====================================================
-- STEP 1: MERGE "IN" INTO "India"
-- =====================================================

DO $$
DECLARE
  v_india_id INTEGER := 1;
  v_in_id INTEGER := 2;
  v_detectives_moved INTEGER;
BEGIN
  -- Check if duplicate country still exists
  IF EXISTS (SELECT 1 FROM countries WHERE id = v_in_id) THEN
    RAISE NOTICE 'Found duplicate country IN (id=2), merging into India (id=1)...';
    
    -- Move all detectives from IN to India
    UPDATE detectives
    SET country_id = v_india_id
    WHERE country_id = v_in_id;
    
    GET DIAGNOSTICS v_detectives_moved = ROW_COUNT;
    RAISE NOTICE 'Moved % detectives from IN to India', v_detectives_moved;
    
    -- Verify no detectives remain pointing to IN
    IF EXISTS (SELECT 1 FROM detectives WHERE country_id = v_in_id) THEN
      RAISE EXCEPTION 'SAFETY CHECK FAILED: Detectives still reference country_id=2';
    END IF;
    
    -- Safe to delete duplicate country
    DELETE FROM countries WHERE id = v_in_id;
    RAISE NOTICE 'Deleted duplicate country IN (id=2)';
  ELSE
    RAISE NOTICE 'Duplicate country IN (id=2) already removed - skipping';
  END IF;
END $$;

-- =====================================================
-- STEP 2: NORMALIZE "US" TO "United States"
-- =====================================================

DO $$
DECLARE
  v_us_id INTEGER := 3;
  v_current_name TEXT;
BEGIN
  -- Check if US country exists and needs normalization
  SELECT name INTO v_current_name 
  FROM countries 
  WHERE id = v_us_id;
  
  IF FOUND THEN
    IF v_current_name != 'United States' THEN
      RAISE NOTICE 'Normalizing US (id=3) to United States...';
      
      UPDATE countries
      SET 
        name = 'United States',
        slug = 'united-states',
        updated_at = now()
      WHERE id = v_us_id;
      
      RAISE NOTICE 'Updated US → United States (slug: united-states)';
    ELSE
      RAISE NOTICE 'US country already normalized - skipping';
    END IF;
  ELSE
    RAISE NOTICE 'US country (id=3) not found - skipping';
  END IF;
END $$;

-- =====================================================
-- VERIFICATION
-- =====================================================

DO $$
DECLARE
  v_india_count INTEGER;
  v_india_detectives INTEGER;
  v_us_count INTEGER;
  v_duplicate_count INTEGER;
BEGIN
  RAISE NOTICE '========================================';
  RAISE NOTICE 'VERIFICATION REPORT';
  RAISE NOTICE '========================================';
  
  -- Check India exists
  SELECT COUNT(*), SUM((SELECT COUNT(*) FROM detectives d WHERE d.country_id = c.id))
  INTO v_india_count, v_india_detectives
  FROM countries c
  WHERE c.id = 1;
  
  IF v_india_count = 1 THEN
    RAISE NOTICE '✓ India (id=1): EXISTS with % detectives', COALESCE(v_india_detectives, 0);
  ELSE
    RAISE WARNING '✗ India (id=1): NOT FOUND';
  END IF;
  
  -- Check duplicate removed
  SELECT COUNT(*) INTO v_duplicate_count
  FROM countries
  WHERE id = 2;
  
  IF v_duplicate_count = 0 THEN
    RAISE NOTICE '✓ IN (id=2): REMOVED';
  ELSE
    RAISE WARNING '✗ IN (id=2): STILL EXISTS';
  END IF;
  
  -- Check US normalized
  SELECT COUNT(*) INTO v_us_count
  FROM countries
  WHERE id = 3 AND name = 'United States' AND slug = 'united-states';
  
  IF v_us_count = 1 THEN
    RAISE NOTICE '✓ US (id=3): NORMALIZED to United States';
  ELSIF EXISTS (SELECT 1 FROM countries WHERE id = 3) THEN
    RAISE WARNING '✗ US (id=3): EXISTS but not normalized';
  ELSE
    RAISE NOTICE '- US (id=3): NOT FOUND (may not exist in database)';
  END IF;
  
  RAISE NOTICE '========================================';
END $$;

COMMIT;

-- =====================================================
-- POST-MIGRATION VALIDATION QUERIES
-- =====================================================
-- Run these manually to verify results:
--
-- SELECT id, name, slug, 
--        (SELECT COUNT(*) FROM detectives WHERE country_id = c.id) as detective_count
-- FROM countries c
-- WHERE id IN (1, 2, 3)
-- ORDER BY id;
--
-- Expected result:
-- | id | name          | slug           | detective_count |
-- |----|---------------|----------------|-----------------|
-- | 1  | India         | india          | 174             |
-- | 3  | United States | united-states  | 5               |
-- (id=2 should not appear)
-- =====================================================
