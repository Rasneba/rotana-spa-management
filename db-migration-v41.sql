-- Migration v41: Spa Sales POS + AddisPay handoff
-- Converts therapist service orders into priced cashier sales.

CREATE TABLE IF NOT EXISTS spa_sales_orders (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_order_id BIGINT NOT NULL REFERENCES spa_service_orders(id) ON DELETE RESTRICT,
  visit_id BIGINT REFERENCES spa_visits(id) ON DELETE SET NULL,
  invoice_no VARCHAR(80) NOT NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(60),
  cashier_id INTEGER REFERENCES users(id) ON DELETE SET NULL,
  line_items JSONB NOT NULL DEFAULT '[]'::jsonb,
  subtotal NUMERIC(14,2) NOT NULL DEFAULT 0,
  discount NUMERIC(14,2) NOT NULL DEFAULT 0,
  tax NUMERIC(14,2) NOT NULL DEFAULT 0,
  total NUMERIC(14,2) NOT NULL DEFAULT 0,
  payment_method VARCHAR(30) DEFAULT 'cash' CHECK (payment_method IN ('cash','card','bank_transfer','mobile_money','addispay','mixed')),
  payment_status VARCHAR(30) NOT NULL DEFAULT 'unpaid' CHECK (payment_status IN ('unpaid','pending','paid','failed','refunded','void')),
  order_status VARCHAR(30) NOT NULL DEFAULT 'open' CHECK (order_status IN ('open','completed','void')),
  tx_ref VARCHAR(120),
  addispay_uuid VARCHAR(200),
  addispay_checkout_url TEXT,
  payment_reference VARCHAR(200),
  paid_at TIMESTAMPTZ,
  notes TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, invoice_no),
  UNIQUE(service_order_id)
);

CREATE INDEX IF NOT EXISTS idx_spa_sales_orders_company_status ON spa_sales_orders(company_id, payment_status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_spa_sales_orders_tx_ref ON spa_sales_orders(tx_ref);
CREATE INDEX IF NOT EXISTS idx_spa_sales_orders_addispay_uuid ON spa_sales_orders(addispay_uuid);

CREATE TABLE IF NOT EXISTS spa_sales_payments (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_order_id BIGINT NOT NULL REFERENCES spa_sales_orders(id) ON DELETE CASCADE,
  amount NUMERIC(14,2) NOT NULL,
  method VARCHAR(30) NOT NULL CHECK (method IN ('cash','card','bank_transfer','mobile_money','addispay','mixed')),
  reference VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'paid' CHECK (status IN ('pending','paid','failed','refunded','void')),
  provider_response JSONB,
  paid_by VARCHAR(200),
  paid_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spa_sales_payments_order ON spa_sales_payments(sale_order_id, paid_at DESC);
CREATE INDEX IF NOT EXISTS idx_spa_sales_payments_company ON spa_sales_payments(company_id, paid_at DESC);

CREATE OR REPLACE FUNCTION set_spa_sales_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spa_sales_orders_updated_at ON spa_sales_orders;
CREATE TRIGGER trg_spa_sales_orders_updated_at BEFORE UPDATE ON spa_sales_orders FOR EACH ROW EXECUTE FUNCTION set_spa_sales_updated_at();

DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    INSERT INTO role_permissions
      (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      role_record.id,
      'spa_sales',
      true,
      true,
      true,
      role_record.name='admin',
      role_record.name IN ('admin','manager')
    )
    ON CONFLICT (role_id, resource) DO UPDATE SET
      can_view=true,
      can_create=true,
      can_edit=true;
  END LOOP;
END $$;
