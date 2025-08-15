-- Logistics tracking system
-- Consignments and checkpoints for delivery tracking

-- Consignments (linked to bookings)
CREATE TABLE IF NOT EXISTS consignments (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  booking_id uuid REFERENCES bookings(id),
  consignment_number text UNIQUE,
  grower_id uuid REFERENCES growers(id),
  product_info jsonb,
  quantity numeric(10,2),
  unit text DEFAULT 'tons',
  status text DEFAULT 'pending', -- pending, in_transit, delivered, rejected
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Checkpoints (tracking events)
CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consignment_id uuid NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  checkpoint_type text NOT NULL, -- 'pickup', 'weigh_in', 'quality_check', 'delivery'
  location text,
  timestamp timestamptz DEFAULT now(),
  data jsonb, -- flexible data for checkpoint details
  notes text,
  created_by uuid REFERENCES users(id)
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_consignments_tenant_booking ON consignments(tenant_id, booking_id);
CREATE INDEX IF NOT EXISTS idx_consignments_grower ON consignments(grower_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_consignment ON checkpoints(consignment_id);
CREATE INDEX IF NOT EXISTS idx_checkpoints_timestamp ON checkpoints(timestamp);