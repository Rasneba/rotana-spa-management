-- Migration v37: Therapist-oriented Spa booking board
-- Appointments keep their existing calendar. Spa bookings are a separate view
-- and workflow in the same scheduling table, classified by booking_kind.

ALTER TABLE spa_appointments ADD COLUMN IF NOT EXISTS booking_kind VARCHAR(20) DEFAULT 'appointment';
ALTER TABLE spa_appointments DROP CONSTRAINT IF EXISTS spa_appointments_booking_kind_check;
ALTER TABLE spa_appointments ADD CONSTRAINT spa_appointments_booking_kind_check
  CHECK (booking_kind IN ('appointment','spa_booking'));

ALTER TABLE spa_appointments ADD COLUMN IF NOT EXISTS therapist_record_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE spa_appointments ADD COLUMN IF NOT EXISTS therapist_name VARCHAR(200);

UPDATE spa_appointments SET booking_kind='appointment' WHERE booking_kind IS NULL;

CREATE INDEX IF NOT EXISTS idx_spa_bookings_therapist_time
  ON spa_appointments(company_id, therapist_record_id, starts_at, ends_at)
  WHERE booking_kind='spa_booking' AND status NOT IN ('cancelled','no_show');
CREATE INDEX IF NOT EXISTS idx_spa_bookings_day
  ON spa_appointments(company_id, booking_kind, starts_at);

DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    INSERT INTO role_permissions
      (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      role_record.id,
      'spa_bookings',
      true,
      true,
      true,
      role_record.name='admin',
      false
    )
    ON CONFLICT (role_id, resource) DO NOTHING;
  END LOOP;
END $$;
