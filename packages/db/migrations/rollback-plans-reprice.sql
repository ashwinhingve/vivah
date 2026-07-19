-- ROLLBACK for sync-plans-to-source-of-truth.sql
--
-- Restores the exact plan pricing production held before 2026-07-19, captured
-- live from the `plans` table immediately before the correction. Also removes
-- the two quarterly plans, which did not exist before.
--
-- Only run this if the repricing in packages/types/src/plans.ts is reverted.

UPDATE plans SET amount = '999.00'   WHERE code = 'STANDARD_M';
UPDATE plans SET amount = '8999.00'  WHERE code = 'STANDARD_Y';
UPDATE plans SET amount = '2499.00'  WHERE code = 'PREMIUM_M';
UPDATE plans SET amount = '22999.00' WHERE code = 'PREMIUM_Y';

DELETE FROM plans WHERE code IN ('STANDARD_Q', 'PREMIUM_Q');
