-- Convert all subscription plan prices from INR to USD
-- Exchange rate: 1 USD = 83.5 INR

UPDATE subscription_plans
SET 
  monthly_price = ROUND(CAST(monthly_price AS DECIMAL) / 83.5, 2),
  yearly_price = ROUND(CAST(yearly_price AS DECIMAL) / 83.5, 2)
WHERE (CAST(monthly_price AS DECIMAL) > 100 OR CAST(yearly_price AS DECIMAL) > 100);

-- Verify the conversion
SELECT id, name, monthly_price, yearly_price FROM subscription_plans ORDER BY name;
