-- Migration v34: Operational visits and draft service-order handoff
--
-- IMPORTANT ARCHITECTURE BOUNDARY
-- The Spa application does not create invoices, calculate tax, accept payment,
-- or connect to the separate Sales/POS database. A service order is an
-- operational, non-financial draft that lists treatments performed so the
-- customer can hand a printed slip to the cashier.

CREATE TABLE IF NOT EXISTS spa_visit_counters (
  company_id INTEGER PRIMARY KEY REFERENCES companies(id) ON DELETE CASCADE,
  current_value BIGINT NOT NULL DEFAULT 0,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS spa_visits (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  visit_no VARCHAR(40) NOT NULL,
  member_id INTEGER REFERENCES membership_members(id) ON DELETE SET NULL,
  appointment_id INTEGER REFERENCES spa_appointments(id) ON DELETE SET NULL,
  customer_name VARCHAR(200) NOT NULL,
  customer_phone VARCHAR(50),
  therapist_record_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL,
  therapist_name VARCHAR(200),
  status VARCHAR(30) NOT NULL DEFAULT 'checked_in'
    CHECK (status IN ('checked_in','assigned','in_treatment','finished','order_printed','handed_to_cashier','cancelled')),
  checked_in_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  treatment_started_at TIMESTAMPTZ,
  finished_at TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, visit_no)
);

CREATE INDEX IF NOT EXISTS idx_spa_visits_company_status
  ON spa_visits(company_id, status, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_spa_visits_member
  ON spa_visits(member_id, checked_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_spa_visits_therapist
  ON spa_visits(therapist_record_id, checked_in_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_spa_visits_appointment_unique
  ON spa_visits(company_id, appointment_id)
  WHERE appointment_id IS NOT NULL;

CREATE TABLE IF NOT EXISTS spa_visit_services (
  id BIGSERIAL PRIMARY KEY,
  visit_id BIGINT NOT NULL REFERENCES spa_visits(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  service_record_id BIGINT NOT NULL REFERENCES spa_management_records(id) ON DELETE RESTRICT,
  service_code VARCHAR(100),
  service_name VARCHAR(240) NOT NULL,
  quantity INTEGER NOT NULL DEFAULT 1 CHECK (quantity > 0),
  notes TEXT,
  added_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(visit_id, service_record_id)
);

CREATE INDEX IF NOT EXISTS idx_spa_visit_services_visit
  ON spa_visit_services(visit_id, created_at);
CREATE INDEX IF NOT EXISTS idx_spa_visit_services_service
  ON spa_visit_services(company_id, service_record_id, created_at DESC);

CREATE TABLE IF NOT EXISTS spa_service_orders (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  visit_id BIGINT NOT NULL UNIQUE REFERENCES spa_visits(id) ON DELETE CASCADE,
  order_no VARCHAR(60) NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','printed','handed_to_cashier','void')),
  total_items INTEGER NOT NULL DEFAULT 0 CHECK (total_items >= 0),
  service_snapshot JSONB NOT NULL DEFAULT '{}'::jsonb,
  generated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  generated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  printed_at TIMESTAMPTZ,
  printed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  print_count INTEGER NOT NULL DEFAULT 0 CHECK (print_count >= 0),
  handed_to_cashier_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, order_no),
  CONSTRAINT spa_service_orders_snapshot_object CHECK (jsonb_typeof(service_snapshot) = 'object')
);

CREATE INDEX IF NOT EXISTS idx_spa_service_orders_company_status
  ON spa_service_orders(company_id, status, generated_at DESC);
CREATE INDEX IF NOT EXISTS idx_spa_service_orders_printed
  ON spa_service_orders(company_id, printed_at DESC)
  WHERE printed_at IS NOT NULL;

CREATE OR REPLACE FUNCTION set_spa_visit_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spa_visits_updated_at ON spa_visits;
CREATE TRIGGER trg_spa_visits_updated_at
  BEFORE UPDATE ON spa_visits
  FOR EACH ROW EXECUTE FUNCTION set_spa_visit_updated_at();

DROP TRIGGER IF EXISTS trg_spa_visit_services_updated_at ON spa_visit_services;
CREATE TRIGGER trg_spa_visit_services_updated_at
  BEFORE UPDATE ON spa_visit_services
  FOR EACH ROW EXECUTE FUNCTION set_spa_visit_updated_at();

DROP TRIGGER IF EXISTS trg_spa_service_orders_updated_at ON spa_service_orders;
CREATE TRIGGER trg_spa_service_orders_updated_at
  BEFORE UPDATE ON spa_service_orders
  FOR EACH ROW EXECUTE FUNCTION set_spa_visit_updated_at();

-- Add operational permissions without granting any payment, tax, invoice or POS capability.
DO $$
DECLARE
  role_record RECORD;
  resource_name TEXT;
  operational_resources TEXT[] := ARRAY[
    'spa_visits', 'spa_visit_services', 'spa_service_orders',
    'spa_towels', 'reports_service_orders'
  ];
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin', 'manager') LOOP
    FOREACH resource_name IN ARRAY operational_resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (
        role_record.id,
        resource_name,
        true,
        true,
        true,
        role_record.name = 'admin',
        role_record.name IN ('admin', 'manager')
      )
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  role_record RECORD;
  resource_name TEXT;
  selected_resources TEXT[];
  front_desk_resources TEXT[] := ARRAY['spa_visits', 'spa_service_orders', 'spa_towels'];
  therapist_resources TEXT[] := ARRAY['spa_visits', 'spa_visit_services', 'spa_service_orders', 'spa_therapists', 'spa_services', 'inventory_stock_usage', 'spa_towels'];
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('receptionist', 'therapist') LOOP
    selected_resources := CASE
      WHEN role_record.name = 'therapist' THEN therapist_resources
      ELSE front_desk_resources
    END;
    FOREACH resource_name IN ARRAY selected_resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (
        role_record.id,
        resource_name,
        true,
        resource_name NOT IN ('spa_therapists', 'spa_services'),
        resource_name NOT IN ('spa_therapists', 'spa_services'),
        false,
        false
      )
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;
