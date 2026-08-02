-- Migration v33: Complete spa management workspaces
-- Adds a secure, tenant-scoped operational record store used by the new
-- Customers, Gym, Spa, Inventory, Staff, Facilities and Settings
-- workspaces. Shared columns keep reporting fast while module-specific fields
-- remain in validated JSONB payloads.

CREATE TABLE IF NOT EXISTS spa_management_records (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_key VARCHAR(100) NOT NULL,
  record_code VARCHAR(80) NOT NULL,
  title VARCHAR(240) NOT NULL,
  status VARCHAR(40) NOT NULL DEFAULT 'active',
  record_date TIMESTAMPTZ,
  amount NUMERIC(14,2),
  details JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  updated_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  deleted_at TIMESTAMPTZ,
  CONSTRAINT spa_management_records_details_object
    CHECK (jsonb_typeof(details) = 'object'),
  CONSTRAINT spa_management_records_company_code_unique
    UNIQUE (company_id, module_key, record_code)
);

CREATE INDEX IF NOT EXISTS idx_spa_management_records_company_module
  ON spa_management_records(company_id, module_key, created_at DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spa_management_records_status
  ON spa_management_records(company_id, module_key, status)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spa_management_records_date
  ON spa_management_records(company_id, module_key, record_date DESC)
  WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_spa_management_records_details
  ON spa_management_records USING GIN(details);

CREATE OR REPLACE FUNCTION set_spa_management_record_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_spa_management_records_updated_at ON spa_management_records;
CREATE TRIGGER trg_spa_management_records_updated_at
  BEFORE UPDATE ON spa_management_records
  FOR EACH ROW EXECUTE FUNCTION set_spa_management_record_updated_at();

-- The membership license now represents the complete spa operations suite.
UPDATE modules
SET name = 'Spa Management',
    description = 'Customers, memberships, gym, spa, inventory, staff, facilities and operational reports',
    icon = 'bi-flower1'
WHERE code = 'membership';

-- Standard administrators receive all new resources. Existing custom roles are
-- not changed; administrators can grant those permissions from Roles & Permissions.
DO $$
DECLARE
  role_record RECORD;
  resource_name TEXT;
  all_resources TEXT[] := ARRAY[
    'spa_medical_records', 'spa_loyalty', 'membership_freeze_transfer',
    'spa_queue', 'spa_customer_requests',
    'gym_trainers', 'gym_workout_plans', 'gym_fitness_assessments',
    'gym_body_measurements', 'gym_classes',
    'spa_services', 'spa_therapists', 'spa_packages',
    'inventory_products', 'inventory_consumables', 'inventory_stock_usage',
    'inventory_suppliers',
    'staff_employees', 'staff_schedules', 'staff_commission', 'staff_performance',
    'facilities_lockers', 'facilities_equipment', 'facilities_maintenance',
    'settings_branches',
    'reports_membership', 'reports_attendance',
    'reports_therapist', 'reports_trainer', 'reports_inventory'
  ];
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin', 'manager') LOOP
    FOREACH resource_name IN ARRAY all_resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES
        (
          role_record.id,
          resource_name,
          true,
          true,
          true,
          role_record.name = 'admin',
          true
        )
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

-- Front desk users receive operational access without destructive actions.
DO $$
DECLARE
  receptionist_role_id INTEGER;
  resource_name TEXT;
  front_desk_resources TEXT[] := ARRAY[
    'spa_medical_records', 'spa_loyalty', 'membership_freeze_transfer',
    'spa_queue', 'spa_customer_requests', 'gym_classes',
    'spa_services', 'spa_therapists', 'spa_packages',
    'facilities_lockers'
  ];
BEGIN
  SELECT id INTO receptionist_role_id FROM roles WHERE name = 'receptionist' LIMIT 1;
  IF receptionist_role_id IS NOT NULL THEN
    FOREACH resource_name IN ARRAY front_desk_resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES
        (receptionist_role_id, resource_name, true, true, true, false, false)
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END IF;
END $$;
