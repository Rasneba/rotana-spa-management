-- Clean Spa/Gym transactional data for a fresh operational start.
-- Keeps companies, users, permissions and all canonical master data:
-- customers, offerings, therapists, facilities, gates, cameras and credentials.

DELETE FROM access_device_commands;
DELETE FROM access_logs;
DELETE FROM spa_service_orders;
DELETE FROM spa_visit_services;
DELETE FROM spa_appointments;
DELETE FROM spa_visits;
DELETE FROM spa_visit_counters;
DELETE FROM visit_sessions;
DELETE FROM gym_checkins;
DELETE FROM membership_attendance;
DELETE FROM membership_payments;

-- Optional master cleanup (disabled by default):
-- DELETE FROM subscriptions;
-- DELETE FROM qr_passes;
-- DELETE FROM rfid_cards;
-- DELETE FROM membership_members;
-- DELETE FROM spa_management_records;

-- Optional sequence resets:
-- ALTER SEQUENCE spa_visits_id_seq RESTART WITH 1;
-- ALTER SEQUENCE spa_visit_services_id_seq RESTART WITH 1;
-- ALTER SEQUENCE spa_service_orders_id_seq RESTART WITH 1;
-- ALTER SEQUENCE spa_appointments_id_seq RESTART WITH 1;
-- ALTER SEQUENCE gym_checkins_id_seq RESTART WITH 1;
