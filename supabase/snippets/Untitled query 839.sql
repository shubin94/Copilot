SELECT country, COUNT(*) 
FROM detectives
WHERE status = 'active'
GROUP BY country
ORDER BY COUNT(*) DESC;