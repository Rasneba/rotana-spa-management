-- Migration v40: Hardware access relay + subscription-backed RFID verification
-- Adds the small compatibility layer needed by Dagi Spa hardware relays.

ALTER TABLE rfid_cards ADD COLUMN IF NOT EXISTS last_used_at TIMESTAMPTZ;
ALTER TABLE rfid_cards ADD COLUMN IF NOT EXISTS label VARCHAR(120);

ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS relay_device_id VARCHAR(120);
ALTER TABLE entry_gates ADD COLUMN IF NOT EXISTS relay_api_url TEXT;

ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS door_opened BOOLEAN DEFAULT false;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS days_remaining INTEGER DEFAULT 0;
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS device_id VARCHAR(120);
ALTER TABLE access_logs ADD COLUMN IF NOT EXISTS direction VARCHAR(10);

CREATE INDEX IF NOT EXISTS idx_access_logs_subscription ON access_logs(subscription_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_card_uid ON access_logs(company_id, card_uid, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_last_used ON rfid_cards(company_id, last_used_at DESC);

DO $$
DECLARE
  role_record RECORD;
  resource_name TEXT;
  resources TEXT[] := ARRAY[
    'membership_gates', 'membership_rfid_cards', 'membership_access_logs',
    'membership_subscriptions', 'access_control', 'access_kiosk'
  ];
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    FOREACH resource_name IN ARRAY resources LOOP
      INSERT INTO role_permissions
        (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (
        role_record.id,
        resource_name,
        true,
        role_record.name <> 'receptionist' OR resource_name IN ('access_control','access_kiosk'),
        role_record.name <> 'receptionist' OR resource_name IN ('access_control','access_kiosk'),
        role_record.name = 'admin',
        role_record.name IN ('admin','manager')
      )
      ON CONFLICT (role_id, resource) DO UPDATE SET
        can_view = role_permissions.can_view OR EXCLUDED.can_view,
        can_create = role_permissions.can_create OR EXCLUDED.can_create,
        can_edit = role_permissions.can_edit OR EXCLUDED.can_edit;
    END LOOP;
  END LOOP;
END $$;
