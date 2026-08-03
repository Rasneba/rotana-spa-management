-- Migration v35: Adapted Spa & Gym access suite
-- Converted from the reusable access patterns in Rasneba/-geniouserp.
-- No parking, vehicle, ANPR, rate, payment, or embedded POS tables are used.

-- Enrich the existing Spa/Gym entry-gate table with optional controller metadata.
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS code VARCHAR(40);
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS direction VARCHAR(10) DEFAULT 'both';
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS ip_address VARCHAR(45);
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS port INTEGER;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS door_open_delay INTEGER DEFAULT 2;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS is_qr_enabled BOOLEAN DEFAULT true;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS is_nfc_enabled BOOLEAN DEFAULT false;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS is_rfid_enabled BOOLEAN DEFAULT true;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS controller_model VARCHAR(100);
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS last_seen_at TIMESTAMPTZ;
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS notes TEXT;

UPDATE entry_gates
SET code = COALESCE(NULLIF(code, ''), 'GATE-' || id),
    direction = COALESCE(direction, CASE gate_type WHEN 'entry' THEN 'in' WHEN 'exit' THEN 'out' ELSE 'both' END),
    status = CASE WHEN is_active THEN COALESCE(status, 'active') ELSE 'inactive' END
WHERE code IS NULL OR code = '' OR direction IS NULL OR status IS NULL;

CREATE UNIQUE INDEX IF NOT EXISTS idx_entry_gates_company_code
  ON entry_gates(company_id, code)
  WHERE code IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_entry_gates_company_status
  ON entry_gates(company_id, status);

-- Cameras are operational/security devices, not ANPR vehicle cameras.
CREATE TABLE IF NOT EXISTS access_cameras (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gate_id INTEGER REFERENCES entry_gates(id) ON DELETE SET NULL,
  facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL,
  name VARCHAR(120) NOT NULL,
  code VARCHAR(40) NOT NULL,
  purpose VARCHAR(30) NOT NULL DEFAULT 'security'
    CHECK (purpose IN ('security','occupancy','check_in','safety','other')),
  direction VARCHAR(10) NOT NULL DEFAULT 'both'
    CHECK (direction IN ('in','out','both')),
  protocol VARCHAR(20) NOT NULL DEFAULT 'http'
    CHECK (protocol IN ('http','rtsp','onvif','webcam')),
  ip_address VARCHAR(45),
  port INTEGER,
  stream_url TEXT,
  device_id TEXT,
  status VARCHAR(20) NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','offline','maintenance')),
  last_seen_at TIMESTAMPTZ,
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, code)
);

CREATE INDEX IF NOT EXISTS idx_access_cameras_company_status
  ON access_cameras(company_id, status);
CREATE INDEX IF NOT EXISTS idx_access_cameras_gate
  ON access_cameras(gate_id);
CREATE INDEX IF NOT EXISTS idx_access_cameras_facility
  ON access_cameras(facility_id);

-- Hardware relay implementations can poll pending commands. Creating a command
-- never assumes the physical door opened; a relay must acknowledge it.
CREATE TABLE IF NOT EXISTS access_device_commands (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gate_id INTEGER NOT NULL REFERENCES entry_gates(id) ON DELETE CASCADE,
  command VARCHAR(30) NOT NULL CHECK (command IN ('open','lock','unlock','sync')),
  status VARCHAR(20) NOT NULL DEFAULT 'pending'
    CHECK (status IN ('pending','processing','completed','failed','cancelled')),
  requested_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  requested_at TIMESTAMPTZ NOT NULL DEFAULT CURRENT_TIMESTAMP,
  completed_at TIMESTAMPTZ,
  response TEXT,
  metadata JSONB NOT NULL DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_access_commands_pending
  ON access_device_commands(company_id, status, requested_at)
  WHERE status IN ('pending','processing');

-- Link operational visits to a Spa/Gym area for capacity dashboards.
ALTER TABLE spa_visits ADD COLUMN IF NOT EXISTS facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spa_visits_facility_status
  ON spa_visits(facility_id, status, checked_in_at DESC);

-- Extend operational QR passes for walk-in kiosk use and access auditing.
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS guest_name VARCHAR(200);
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS guest_phone VARCHAR(50);
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS purpose VARCHAR(200);
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS visit_id BIGINT REFERENCES spa_visits(id) ON DELETE SET NULL;
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS gate_id INTEGER REFERENCES entry_gates(id) ON DELETE SET NULL;
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS issued_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS used_at TIMESTAMPTZ;
ALTER TABLE qr_passes ADD COLUMN IF NOT EXISTS qr_payload JSONB;

-- Add useful access-audit context without changing historical rows.
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS visit_id BIGINT REFERENCES spa_visits(id) ON DELETE SET NULL;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS qr_pass_id INTEGER REFERENCES qr_passes(id) ON DELETE SET NULL;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS reason VARCHAR(120);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS device_id VARCHAR(120);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS details JSONB NOT NULL DEFAULT '{}'::jsonb;

CREATE INDEX IF NOT EXISTS idx_access_logs_visit
  ON access_logs(visit_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_qr_pass
  ON access_logs(qr_pass_id, created_at DESC);

CREATE OR REPLACE FUNCTION set_access_suite_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS trg_access_cameras_updated_at ON access_cameras;
CREATE TRIGGER trg_access_cameras_updated_at
  BEFORE UPDATE ON access_cameras
  FOR EACH ROW EXECUTE FUNCTION set_access_suite_updated_at();

-- Add permissions for the adapted screens only.
DO $$
DECLARE
  role_record RECORD;
  resource_name TEXT;
  resources TEXT[] := ARRAY[
    'access_zones', 'access_cameras', 'access_control',
    'access_kiosk', 'reports_access'
  ];
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager') LOOP
    FOREACH resource_name IN ARRAY resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (
        role_record.id,
        resource_name,
        true,
        true,
        true,
        role_record.name = 'admin',
        role_record.name IN ('admin','manager')
      )
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END LOOP;
END $$;

DO $$
DECLARE
  receptionist_role_id INTEGER;
  resource_name TEXT;
  resources TEXT[] := ARRAY['access_control','access_kiosk'];
BEGIN
  SELECT id INTO receptionist_role_id FROM roles WHERE name='receptionist' LIMIT 1;
  IF receptionist_role_id IS NOT NULL THEN
    FOREACH resource_name IN ARRAY resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (receptionist_role_id, resource_name, true, true, true, false, false)
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END IF;
END $$;
