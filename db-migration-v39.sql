-- Migration v39: Website request approval into therapist bookings + notification preference/outbox

ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS notification_channel VARCHAR(20) DEFAULT 'phone'
  CHECK (notification_channel IN ('phone','sms','telegram','whatsapp','email'));
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS notification_contact VARCHAR(200);
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS assigned_therapist_record_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS assigned_offering_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS assigned_facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL;
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS appointment_id INTEGER REFERENCES spa_appointments(id) ON DELETE SET NULL;
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS notification_status VARCHAR(30) DEFAULT 'not_sent'
  CHECK (notification_status IN ('not_sent','queued','sent','failed','manual_required'));
ALTER TABLE website_booking_requests ADD COLUMN IF NOT EXISTS notification_message TEXT;

ALTER TABLE spa_appointments ADD COLUMN IF NOT EXISTS website_request_id BIGINT REFERENCES website_booking_requests(id) ON DELETE SET NULL;
CREATE INDEX IF NOT EXISTS idx_spa_appointments_website_request ON spa_appointments(website_request_id);

CREATE TABLE IF NOT EXISTS notification_outbox (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  website_request_id BIGINT REFERENCES website_booking_requests(id) ON DELETE CASCADE,
  appointment_id INTEGER REFERENCES spa_appointments(id) ON DELETE SET NULL,
  channel VARCHAR(20) NOT NULL CHECK (channel IN ('sms','telegram','whatsapp','email','phone')),
  recipient VARCHAR(200) NOT NULL,
  subject VARCHAR(200),
  message TEXT NOT NULL,
  status VARCHAR(30) NOT NULL DEFAULT 'queued' CHECK (status IN ('queued','sent','failed','manual_required')),
  provider_response TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  sent_at TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_notification_outbox_company_status
  ON notification_outbox(company_id, status, created_at DESC);

DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    INSERT INTO role_permissions
      (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      role_record.id,
      'website_requests',
      true,
      false,
      true,
      role_record.name = 'admin',
      true
    )
    ON CONFLICT (role_id, resource) DO UPDATE SET
      can_view = true,
      can_edit = true,
      can_approve = true;
  END LOOP;
END $$;
