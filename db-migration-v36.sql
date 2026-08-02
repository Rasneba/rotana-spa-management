-- Migration v36: Canonical customer and offering masters
-- A member is a classified customer. Membership plans, Spa/Gym services,
-- packages and access passes are classified records in one Offering Master.
-- Legacy tables remain read-compatible but are no longer separate navigation masters.

-- One customer/member record, classified rather than duplicated.
ALTER TABLE membership_members ADD COLUMN IF NOT EXISTS classification VARCHAR(30) DEFAULT 'member';
ALTER TABLE membership_members DROP CONSTRAINT IF EXISTS membership_members_classification_check;
ALTER TABLE membership_members ADD CONSTRAINT membership_members_classification_check
  CHECK (classification IN ('customer','member','vip','corporate','guest'));
UPDATE membership_members SET classification='member' WHERE classification IS NULL;

-- Canonical offering links. spa_management_records stores the classified master.
ALTER TABLE membership_members ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE subscriptions ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE spa_appointments ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;
ALTER TABLE spa_visit_services ADD COLUMN IF NOT EXISTS offering_id BIGINT REFERENCES spa_management_records(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_membership_members_offering ON membership_members(offering_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_offering ON subscriptions(offering_id);
CREATE INDEX IF NOT EXISTS idx_spa_appointments_offering ON spa_appointments(offering_id);
CREATE INDEX IF NOT EXISTS idx_spa_visit_services_offering ON spa_visit_services(offering_id);
CREATE INDEX IF NOT EXISTS idx_catalog_offering_classification
  ON spa_management_records(company_id, (details->>'classification'))
  WHERE module_key='catalog/offerings' AND deleted_at IS NULL;
CREATE UNIQUE INDEX IF NOT EXISTS idx_catalog_offering_code_unique
  ON spa_management_records(company_id, LOWER(details->>'offering_code'))
  WHERE module_key='catalog/offerings' AND deleted_at IS NULL;

-- Membership plans become classification=membership_plan.
INSERT INTO spa_management_records
  (company_id, module_key, record_code, title, status, record_date, details, created_at, updated_at)
SELECT
  p.company_id,
  'catalog/offerings',
  'CAT-MP-' || p.id,
  p.name,
  CASE WHEN COALESCE(p.is_active,true) THEN 'active' ELSE 'inactive' END,
  p.created_at,
  jsonb_build_object(
    'offering_name', p.name,
    'offering_code', 'MP-' || p.id,
    'classification', 'membership_plan',
    'category', COALESCE(p.type,'general'),
    'duration_minutes', NULL,
    'validity_days', COALESCE(p.duration_days,30),
    'usage_limit', p.max_members,
    'included_offerings', NULL,
    'description', p.description
  ),
  COALESCE(p.created_at,CURRENT_TIMESTAMP),
  COALESCE(p.updated_at,p.created_at,CURRENT_TIMESTAMP)
FROM membership_plans p
ON CONFLICT (company_id, module_key, record_code) DO NOTHING;

-- Existing operational Spa services become classification=spa_service.
INSERT INTO spa_management_records
  (company_id, module_key, record_code, title, status, record_date, details,
   created_by, updated_by, created_at, updated_at)
SELECT
  r.company_id,
  'catalog/offerings',
  'CAT-SVC-' || r.id,
  r.title,
  CASE WHEN r.status IN ('active','inactive','draft','retired') THEN r.status ELSE 'active' END,
  r.record_date,
  jsonb_build_object(
    'offering_name', r.title,
    'offering_code', COALESCE(NULLIF(r.details->>'service_code',''), 'SVC-' || r.id),
    'classification', 'spa_service',
    'category', r.details->>'category',
    'duration_minutes', NULLIF(r.details->>'duration_minutes','')::numeric,
    'validity_days', NULL,
    'usage_limit', NULL,
    'included_offerings', NULL,
    'description', r.details->>'description'
  ),
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at
FROM spa_management_records r
WHERE r.module_key='spa/services' AND r.deleted_at IS NULL
ON CONFLICT (company_id, module_key, record_code) DO NOTHING;

-- Existing packages become classification=package.
INSERT INTO spa_management_records
  (company_id, module_key, record_code, title, status, record_date, details,
   created_by, updated_by, created_at, updated_at)
SELECT
  r.company_id,
  'catalog/offerings',
  'CAT-PKG-' || r.id,
  r.title,
  CASE WHEN r.status IN ('active','inactive','draft','retired') THEN r.status ELSE 'active' END,
  r.record_date,
  jsonb_build_object(
    'offering_name', r.title,
    'offering_code', COALESCE(NULLIF(r.details->>'package_code',''), 'PKG-' || r.id),
    'classification', 'package',
    'category', 'spa_package',
    'duration_minutes', NULL,
    'validity_days', NULLIF(r.details->>'validity_days','')::numeric,
    'usage_limit', NULLIF(r.details->>'max_uses','')::numeric,
    'included_offerings', r.details->>'included_services',
    'description', r.details->>'description'
  ),
  r.created_by,
  r.updated_by,
  r.created_at,
  r.updated_at
FROM spa_management_records r
WHERE r.module_key='spa/packages' AND r.deleted_at IS NULL
ON CONFLICT (company_id, module_key, record_code) DO NOTHING;

-- Legacy rate-card names/durations are imported as services; all financial
-- columns are intentionally ignored because pricing belongs to the separate POS.
INSERT INTO spa_management_records
  (company_id, module_key, record_code, title, status, record_date, details, created_at, updated_at)
SELECT
  r.company_id,
  'catalog/offerings',
  'CAT-RATE-' || r.id,
  r.name,
  CASE WHEN COALESCE(r.is_active,true) THEN 'active' ELSE 'inactive' END,
  r.created_at,
  jsonb_build_object(
    'offering_name', r.name,
    'offering_code', 'SVC-' || r.id,
    'classification', CASE WHEN r.service_type='membership' THEN 'membership_plan' ELSE 'spa_service' END,
    'category', r.service_type,
    'duration_minutes', r.duration_minutes,
    'validity_days', NULL,
    'usage_limit', NULL,
    'included_offerings', NULL,
    'description', NULL
  ),
  COALESCE(r.created_at,CURRENT_TIMESTAMP),
  COALESCE(r.updated_at,r.created_at,CURRENT_TIMESTAMP)
FROM rate_cards r
ON CONFLICT (company_id, module_key, record_code) DO NOTHING;

-- Link existing operational records to their canonical offering.
UPDATE membership_members m
SET offering_id=o.id
FROM spa_management_records o
WHERE m.plan_id IS NOT NULL
  AND o.company_id=m.company_id
  AND o.module_key='catalog/offerings'
  AND o.record_code='CAT-MP-' || m.plan_id
  AND m.offering_id IS NULL;

UPDATE subscriptions s
SET offering_id=o.id
FROM spa_management_records o
WHERE s.plan_id IS NOT NULL
  AND o.company_id=s.company_id
  AND o.module_key='catalog/offerings'
  AND o.record_code='CAT-MP-' || s.plan_id
  AND s.offering_id IS NULL;

UPDATE spa_appointments a
SET offering_id=o.id
FROM spa_management_records o
WHERE a.rate_card_id IS NOT NULL
  AND o.company_id=a.company_id
  AND o.module_key='catalog/offerings'
  AND o.record_code='CAT-RATE-' || a.rate_card_id
  AND a.offering_id IS NULL;

UPDATE spa_visit_services vs
SET offering_id=o.id
FROM spa_management_records o
WHERE o.company_id=vs.company_id
  AND o.module_key='catalog/offerings'
  AND o.record_code='CAT-SVC-' || vs.service_record_id
  AND vs.offering_id IS NULL;

-- New canonical master permission.
DO $$
DECLARE
  role_record RECORD;
BEGIN
  FOR role_record IN SELECT id, name FROM roles WHERE name IN ('admin','manager','receptionist') LOOP
    INSERT INTO role_permissions
      (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES (
      role_record.id,
      'catalog_offerings',
      true,
      role_record.name IN ('admin','manager'),
      role_record.name IN ('admin','manager'),
      role_record.name='admin',
      false
    )
    ON CONFLICT (role_id, resource) DO NOTHING;
  END LOOP;
END $$;

-- Retire permissions for duplicate/removed masters and removed parking-style views.
DELETE FROM role_permissions
WHERE resource IN (
  'access_dashboard', 'access_slots', 'membership_plans',
  'membership_rate_cards', 'spa_services', 'spa_packages'
);

UPDATE modules
SET description='Unified customers, classified offerings, visits, Spa/Gym access, inventory and operational reports'
WHERE code='membership';
