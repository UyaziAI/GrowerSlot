-- Logistics: Consignments and Checkpoints

-- Consignments (logistics)
CREATE TABLE IF NOT EXISTS consignments (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  booking_id uuid NOT NULL REFERENCES bookings(id),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  consignment_number text NOT NULL,
  supplier_id uuid NOT NULL REFERENCES parties(id),
  transporter_id uuid REFERENCES parties(id),
  expected_quantity numeric(10,2),
  actual_quantity numeric(10,2),
  status text DEFAULT 'pending', -- pending, in_transit, delivered, rejected
  created_at timestamptz DEFAULT now()
);

-- Create indexes for consignments
CREATE INDEX IF NOT EXISTS consignments_booking_idx ON consignments(booking_id);
CREATE INDEX IF NOT EXISTS consignments_tenant_idx ON consignments(tenant_id);
CREATE INDEX IF NOT EXISTS consignments_status_idx ON consignments(status);

-- Checkpoints (tracking events)
CREATE TABLE IF NOT EXISTS checkpoints (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  consignment_id uuid NOT NULL REFERENCES consignments(id) ON DELETE CASCADE,
  type text NOT NULL, -- gate_in, weigh, quality_check, gate_out, delivered
  timestamp timestamptz DEFAULT now(),
  payload jsonb DEFAULT '{}', -- flexible event data
  created_by uuid REFERENCES users(id)
);

-- Create indexes for checkpoints
CREATE INDEX IF NOT EXISTS checkpoints_consignment_idx ON checkpoints(consignment_id);
CREATE INDEX IF NOT EXISTS checkpoints_type_idx ON checkpoints(type);
CREATE INDEX IF NOT EXISTS checkpoints_timestamp_idx ON checkpoints(timestamp);