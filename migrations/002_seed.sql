-- Insert demo tenant
INSERT INTO tenants (id, name) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Packhouse')
ON CONFLICT (id) DO NOTHING;

-- Insert demo growers
INSERT INTO growers (tenant_id, name, email, role) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Lowveld Farms', 'grower@lowveld.com', 'grower'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Riverside Orchards', 'grower@riverside.com', 'grower'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Kopje Mac Nuts', 'grower@kopje.com', 'grower'),
  ('550e8400-e29b-41d4-a716-446655440000', 'Admin User', 'admin@demo.com', 'admin')
ON CONFLICT (tenant_id, name) DO NOTHING;

-- Insert demo cultivars
INSERT INTO cultivars (tenant_id, name) VALUES
  ('550e8400-e29b-41d4-a716-446655440000', 'Beaumont'),
  ('550e8400-e29b-41d4-a716-446655440000', 'A4'),
  ('550e8400-e29b-41d4-a716-446655440000', 'A16'),
  ('550e8400-e29b-41d4-a716-446655440000', '816')
ON CONFLICT DO NOTHING;

-- Insert demo users (passwords are 'password123' hashed with bcrypt)
INSERT INTO users (email, password, grower_id, tenant_id, role) 
SELECT 
  'grower@lowveld.com', 
  '$2b$10$8qNJZkhj7X6P5GzZSrBwluSKOC5D4OkI5kOvqNKUvYbO2VQm9lKOa',
  g.id,
  '550e8400-e29b-41d4-a716-446655440000',
  'grower'
FROM growers g 
WHERE g.name = 'Lowveld Farms' AND g.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password, grower_id, tenant_id, role) 
SELECT 
  'admin@demo.com', 
  '$2b$10$8qNJZkhj7X6P5GzZSrBwluSKOC5D4OkI5kOvqNKUvYbO2VQm9lKOa',
  g.id,
  '550e8400-e29b-41d4-a716-446655440000',
  'admin'
FROM growers g 
WHERE g.name = 'Admin User' AND g.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (email) DO NOTHING;

-- Insert demo slots for today and tomorrow
WITH date_series AS (
  SELECT generate_series(
    CURRENT_DATE,
    CURRENT_DATE + INTERVAL '1 day',
    INTERVAL '1 day'
  )::date AS slot_date
),
time_series AS (
  SELECT generate_series(
    '08:00:00'::time,
    '15:00:00'::time,
    INTERVAL '1 hour'
  ) AS start_time
)
INSERT INTO slots (tenant_id, date, start_time, end_time, capacity, notes)
SELECT 
  '550e8400-e29b-41d4-a716-446655440000',
  ds.slot_date,
  ts.start_time,
  ts.start_time + INTERVAL '1 hour',
  20.0,
  CASE 
    WHEN ts.start_time = '14:00:00' THEN 'Maintenance scheduled'
    ELSE 'Standard delivery window'
  END
FROM date_series ds
CROSS JOIN time_series ts
ON CONFLICT DO NOTHING;

-- Set some slots to blackout (maintenance)
UPDATE slots 
SET blackout = true, notes = 'Maintenance scheduled'
WHERE start_time = '14:00:00' AND tenant_id = '550e8400-e29b-41d4-a716-446655440000';
