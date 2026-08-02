-- Clean transactional data for a fresh start
-- Keeps: companies, users, roles, permissions, gates, zones, slots, plans
-- Deletes: all service transactions, access logs, attendance, sessions, payments

-- Replace :company_id with the actual company ID to clean, or run as-is to clear everything

DELETE FROM spa_service_orders;
DELETE FROM spa_visit_services;
DELETE FROM spa_visits;
DELETE FROM spa_visit_counters;
DELETE FROM spa_management_records;
DELETE FROM gym_checkins;
DELETE FROM rfid_access_logs;
DELETE FROM parking_sessions;
DELETE FROM parking_payments;
DELETE FROM parking_subscriptions;
DELETE FROM membership_payments;
DELETE FROM rfid_cards;

-- Optional: keep member profiles but clear their transactional data
-- DELETE FROM membership_members;
-- DELETE FROM parking_customers;
-- DELETE FROM parking_vehicles;
-- DELETE FROM parking_qr_tickets;

-- Reset sequences if needed
-- ALTER SEQUENCE gym_checkins_id_seq RESTART WITH 1;
-- ALTER SEQUENCE rfid_access_logs_id_seq RESTART WITH 1;
-- ALTER SEQUENCE parking_sessions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE parking_payments_id_seq RESTART WITH 1;
-- ALTER SEQUENCE parking_subscriptions_id_seq RESTART WITH 1;
-- ALTER SEQUENCE membership_payments_id_seq RESTART WITH 1;
-- ALTER SEQUENCE rfid_cards_id_seq RESTART WITH 1;
