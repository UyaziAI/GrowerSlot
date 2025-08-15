-- Audit trail system for compliance and tracking
-- B17 implementation for admin action auditing

-- Audit Log
CREATE TABLE IF NOT EXISTS audit_log (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  user_id uuid REFERENCES users(id),
  action text NOT NULL, -- 'CREATE', 'UPDATE', 'DELETE', 'BLACKOUT', etc.
  resource_type text NOT NULL, -- 'slots', 'bookings', 'restrictions', etc.
  resource_id uuid,
  changes jsonb, -- before/after state or action details
  metadata jsonb, -- additional context (IP, user agent, etc.)
  timestamp timestamptz DEFAULT now()
);

-- Indexes for audit queries
CREATE INDEX IF NOT EXISTS idx_audit_log_tenant_user ON audit_log(tenant_id, user_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_resource ON audit_log(resource_type, resource_id);
CREATE INDEX IF NOT EXISTS idx_audit_log_timestamp ON audit_log(timestamp);
CREATE INDEX IF NOT EXISTS idx_audit_log_action ON audit_log(action);