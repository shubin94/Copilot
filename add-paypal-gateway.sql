-- Add PayPal gateway to payment_gateways table
INSERT INTO payment_gateways (name, display_name, is_enabled, is_test_mode, config)
VALUES ('paypal', 'PayPal', false, true, '{"clientId": "", "clientSecret": ""}'::jsonb)
ON CONFLICT (name) DO NOTHING;

-- Verify
SELECT name, is_enabled, is_test_mode FROM payment_gateways ORDER BY name;
