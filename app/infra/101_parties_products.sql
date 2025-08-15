-- Extensibility: Parties and Products system
-- For future expansion beyond growers/cultivars

-- Parties (generic entity system)
CREATE TABLE IF NOT EXISTS parties (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  type text NOT NULL, -- 'grower', 'transporter', 'inspector', etc.
  contact_info jsonb,
  address_info jsonb,
  created_at timestamptz DEFAULT now()
);

-- Products (generic product system)
CREATE TABLE IF NOT EXISTS products (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  category text, -- 'macadamia', 'avocado', etc.
  attributes jsonb, -- flexible attributes
  created_at timestamptz DEFAULT now()
);

-- Product variants (cultivars, grades, etc.)
CREATE TABLE IF NOT EXISTS product_variants (
  id uuid PRIMARY KEY DEFAULT uuid_generate_v4(),
  product_id uuid NOT NULL REFERENCES products(id) ON DELETE CASCADE,
  tenant_id uuid NOT NULL REFERENCES tenants(id) ON DELETE CASCADE,
  name text NOT NULL,
  attributes jsonb,
  created_at timestamptz DEFAULT now()
);

-- Indexes
CREATE INDEX IF NOT EXISTS idx_parties_tenant_type ON parties(tenant_id, type);
CREATE INDEX IF NOT EXISTS idx_products_tenant_category ON products(tenant_id, category);
CREATE INDEX IF NOT EXISTS idx_product_variants_product ON product_variants(product_id);