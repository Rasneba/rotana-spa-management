-- Dagi Spa - Complete Database Schema Migration
-- Core + Membership (plans, members, payments, attendance, gym check-ins)
-- No HRMS, no parking, no stock, no sales, no finance

-- 1. Companies (multi-tenant root)
CREATE TABLE IF NOT EXISTS companies (
  id SERIAL PRIMARY KEY,
  name VARCHAR(200) NOT NULL,
  code VARCHAR(50) UNIQUE,
  address TEXT,
  phone VARCHAR(30),
  email VARCHAR(100),
  website VARCHAR(200),
  contact_person VARCHAR(100),
  contact_phone VARCHAR(30),
  contact_email VARCHAR(100),
  tin VARCHAR(50),
  license_type VARCHAR(20) DEFAULT 'demo' CHECK (license_type IN ('demo','trial','full','enterprise')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','suspended')),
  registration_date DATE DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_companies_tin ON companies(tin) WHERE tin IS NOT NULL AND tin <> '';

-- 2. Modules (licensed features)
CREATE TABLE IF NOT EXISTS modules (
  id SERIAL PRIMARY KEY,
  code VARCHAR(50) UNIQUE NOT NULL,
  name VARCHAR(100) NOT NULL,
  description TEXT,
  icon VARCHAR(50),
  is_active BOOLEAN DEFAULT true,
  sort_order INTEGER DEFAULT 0
);

INSERT INTO modules (code, name, description, icon, sort_order) VALUES
  ('membership', 'Membership', 'Membership plans, members, payments', 'bi-person-badge', 1),
  ('audit', 'Audit', 'Audit trails, activity logs', 'bi-journal-text', 2),
  ('reports', 'Reports', 'Analytics, charts, exports', 'bi-bar-chart', 3)
ON CONFLICT DO NOTHING;

-- 3. Users
CREATE TABLE IF NOT EXISTS users (
  id SERIAL PRIMARY KEY,
  name VARCHAR(100),
  email VARCHAR(100) NOT NULL,
  password TEXT NOT NULL,
  role VARCHAR(20) DEFAULT 'admin',
  role_id INTEGER,
  is_active BOOLEAN DEFAULT true,
  phone VARCHAR(20),
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL
);

-- 4. Roles
CREATE TABLE IF NOT EXISTS roles (
  id SERIAL PRIMARY KEY,
  name VARCHAR(50) NOT NULL UNIQUE,
  description TEXT,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  is_active BOOLEAN DEFAULT true,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

INSERT INTO roles (name, description) VALUES
  ('super_admin', 'Super administrator full system access across all companies'),
  ('admin', 'Full system access'),
  ('manager', 'Manager access'),
  ('receptionist', 'Front desk / reception access'),
  ('guest', 'Guest limited view-only access')
ON CONFLICT (name) DO NOTHING;

-- 5. Role Permissions
CREATE TABLE IF NOT EXISTS role_permissions (
  id SERIAL PRIMARY KEY,
  role_id INTEGER NOT NULL REFERENCES roles(id) ON DELETE CASCADE,
  resource VARCHAR(50) NOT NULL,
  can_view BOOLEAN DEFAULT false,
  can_create BOOLEAN DEFAULT false,
  can_edit BOOLEAN DEFAULT false,
  can_delete BOOLEAN DEFAULT false,
  can_approve BOOLEAN DEFAULT false,
  UNIQUE(role_id, resource)
);

-- Seed permissions for admin role
DO $$
DECLARE
  admin_role_id INTEGER;
  resources TEXT[] := ARRAY[
    'dashboard', 'membership_plans', 'membership_members', 'membership_payments',
    'membership_attendance', 'gym_checkins',
    'membership_subscriptions', 'membership_rate_cards', 'membership_facilities',
    'membership_gates', 'membership_rfid_cards', 'membership_qr_passes',
    'membership_sessions', 'membership_access_logs', 'membership_day_tickets',
    'users', 'roles', 'settings', 'id_definitions', 'notifications',
    'audit_logs', 'companies', 'modules', 'reports'
  ];
  r TEXT;
BEGIN
  SELECT id INTO admin_role_id FROM roles WHERE name = 'admin' LIMIT 1;
  IF admin_role_id IS NOT NULL THEN
    FOREACH r IN ARRAY resources LOOP
      INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
      VALUES (admin_role_id, r, true, true, true, true, true)
      ON CONFLICT (role_id, resource) DO NOTHING;
    END LOOP;
  END IF;
END $$;

-- Seed permissions for manager role (view + manage members)
DO $$
DECLARE
  mgr_role_id INTEGER;
BEGIN
  SELECT id INTO mgr_role_id FROM roles WHERE name = 'manager' LIMIT 1;
  IF mgr_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES
      (mgr_role_id, 'dashboard', true, false, false, false, false),
      (mgr_role_id, 'membership_plans', true, true, true, false, false),
      (mgr_role_id, 'membership_members', true, true, true, false, false),
      (mgr_role_id, 'membership_payments', true, true, false, false, false),
      (mgr_role_id, 'membership_attendance', true, false, false, false, false),
      (mgr_role_id, 'gym_checkins', true, false, false, false, false),
      (mgr_role_id, 'notifications', true, false, false, false, false),
      (mgr_role_id, 'reports', true, false, false, false, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed permissions for receptionist role
DO $$
DECLARE
  rec_role_id INTEGER;
BEGIN
  SELECT id INTO rec_role_id FROM roles WHERE name = 'receptionist' LIMIT 1;
  IF rec_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES
      (rec_role_id, 'dashboard', true, false, false, false, false),
      (rec_role_id, 'membership_plans', true, false, false, false, false),
      (rec_role_id, 'membership_members', true, true, true, false, false),
      (rec_role_id, 'membership_payments', true, true, false, false, false),
      (rec_role_id, 'membership_attendance', true, true, true, false, false),
      (rec_role_id, 'gym_checkins', true, true, false, false, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- Seed permissions for guest role (view-only dashboard + reports)
DO $$
DECLARE
  guest_role_id INTEGER;
BEGIN
  SELECT id INTO guest_role_id FROM roles WHERE name = 'guest' LIMIT 1;
  IF guest_role_id IS NOT NULL THEN
    INSERT INTO role_permissions (role_id, resource, can_view, can_create, can_edit, can_delete, can_approve)
    VALUES
      (guest_role_id, 'dashboard', true, false, false, false, false),
      (guest_role_id, 'reports', true, false, false, false, false)
    ON CONFLICT DO NOTHING;
  END IF;
END $$;

-- 6. Company Module Licensing
CREATE TABLE IF NOT EXISTS company_modules (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  module_id INTEGER NOT NULL REFERENCES modules(id),
  is_enabled BOOLEAN DEFAULT true,
  UNIQUE(company_id, module_id)
);

-- 7. System Settings
CREATE TABLE IF NOT EXISTS settings (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  key VARCHAR(100) NOT NULL,
  value TEXT NOT NULL,
  description TEXT,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, key)
);

INSERT INTO settings (company_id, key, value, description) VALUES
  (NULL, 'company_name', 'Dagi Spa', 'Company name'),
  (NULL, 'company_address', 'Addis Ababa, Ethiopia', 'Company address'),
  (NULL, 'company_phone', '+251-XXX-XXXXXX', 'Company phone'),
  (NULL, 'company_email', 'info@dagispa.com', 'Company email'),
  (NULL, 'currency', 'ETB', 'Currency symbol')
ON CONFLICT (company_id, key) DO NOTHING;

-- 8. Membership Plans
CREATE TABLE IF NOT EXISTS membership_plans (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'general' CHECK (type IN ('gym','spa','cafe','general')),
  description TEXT,
  duration_days INTEGER NOT NULL DEFAULT 30,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ETB',
  max_members INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 9. Membership Members
CREATE TABLE IF NOT EXISTS membership_members (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES membership_plans(id) ON DELETE RESTRICT,
  full_name VARCHAR(200) NOT NULL,
  phone VARCHAR(30),
  email VARCHAR(200),
  id_number VARCHAR(100),
  address TEXT,
  photo_url TEXT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'active' CHECK (status IN ('active','expired','suspended','cancelled')),
  customer_id VARCHAR(50),
  qr_code TEXT,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE UNIQUE INDEX IF NOT EXISTS idx_membership_members_customer_id ON membership_members(company_id, customer_id) WHERE customer_id IS NOT NULL;

-- 10. Membership Payments
CREATE TABLE IF NOT EXISTS membership_payments (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE CASCADE,
  amount DECIMAL(12,2) NOT NULL,
  currency VARCHAR(10) DEFAULT 'ETB',
  payment_method VARCHAR(50) DEFAULT 'cash',
  reference VARCHAR(200),
  payment_date DATE NOT NULL DEFAULT CURRENT_DATE,
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 11. Gym Check-ins (attendance tracking)
CREATE TABLE IF NOT EXISTS gym_checkins (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE CASCADE,
  card_uid VARCHAR(100),
  check_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_at TIMESTAMP,
  status VARCHAR(20) NOT NULL DEFAULT 'checked_in' CHECK (status IN ('checked_in','checked_out')),
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('rfid','manual','kiosk')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 12. ID Definitions (auto-generation)
CREATE TABLE IF NOT EXISTS id_definitions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  entity_type VARCHAR(50) NOT NULL,
  prefix VARCHAR(20) NOT NULL DEFAULT '',
  suffix VARCHAR(50) NOT NULL DEFAULT '',
  separator VARCHAR(5) NOT NULL DEFAULT '-',
  pad_length INTEGER NOT NULL DEFAULT 5,
  start_from INTEGER NOT NULL DEFAULT 1,
  reset_type VARCHAR(20) NOT NULL DEFAULT 'never'
    CHECK (reset_type IN ('never','yearly','monthly','daily')),
  pattern VARCHAR(200) NOT NULL DEFAULT '{PREFIX}{SEP}{SEQ}{SEP}{SUFFIX}',
  is_active BOOLEAN NOT NULL DEFAULT true,
  description TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, entity_type)
);

-- 13. ID Sequences
CREATE TABLE IF NOT EXISTS id_sequences (
  id SERIAL PRIMARY KEY,
  definition_id INTEGER NOT NULL REFERENCES id_definitions(id) ON DELETE CASCADE,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  period_key VARCHAR(20) NOT NULL DEFAULT 'all',
  current_value INTEGER NOT NULL DEFAULT 0,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(definition_id, period_key)
);

-- Seed ID definitions
CREATE OR REPLACE FUNCTION seed_id_definitions(p_company_id INTEGER)
RETURNS void AS $$
BEGIN
  INSERT INTO id_definitions (company_id, entity_type, prefix, suffix, separator, pad_length, start_from, reset_type, pattern, description)
  VALUES
    (p_company_id, 'member', 'MEM', '', '-', 5, 1, 'never', '{PREFIX}{SEP}{SEQ}', 'Member ID'),
    (p_company_id, 'customer', 'CUST', '', '-', 5, 1, 'never', '{PREFIX}{SEP}{SEQ}', 'Walk-in Customer ID'),
    (p_company_id, 'payment', 'PAY', '', '-', 5, 1, 'daily', '{PREFIX}{SEP}{SEQ}', 'Payment Receipt Number')
  ON CONFLICT (company_id, entity_type) DO NOTHING;
END;
$$ LANGUAGE plpgsql;

-- 14. Notifications
CREATE TABLE IF NOT EXISTS notifications (
  id SERIAL PRIMARY KEY,
  company_id INTEGER REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
  title VARCHAR(200) NOT NULL,
  message TEXT,
  type VARCHAR(30) DEFAULT 'info' CHECK (type IN ('info','warning','alert','success')),
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 15. Audit Logs
CREATE TABLE IF NOT EXISTS audit_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  user_id INTEGER NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  action VARCHAR(20) NOT NULL CHECK (action IN (
    'CREATE','UPDATE','DELETE','LOGIN','LOGOUT',
    'APPROVE','REJECT','SUBMIT','EXPORT','PRINT'
  )),
  table_name VARCHAR(100) NOT NULL,
  record_id VARCHAR(50) NOT NULL,
  old_values JSONB,
  new_values JSONB,
  ip_address VARCHAR(45),
  user_agent TEXT,
  created_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
);

-- 16. Demo Licenses (for issuing to companies)
CREATE TABLE IF NOT EXISTS demo_licenses (
  id SERIAL PRIMARY KEY,
  license_key VARCHAR(100) UNIQUE NOT NULL,
  company_id INTEGER REFERENCES companies(id) ON DELETE SET NULL,
  company_name VARCHAR(200) NOT NULL,
  contact_name VARCHAR(100),
  contact_email VARCHAR(100),
  contact_phone VARCHAR(30),
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  duration_days INTEGER DEFAULT 15,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','revoked','suspended')),
  notes TEXT,
  issued_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

-- 17. Updated-at trigger function
CREATE OR REPLACE FUNCTION set_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = CURRENT_TIMESTAMP;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Apply updated_at triggers
CREATE TRIGGER trg_companies_updated_at BEFORE UPDATE ON companies FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_users_updated_at BEFORE UPDATE ON users FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_roles_updated_at BEFORE UPDATE ON roles FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_membership_plans_updated_at BEFORE UPDATE ON membership_plans FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_membership_members_updated_at BEFORE UPDATE ON membership_members FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_gym_checkins_updated_at BEFORE UPDATE ON gym_checkins FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_id_definitions_updated_at BEFORE UPDATE ON id_definitions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_id_sequences_updated_at BEFORE UPDATE ON id_sequences FOR EACH ROW EXECUTE FUNCTION set_updated_at();
CREATE TRIGGER trg_demo_licenses_updated_at BEFORE UPDATE ON demo_licenses FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- 18. Seed default company
INSERT INTO companies (name, code, tin, contact_email, license_type, status)
SELECT 'Dagi Spa', 'CMP-DAGI', 'TIN-DAGI-001', 'admin@dagispa.com', 'enterprise', 'active'
WHERE NOT EXISTS (SELECT 1 FROM companies WHERE tin = 'TIN-DAGI-001');

-- 18. Assign all modules to default company
INSERT INTO company_modules (company_id, module_id)
SELECT c.id, m.id FROM companies c, modules m
WHERE c.tin = 'TIN-DAGI-001'
AND NOT EXISTS (SELECT 1 FROM company_modules cm WHERE cm.company_id = c.id AND cm.module_id = m.id);

-- 19. Seed default admin user (password: admin123)
INSERT INTO users (name, email, password, role, role_id, is_active, company_id)
SELECT 'Admin', 'admin@dagispa.com',   '$2b$10$eWQbUmaazwgDUN57of17Ze.m7e0nmWDbcAjiMAnnjrcpGWW.IFcz2',
  'admin', r.id, true, c.id
FROM companies c, roles r
WHERE c.tin = 'TIN-DAGI-001' AND r.name = 'admin'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'admin@dagispa.com');

-- Seed super admin user (password: admin123)
INSERT INTO users (name, email, password, role, role_id, is_active)
SELECT 'Super Admin', 'super@dagispa.com', '$2b$10$eWQbUmaazwgDUN57of17Ze.m7e0nmWDbcAjiMAnnjrcpGWW.IFcz2',
  'super_admin', r.id, true
FROM roles r
WHERE r.name = 'super_admin'
AND NOT EXISTS (SELECT 1 FROM users WHERE email = 'super@dagispa.com');

-- 20. Seed ID definitions for default company
SELECT seed_id_definitions(c.id) FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM id_definitions WHERE company_id = c.id);

-- 21. Seed default membership plans
INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
SELECT c.id, 'Basic Gym', 'gym', 'Standard gym access - all equipment', 30, 500, 200 FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE name = 'Basic Gym' AND company_id = c.id);

INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
SELECT c.id, 'Premium Gym', 'gym', 'Full gym + sauna + personal trainer', 30, 1500, 100 FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE name = 'Premium Gym' AND company_id = c.id);

INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
SELECT c.id, 'Spa Package', 'spa', 'Full spa access - massage, steam, jacuzzi', 30, 2000, 50 FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE name = 'Spa Package' AND company_id = c.id);

INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
SELECT c.id, 'Cafe Voucher', 'cafe', 'Monthly cafe credit voucher', 30, 800, NULL FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE name = 'Cafe Voucher' AND company_id = c.id);

INSERT INTO membership_plans (company_id, name, type, description, duration_days, price, max_members)
SELECT c.id, 'VIP All Access', 'general', 'Full access - gym, spa, cafe, all facilities', 30, 3500, 30 FROM companies c WHERE c.tin = 'TIN-DAGI-001'
  AND NOT EXISTS (SELECT 1 FROM membership_plans WHERE name = 'VIP All Access' AND company_id = c.id);

-- 22. Performance indexes (tenant-first)
CREATE INDEX IF NOT EXISTS idx_users_company_role ON users(company_id, role);
CREATE INDEX IF NOT EXISTS idx_users_email ON users(email);
CREATE INDEX IF NOT EXISTS idx_role_permissions_role ON role_permissions(role_id);
CREATE INDEX IF NOT EXISTS idx_company_modules_company ON company_modules(company_id);
CREATE INDEX IF NOT EXISTS idx_settings_company ON settings(company_id, key);
CREATE INDEX IF NOT EXISTS idx_membership_plans_company ON membership_plans(company_id, is_active);
CREATE INDEX IF NOT EXISTS idx_membership_members_company ON membership_members(company_id, status);
CREATE INDEX IF NOT EXISTS idx_membership_members_plan ON membership_members(company_id, plan_id);
CREATE INDEX IF NOT EXISTS idx_membership_members_dates ON membership_members(company_id, end_date);
CREATE INDEX IF NOT EXISTS idx_membership_payments_company ON membership_payments(company_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_membership_payments_member ON membership_payments(member_id, payment_date DESC);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_company_date ON gym_checkins(company_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_member ON gym_checkins(member_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_gym_checkins_status ON gym_checkins(company_id, status);
CREATE INDEX IF NOT EXISTS idx_id_definitions_company ON id_definitions(company_id, entity_type);
CREATE INDEX IF NOT EXISTS idx_id_sequences_company ON id_sequences(company_id, definition_id);
CREATE INDEX IF NOT EXISTS idx_notifications_company_user ON notifications(company_id, user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_company ON audit_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_user ON audit_logs(user_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_audit_logs_table ON audit_logs(table_name, record_id);

-- 23. Row-Level Security (multi-tenant isolation)
CREATE OR REPLACE FUNCTION set_app_context(p_company_id INTEGER, p_user_role TEXT DEFAULT NULL)
RETURNS VOID AS $$
BEGIN
  PERFORM set_config('app.current_company_id', p_company_id::TEXT, true);
  IF p_user_role IS NOT NULL THEN
    PERFORM set_config('app.current_user_role', p_user_role, true);
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'settings', 'membership_plans', 'membership_members',
    'membership_payments', 'gym_checkins', 'id_definitions', 'id_sequences',
    'notifications', 'audit_logs', 'company_modules'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format('ALTER TABLE %I ENABLE ROW LEVEL SECURITY', tbl);
    EXECUTE format('DROP POLICY IF EXISTS tenant_isolation ON %I', tbl);
    EXECUTE format(
      'CREATE POLICY tenant_isolation ON %I
       USING (company_id = current_setting(''app.current_company_id'')::integer)',
      tbl
    );
  END LOOP;
END $$;

-- Super admin bypass policy
DO $$
DECLARE
  tbl TEXT;
  tables TEXT[] := ARRAY[
    'users', 'settings', 'membership_plans', 'membership_members',
    'membership_payments', 'gym_checkins', 'id_definitions', 'id_sequences',
    'notifications', 'audit_logs'
  ];
BEGIN
  FOREACH tbl IN ARRAY tables LOOP
    EXECUTE format(
      'CREATE POLICY super_admin_bypass ON %I
       FOR ALL USING (current_setting(''app.current_user_role'', true) = ''super_admin'')',
      tbl
    );
  END LOOP;
END $$;
