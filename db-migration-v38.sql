-- Migration v38: Dagi Spa public website and booking requests
-- Public requests require staff confirmation and do not create appointments or payments.

CREATE TABLE IF NOT EXISTS website_booking_requests (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(40) NOT NULL,
  email VARCHAR(200),
  branch VARCHAR(120) NOT NULL,
  treatment VARCHAR(160) NOT NULL,
  preferred_at TIMESTAMP NOT NULL,
  notes TEXT,
  staff_notes TEXT,
  locale VARCHAR(10) DEFAULT 'en',
  source VARCHAR(40) DEFAULT 'public_website',
  status VARCHAR(30) NOT NULL DEFAULT 'new' CHECK (status IN ('new','contacted','confirmed','declined','archived')),
  confirmed_by INTEGER REFERENCES users(id) ON DELETE SET NULL,
  confirmed_at TIMESTAMP,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_website_booking_requests_company_status
  ON website_booking_requests(company_id, status, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_website_booking_requests_preferred
  ON website_booking_requests(company_id, preferred_at DESC);

DROP TRIGGER IF EXISTS trg_website_booking_requests_updated_at ON website_booking_requests;
CREATE TRIGGER trg_website_booking_requests_updated_at
  BEFORE UPDATE ON website_booking_requests
  FOR EACH ROW EXECUTE FUNCTION set_updated_at();

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
      role_record.name IN ('admin','manager')
    )
    ON CONFLICT (role_id, resource) DO UPDATE SET
      can_view = EXCLUDED.can_view,
      can_edit = EXCLUDED.can_edit,
      can_delete = role_permissions.can_delete OR EXCLUDED.can_delete,
      can_approve = role_permissions.can_approve OR EXCLUDED.can_approve;
  END LOOP;
END $$;

UPDATE settings SET value='Dagi Spa' WHERE key='company_name' AND value ILIKE '%Rotana%';
UPDATE settings SET value='dagispainfo@gmail.com' WHERE key='company_email' AND value ILIKE '%rotanaspa%';

UPDATE companies
SET name = CASE WHEN name ILIKE '%Rotana%' THEN 'Dagi Spa' ELSE name END,
    code = CASE WHEN code = 'CMP-ROTANA' THEN 'CMP-DAGI' ELSE code END,
    contact_email = CASE WHEN contact_email ILIKE '%rotanaspa%' THEN 'dagispainfo@gmail.com' ELSE contact_email END,
    website = COALESCE(NULLIF(website, ''), 'https://dagispa.com')
WHERE name ILIKE '%Rotana%' OR code='CMP-ROTANA' OR contact_email ILIKE '%rotanaspa%';
