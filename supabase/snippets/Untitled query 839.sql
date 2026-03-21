-- Clear detective location overrides (/detectives/...)
DELETE FROM location_seo_overrides WHERE entity_type = 'detective-location';

-- Clear service location overrides (/locations/...)
DELETE FROM location_seo_overrides WHERE entity_type = 'service-location';

-- Or clear everything at once:
DELETE FROM location_seo_overrides;
