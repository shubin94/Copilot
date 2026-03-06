-- Check if location tables are populated

-- Countries
SELECT 'Countries Count:' as info, COUNT(*) as count FROM countries;
SELECT * FROM countries WHERE code IN ('IN', 'US', 'GB', 'CA') ORDER BY code;

-- States for US
SELECT 'US States Count:' as info, COUNT(*) as count 
FROM states s 
INNER JOIN countries c ON c.id = s.country_id 
WHERE c.code = 'US';

SELECT c.code, s.name, s.slug 
FROM states s 
INNER JOIN countries c ON c.id = s.country_id 
WHERE c.code = 'US'
LIMIT 5;

-- Cities for California
SELECT 'California Cities Count:' as info, COUNT(*) as count
FROM cities ci
INNER JOIN states s ON s.id = ci.state_id
INNER JOIN countries c ON c.id = s.country_id
WHERE c.code = 'US' AND s.slug = 'california';

-- Check detective countries
SELECT 'Detective Countries:' as info, country, COUNT(*) as count
FROM detectives
WHERE status = 'active'
GROUP BY country
ORDER BY count DESC;
