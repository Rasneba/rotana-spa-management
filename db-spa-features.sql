-- Rotana Spa - Feature Tables Migration
-- Facilities, Gates, RFID Cards, Access Logs, QR Passes, Subscriptions, Sessions, Rate Cards, Day Tickets

-- 1. Spa Facilities (treatment rooms, gym zones, pool, sauna, steam, cafe areas)
CREATE TABLE IF NOT EXISTS spa_facilities (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  type VARCHAR(50) NOT NULL DEFAULT 'other' CHECK (type IN ('room','zone','pool','sauna','steam','cafe','gym','changing','other')),
  capacity INTEGER,
  description TEXT,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_spa_facilities_company ON spa_facilities(company_id, is_active);

-- 2. Entry Gates
CREATE TABLE IF NOT EXISTS entry_gates (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  location VARCHAR(200),
  gate_type VARCHAR(20) NOT NULL DEFAULT 'entry' CHECK (gate_type IN ('entry','exit','both')),
  reader_type VARCHAR(20) DEFAULT 'rfid' CHECK (reader_type IN ('rfid','qr','both','manual')),
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_entry_gates_company ON entry_gates(company_id);

-- 3. RFID Cards / Wristbands
CREATE TABLE IF NOT EXISTS rfid_cards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES membership_members(id) ON DELETE SET NULL,
  card_uid VARCHAR(100) NOT NULL,
  type VARCHAR(20) DEFAULT 'membership' CHECK (type IN ('membership','day_pass','temporary','staff')),
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','inactive','lost','expired')),
  issued_date DATE DEFAULT CURRENT_DATE,
  expiry_date DATE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, card_uid)
);

CREATE INDEX IF NOT EXISTS idx_rfid_cards_company ON rfid_cards(company_id);
CREATE INDEX IF NOT EXISTS idx_rfid_cards_member ON rfid_cards(member_id);

