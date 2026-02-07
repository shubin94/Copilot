-- Seed access pages for employee management
INSERT INTO "access_pages" ("key", "name", "is_active") 
VALUES 
  ('dashboard', 'Dashboard', true),
  ('employees', 'Employees Management', true),
  ('detectives', 'Detectives Management', true),
  ('services', 'Services Management', true),
  ('users', 'Users Management', true),
  ('settings', 'Settings', true),
  ('reports', 'Reports', true),
  ('payments', 'Payments & Finance', true),
  ('cms', 'Content Management System', true)
ON CONFLICT ("key") DO UPDATE SET
  "name" = EXCLUDED."name",
  "is_active" = EXCLUDED."is_active";
