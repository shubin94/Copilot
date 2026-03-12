SELECT id, business_name, city, state, country
FROM detectives
WHERE LOWER(TRIM(state)) = 'assam';