-- 4. Access Logs (entry/exit records)
CREATE TABLE IF NOT EXISTS access_logs (
  id BIGSERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  gate_id INTEGER REFERENCES entry_gates(id) ON DELETE SET NULL,
  card_uid VARCHAR(100),
  member_id INTEGER REFERENCES membership_members(id) ON DELETE SET NULL,
  access_type VARCHAR(10) NOT NULL CHECK (access_type IN ('entry','exit')),
  method VARCHAR(10) NOT NULL CHECK (method IN ('rfid','qr','manual')),
  status VARCHAR(10) NOT NULL CHECK (status IN ('granted','denied')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_access_logs_company ON access_logs(company_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_member ON access_logs(member_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_gate ON access_logs(gate_id, created_at DESC);
CREATE INDEX IF NOT EXISTS idx_access_logs_date ON access_logs(company_id, created_at::date DESC);

-- 5. QR Passes (digital passes)
CREATE TABLE IF NOT EXISTS qr_passes (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES membership_members(id) ON DELETE SET NULL,
  pass_type VARCHAR(20) NOT NULL DEFAULT 'day_pass' CHECK (pass_type IN ('day_pass','promo','guest','staff')),
  qr_code TEXT,
  token VARCHAR(100) UNIQUE NOT NULL,
  issued_date DATE NOT NULL DEFAULT CURRENT_DATE,
  expiry_date DATE NOT NULL,
  max_uses INTEGER DEFAULT 1,
  current_uses INTEGER DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','used','expired','cancelled')),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_qr_passes_company ON qr_passes(company_id, status);
CREATE INDEX IF NOT EXISTS idx_qr_passes_member ON qr_passes(member_id);
CREATE INDEX IF NOT EXISTS idx_qr_passes_token ON qr_passes(token);

-- 6. Subscriptions (recurring billing)
CREATE TABLE IF NOT EXISTS subscriptions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER NOT NULL REFERENCES membership_members(id) ON DELETE CASCADE,
  plan_id INTEGER REFERENCES membership_plans(id) ON DELETE RESTRICT,
  start_date DATE NOT NULL DEFAULT CURRENT_DATE,
  end_date DATE NOT NULL,
  billing_cycle VARCHAR(20) DEFAULT 'monthly' CHECK (billing_cycle IN ('daily','weekly','monthly','quarterly','yearly')),
  amount DECIMAL(12,2) NOT NULL DEFAULT 0,
  status VARCHAR(20) DEFAULT 'active' CHECK (status IN ('active','expired','cancelled','suspended')),
  auto_renew BOOLEAN DEFAULT false,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_subscriptions_company ON subscriptions(company_id, status);
CREATE INDEX IF NOT EXISTS idx_subscriptions_member ON subscriptions(member_id);
CREATE INDEX IF NOT EXISTS idx_subscriptions_end_date ON subscriptions(company_id, end_date);

-- 7. Visit Sessions (individual check-in/check-out records)
CREATE TABLE IF NOT EXISTS visit_sessions (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  member_id INTEGER REFERENCES membership_members(id) ON DELETE CASCADE,
  subscription_id INTEGER REFERENCES subscriptions(id) ON DELETE SET NULL,
  card_uid VARCHAR(100),
  facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL,
  check_in_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  check_out_at TIMESTAMP,
  duration_minutes INTEGER,
  source VARCHAR(20) DEFAULT 'manual' CHECK (source IN ('rfid','qr','manual','kiosk')),
  notes TEXT,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_visit_sessions_company ON visit_sessions(company_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_member ON visit_sessions(member_id, check_in_at DESC);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_date ON visit_sessions(company_id, check_in_at::date);
CREATE INDEX IF NOT EXISTS idx_visit_sessions_active ON visit_sessions(company_id, check_out_at IS NULL);

-- 8. Rate Cards (pricing)
CREATE TABLE IF NOT EXISTS rate_cards (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  name VARCHAR(200) NOT NULL,
  facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL,
  service_type VARCHAR(30) NOT NULL CHECK (service_type IN ('membership','day_pass','session','facility','service')),
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ETB',
  duration_minutes INTEGER,
  is_active BOOLEAN DEFAULT true,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE INDEX IF NOT EXISTS idx_rate_cards_company ON rate_cards(company_id, is_active);

-- 9. Day Tickets (single-use)
CREATE TABLE IF NOT EXISTS day_tickets (
  id SERIAL PRIMARY KEY,
  company_id INTEGER NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  ticket_number VARCHAR(50) NOT NULL,
  guest_name VARCHAR(200),
  facility_id INTEGER REFERENCES spa_facilities(id) ON DELETE SET NULL,
  rate_id INTEGER REFERENCES rate_cards(id) ON DELETE SET NULL,
  price DECIMAL(12,2) NOT NULL DEFAULT 0,
  currency VARCHAR(10) DEFAULT 'ETB',
  qr_code TEXT,
  is_used BOOLEAN DEFAULT false,
  used_at TIMESTAMP,
  issued_by INTEGER REFERENCES users(id),
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  UNIQUE(company_id, ticket_number)
);

CREATE INDEX IF NOT EXISTS idx_day_tickets_company ON day_tickets(company_id, is_used);

-- Updated-at triggers
DROP TRIGGER IF EXISTS trg_spa_facilities_updated_at ON spa_facilities;
CREATE TRIGGER trg_spa_facilities_updated_at BEFORE UPDATE ON spa_facilities FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_entry_gates_updated_at ON entry_gates;
CREATE TRIGGER trg_entry_gates_updated_at BEFORE UPDATE ON entry_gates FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_rfid_cards_updated_at ON rfid_cards;
CREATE TRIGGER trg_rfid_cards_updated_at BEFORE UPDATE ON rfid_cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_qr_passes_updated_at ON qr_passes;
CREATE TRIGGER trg_qr_passes_updated_at BEFORE UPDATE ON qr_passes FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_subscriptions_updated_at ON subscriptions;
CREATE TRIGGER trg_subscriptions_updated_at BEFORE UPDATE ON subscriptions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_visit_sessions_updated_at ON visit_sessions;
CREATE TRIGGER trg_visit_sessions_updated_at BEFORE UPDATE ON visit_sessions FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_rate_cards_updated_at ON rate_cards;
CREATE TRIGGER trg_rate_cards_updated_at BEFORE UPDATE ON rate_cards FOR EACH ROW EXECUTE FUNCTION set_updated_at();
DROP TRIGGER IF EXISTS trg_day_tickets_updated_at ON day_tickets;
CREATE TRIGGER trg_day_tickets_updated_at BEFORE UPDATE ON day_tickets FOR EACH ROW EXECUTE FUNCTION set_updated_at();

-- Seed sample facilities
DO $$
DECLARE
  cid INTEGER;
BEGIN
  SELECT id INTO cid FROM companies LIMIT 1;
  IF cid IS NOT NULL THEN
    INSERT INTO spa_facilities (company_id, name, type, capacity, description) VALUES
      (cid, 'Main Gym Floor', 'gym', 50, 'Full equipment gym area'),
      (cid, 'Yoga Studio', 'room', 20, 'Yoga and stretching room'),
      (cid, 'Swimming Pool', 'pool', 30, 'Indoor heated swimming pool'),
      (cid, 'Finnish Sauna', 'sauna', 10, 'Traditional dry sauna'),
      (cid, 'Steam Room', 'steam', 8, 'Herbal steam bath'),
      (cid, 'Massage Room 1', 'room', 2, 'Private massage treatment room'),
      (cid, 'Massage Room 2', 'room', 2, 'Private massage treatment room'),
      (cid, 'Jacuzzi Area', 'pool', 15, 'Whirlpool jacuzzi'),
      (cid, 'Cafe Lounge', 'cafe', 40, 'Juice bar and light meals'),
      (cid, 'Changing Rooms', 'changing', 20, 'Male and female changing areas')
    ON CONFLICT DO NOTHING;

    INSERT INTO entry_gates (company_id, name, location, gate_type, reader_type) VALUES
      (cid, 'Main Entrance', 'Ground Floor Lobby', 'entry', 'rfid'),
      (cid, 'Gym Entrance', 'Gym Floor Level 2', 'both', 'rfid'),
      (cid, 'Spa Entrance', 'Spa Level 1', 'entry', 'both'),
      (cid, 'Pool Gate', 'Pool Area', 'both', 'rfid'),
      (cid, 'VIP Entrance', 'VIP Section', 'entry', 'both'),
      (cid, 'Staff Entrance', 'Back Office', 'entry', 'rfid')
    ON CONFLICT DO NOTHING;
  END IF;
END $$;
