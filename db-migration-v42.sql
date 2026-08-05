-- Migration v42: Offering prices on therapist visit services and printed service order
--
-- The Offering Master now stores a Price (ETB) per classified offering. This
-- migration captures that price on each visit service line so the printed
-- cashier-handoff draft can show unit price, line total and grand total.

ALTER TABLE spa_visit_services ADD COLUMN IF NOT EXISTS unit_price NUMERIC(14,2);

-- Backfill existing visit service lines from the offering's current price so
-- previously recorded drafts still carry a unit price when reprinted.
UPDATE spa_visit_services vs
SET unit_price = o.amount
FROM spa_management_records o
WHERE vs.service_record_id = o.id
  AND o.module_key = 'catalog/offerings'
  AND vs.unit_price IS NULL;
