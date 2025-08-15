-- Core MVP database schema initialization
-- Tenants and multi-tenancy setup

CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- Tenants
CREATE TABLE IF NOT EXISTS tenants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  name text NOT NULL,
  timezone text DEFAULT 'Africa/Johannesburg',
  created_at timestamptz DEFAULT now()
);

-- Users (for authentication)
CREATE TABLE IF NOT EXISTS users (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  email text NOT NULL UNIQUE,
  password_hash text NOT NULL,
  role text NOT NULL CHECK (role IN ('admin', 'grower')),
  name text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Growers (kept for MVP simplicity; can be replaced by parties view later)
CREATE TABLE IF NOT EXISTS growers (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  contact text,
  UNIQUE(tenant_id, name)
);

-- Cultivars
CREATE TABLE IF NOT EXISTS cultivars (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL
);

-- Slots (capacity per window)
CREATE TABLE IF NOT EXISTS slots (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  date date NOT NULL,
  start_time time NOT NULL,
  end_time time NOT NULL,
  capacity numeric(10,2) NOT NULL,
  resource_unit text DEFAULT 'tons',
  blackout boolean DEFAULT false,
  notes text,
  created_by uuid,
  created_at timestamptz DEFAULT now(),
  CONSTRAINT slots_time_chk CHECK (end_time > start_time)
);

-- Restrictions (optional)
CREATE TABLE IF NOT EXISTS slot_restrictions (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  allowed_grower_id uuid REFERENCES growers(id),
  allowed_cultivar_id uuid REFERENCES cultivars(id)
);

-- Bookings
CREATE TABLE IF NOT EXISTS bookings (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  slot_id uuid NOT NULL REFERENCES slots(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  grower_id uuid NOT NULL REFERENCES growers(id),
  cultivar_id uuid REFERENCES cultivars(id),
  quantity numeric(10,2) NOT NULL,
  status text NOT NULL DEFAULT 'confirmed', -- confirmed/cancelled
  created_at timestamptz DEFAULT now()
);

-- Indexes for performance
CREATE INDEX IF NOT EXISTS idx_slots_tenant_date ON slots(tenant_id, date);
CREATE INDEX IF NOT EXISTS idx_bookings_tenant_slot ON bookings(tenant_id, slot_id);
CREATE INDEX IF NOT EXISTS idx_users_tenant_email ON users(tenant_id, email);
CREATE INDEX IF NOT EXISTS idx_growers_tenant_name ON growers(tenant_id, name);