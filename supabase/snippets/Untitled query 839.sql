SELECT id, business_name, state, city
FROM detectives
WHERE LENGTH(state) <= 3;