-- Events and Rules: Domain Events and Outbox Pattern

-- Domain events (audit + webhook source)
CREATE TABLE IF NOT EXISTS domain_events (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_type text NOT NULL, -- BOOKING_CREATED, CONSIGNMENT_UPDATED, etc.
  aggregate_id uuid NOT NULL,
  payload jsonb NOT NULL,
  tenant_id uuid NOT NULL REFERENCES tenants(id),
  created_at timestamptz DEFAULT now()
);

-- Create indexes for domain events
CREATE INDEX IF NOT EXISTS domain_events_tenant_idx ON domain_events(tenant_id);
CREATE INDEX IF NOT EXISTS domain_events_type_idx ON domain_events(event_type);
CREATE INDEX IF NOT EXISTS domain_events_created_idx ON domain_events(created_at);

-- Outbox (reliable webhook delivery)
CREATE TABLE IF NOT EXISTS outbox (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  event_id uuid NOT NULL REFERENCES domain_events(id),
  webhook_url text NOT NULL,
  payload jsonb NOT NULL,
  status text DEFAULT 'pending', -- pending, sent, failed
  attempts int DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Create indexes for outbox
CREATE INDEX IF NOT EXISTS outbox_status_idx ON outbox(status);
CREATE INDEX IF NOT EXISTS outbox_created_idx ON outbox(created_at);

-- Rules and workflows (JSON configurations)
CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- quota, workflow, validation
  config jsonb NOT NULL,
  active boolean DEFAULT true,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Create indexes for rules
CREATE INDEX IF NOT EXISTS rules_tenant_idx ON rules(tenant_id);
CREATE INDEX IF NOT EXISTS rules_type_idx ON rules(type);
CREATE INDEX IF NOT EXISTS rules_active_idx ON rules(active);