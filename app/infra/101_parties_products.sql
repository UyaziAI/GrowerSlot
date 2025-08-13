-- Extensibility: Parties and Products

-- Parties (generic stakeholders)
CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- 'grower','transporter','buyer','warehouse'
  contact jsonb DEFAULT '{}'
);

-- Create index for parties
CREATE INDEX IF NOT EXISTS parties_tenant_type_idx ON parties(tenant_id, type);

-- Products and variants (map cultivars later)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  variant text,
  category text
);

-- Create index for products
CREATE INDEX IF NOT EXISTS products_tenant_idx ON products(tenant_id);

-- Create a view to maintain compatibility with existing growers table
CREATE OR REPLACE VIEW growers_v AS
SELECT 
  id,
  tenant_id,
  name,
  contact->>'email' as contact,
  'grower' as role
FROM parties 
WHERE type = 'grower';