-- Migration v32: Spa appointment scheduling
-- Adds the operational calendar used by Spa Schedule. Appointments can be made
-- for a member or a walk-in guest and are always isolated by company.

CREATE TABLE IF NOT EXISTS spa_appointments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES membership_members(id) ON DELETE SET NULL,
  facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL,
  rate_card_id INTEGER REFERENCES rate_cards(id) ON DELETE SET NULL,
  guest_name VARCHAR(200),
  guest_phone VARCHAR(50),
  service_name VARCHAR(200) NOT NULL,
  starts_at TIMESTAMP NOT NULL,
  ends_at TIMESTAMP NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'confirmed'
    CHECK (status IN ('confirmed', 'checked_in', 'completed', 'no_show', 'cancelled')),
  notes TEXT,
  created_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT spa_appointments_time_range CHECK (ends_at > starts_at),
  CONSTRAINT spa_appointments_guest_or_member CHECK (member_id IS NOT NULL OR guest_name IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_spa_appointments_company_start
  ON spa_appointments(company_id, starts_at);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_facility_start
  ON spa_appointments(facility_id, starts_at)
  WHERE status NOT IN ('cancelled', 'no_show');
CREATE INDEX IF NOT EXISTS idx_spa_appointments_member
  ON spa_appointments(member_id, starts_at DESC);

DROP TRIGGER IF EXISTS trg_spa_appointments_updated_at ON spa_appointments;
CREATE TRIGGER trg_spa_appointments_updated_at
  BEFORE UPDATE ON spa_appointments
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Give existing operational roles an appropriate baseline. Company-specific
-- custom role permissions are deliberately left unchanged.
INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
SELECT id, 'membership_appointments', true, true, true, true, false
FROM roles
WHERE name IN ('manager', 'receptionist')
ON CONFLICT (role_id, resource) DO NOTHING;
