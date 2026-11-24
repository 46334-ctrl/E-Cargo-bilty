-- ==============================================================================
-- Database Migration: Add Truck Capacity Tracking
-- Project: E-CARGO-BILTY
-- ==============================================================================

-- 1. Add total_capacity and used_capacity columns to trucks table (MySQL compatible)
ALTER TABLE `trucks` 
  ADD COLUMN `total_capacity` DOUBLE DEFAULT 0 AFTER `capacity`,
  ADD COLUMN `used_capacity` DOUBLE DEFAULT 0 AFTER `total_capacity`;

-- 2. Optional initial backfill for common existing capacities:
UPDATE `trucks` SET `total_capacity` = 25000 WHERE `capacity` LIKE '%25%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 40000 WHERE `capacity` LIKE '%40%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 30000 WHERE `capacity` LIKE '%30%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 35000 WHERE `capacity` LIKE '%35%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 15000 WHERE `capacity` LIKE '%15%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 22000 WHERE `capacity` LIKE '%22%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 8000  WHERE `capacity` LIKE '%8%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 45000 WHERE `capacity` LIKE '%45%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 18000 WHERE `capacity` LIKE '%18%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 28000 WHERE `capacity` LIKE '%28%' AND `total_capacity` = 0;
UPDATE `trucks` SET `total_capacity` = 32000 WHERE `capacity` LIKE '%32%' AND `total_capacity` = 0;
