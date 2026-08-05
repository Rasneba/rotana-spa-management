-- Migration v42: Enhanced membership subscriptions from subscription workflow
-- Adds payment metadata, QR pass payloads, freeze/renew support and useful audit fields.

ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_method VARCHAR(40) DEFAULT 'cash';
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS payment_reference VARCHAR(200);
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS qr_code TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS qr_image TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS freeze_start DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS freeze_end DATE;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS notes TEXT;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS created_by INTEGER REFERENCES users(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS renewed_from_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;

ALTER TABLE subscriptions DROP CONSTRAINT IF EXISTS subscriptions_status_check;
ALTER TABLE subscriptions ADD CONSTRAINT subscriptions_status_check
  CHECK (status IN ('active','expired','cancelled','suspended','frozen','pending'));

CREATE INDEX IF NOT EXISTS idx_subscriptions_qr_code ON subscriptions(qr_code);
CREATE INDEX IF NOT EXISTS idx_subscriptions_freeze ON subscriptions(company_id, freeze_start, freeze_end);
CREATE INDEX IF NOT EXISTS idx_subscriptions_payment_method ON subscriptions(company_id, payment_method, created_at DESC);

DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    INSERT INTO role_permissions
      (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      role_record.id,
      'membership_subscriptions',
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
