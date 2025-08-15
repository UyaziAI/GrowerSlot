-- Basic seed data for development
-- Note: This is minimal seed data. Production seeding should be done via application logic.

-- Default tenant (for development only)
INSERT INTO tenants (id, name, timezone) 
VALUES ('00000000-0000-0000-0000-000000000001', 'Demo Packhouse', 'Africa/Johannesburg')
ON CONFLICT (id) DO NOTHING;

-- Default admin user (for development only)
INSERT INTO users (id, tenant_id, email, password_hash, role, name)
VALUES (
  '00000000-0000-0000-0000-000000000002',
  '00000000-0000-0000-0000-000000000001',
  'admin@demo.com',
  '$2b$10$rOiMJRnOVJyRMWNoq./yOuIoU5QZjNUHSW8LWwQ5X7Q9X1YYGnR46', -- 'password123'
  'admin',
  'Demo Admin'
) ON CONFLICT (email) DO NOTHING;

-- Default grower user (for development only)
INSERT INTO users (id, tenant_id, email, password_hash, role, name)
VALUES (
  '00000000-0000-0000-0000-000000000003',
  '00000000-0000-0000-0000-000000000001',
  'grower@demo.com',
  '$2b$10$rOiMJRnOVJyRMWNoq./yOuIoU5QZjNUHSW8LWwQ5X7Q9X1YYGnR46', -- 'password123'
  'grower',
  'Demo Grower'
) ON CONFLICT (email) DO NOTHING;