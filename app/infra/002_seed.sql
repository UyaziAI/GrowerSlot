-- Demo data for development

-- Insert demo tenant
INSERT INTO tenants (id, name) VALUES ('550e8400-e29b-41d4-a716-446655440000', 'Demo Packhouse')
ON CONFLICT (id) DO NOTHING;

-- Insert demo growers
INSERT INTO growers (tenant_id, name, contact, role) VALUES
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

-- Insert demo users (password is 'password123')
INSERT INTO users (email, password, grower_id, tenant_id, role) 
SELECT 
  'grower@lowveld.com', 
  '$2b$10$LHTTt20haxcyuDSzS4cnAuWQK2ef0k4s5SbFp.ksrkQvGi42GrtfG',
  g.id,
  '550e8400-e29b-41d4-a716-446655440000',
  'grower'
FROM growers g 
WHERE g.name = 'Lowveld Farms' AND g.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (email) DO NOTHING;

INSERT INTO users (email, password, grower_id, tenant_id, role) 
SELECT 
  'admin@demo.com', 
  '$2b$10$LHTTt20haxcyuDSzS4cnAuWQK2ef0k4s5SbFp.ksrkQvGi42GrtfG',
  g.id,
  '550e8400-e29b-41d4-a716-446655440000',
  'admin'
FROM growers g 
WHERE g.name = 'Admin User' AND g.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
ON CONFLICT (email) DO NOTHING;

-- Insert demo slots for today and tomorrow
INSERT INTO slots (tenant_id, date, start_time, end_time, capacity, notes)
VALUES 
  -- Today's slots
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '08:00:00', '09:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '09:00:00', '10:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '10:00:00', '11:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '11:00:00', '12:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '12:00:00', '13:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '13:00:00', '14:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '14:00:00', '15:00:00', 20.0, 'Maintenance scheduled'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE, '15:00:00', '16:00:00', 20.0, 'Standard delivery window'),
  
  -- Tomorrow's slots
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '08:00:00', '09:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '09:00:00', '10:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '10:00:00', '11:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '11:00:00', '12:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '12:00:00', '13:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '13:00:00', '14:00:00', 20.0, 'Standard delivery window'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '14:00:00', '15:00:00', 20.0, 'Maintenance scheduled'),
  ('550e8400-e29b-41d4-a716-446655440000', CURRENT_DATE + INTERVAL '1 day', '15:00:00', '16:00:00', 20.0, 'Standard delivery window')
ON CONFLICT DO NOTHING;

-- Set some slots to blackout (maintenance)
UPDATE slots 
SET blackout = true 
WHERE notes = 'Maintenance scheduled';

-- Create some test bookings
INSERT INTO bookings (slot_id, tenant_id, grower_id, cultivar_id, quantity)
SELECT 
  s.id,
  s.tenant_id,
  g.id,
  c.id,
  5.5
FROM slots s, growers g, cultivars c
WHERE s.start_time = '10:00:00' 
  AND s.date = CURRENT_DATE
  AND g.name = 'Lowveld Farms'
  AND c.name = 'Beaumont'
  AND s.tenant_id = '550e8400-e29b-41d4-a716-446655440000'
LIMIT 1
ON CONFLICT DO NOTHING;