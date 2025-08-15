-- Domain events and business rules system
-- For event sourcing and business rule engine

-- Domain Events
CREATE TABLE IF NOT EXISTS domain_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_type text NOT NULL,
  aggregate_id uuid NOT NULL,
  aggregate_type text DEFAULT 'unknown',
  data jsonb NOT NULL,
  metadata jsonb,
  sequence_number bigserial,
  created_at timestamptz DEFAULT now()
);

-- Outbox Events (for reliable event delivery)
CREATE TABLE IF NOT EXISTS outbox_events (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  event_id uuid NOT NULL REFERENCES domain_events(id) ON DELETE CASCADE,
  destination text NOT NULL, -- webhook URL, queue name, etc.
  payload jsonb NOT NULL,
  status text DEFAULT 'pending', -- pending, sent, failed
  attempts integer DEFAULT 0,
  max_attempts integer DEFAULT 3,
  next_retry timestamptz,
  created_at timestamptz DEFAULT now(),
  sent_at timestamptz
);

-- Business Rules (JSON-based workflow)
CREATE TABLE IF NOT EXISTS rules (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  description text,
  rule_type text NOT NULL, -- 'validation', 'workflow', 'notification'
  conditions jsonb NOT NULL,
  actions jsonb NOT NULL,
  is_active boolean DEFAULT true,
  priority integer DEFAULT 0,
  created_at timestamptz DEFAULT now(),
  updated_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_domain_events_tenant_type ON domain_events(tenant_id, event_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_aggregate ON domain_events(aggregate_id, aggregate_type);
CREATE INDEX IF NOT EXISTS idx_domain_events_sequence ON domain_events(sequence_number);
CREATE INDEX IF NOT EXISTS idx_outbox_events_status ON outbox_events(status, next_retry);
CREATE INDEX IF NOT EXISTS idx_rules_tenant_active ON rules(tenant_id, is_active);