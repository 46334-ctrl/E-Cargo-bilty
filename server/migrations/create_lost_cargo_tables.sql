-- ==============================================================================
-- E-CARGO-BILTY: Lost & Missing Cargo Tracking Portal
-- Database Migration Script for MySQL
-- Tables: lost_cargo_reports, lost_cargo_logs
-- ==============================================================================

-- 1. Create `lost_cargo_reports` table
CREATE TABLE IF NOT EXISTS `lost_cargo_reports` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `bilty_id` INT NOT NULL,
  `reported_by_user_id` INT NOT NULL,
  `transporter_id` INT NULL,
  `issue_type` ENUM('Not Delivered', 'Missing Items', 'Lost in Transit', 'Damaged') NOT NULL,
  `description` TEXT NOT NULL,
  `evidence_image_url` VARCHAR(500) NULL,
  `last_known_location` VARCHAR(255) NULL,
  `status` ENUM('Reported', 'Under Investigation', 'Located', 'Resolved', 'Closed') NOT NULL DEFAULT 'Reported',
  `resolution_notes` TEXT NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_lost_bilty` (`bilty_id`),
  INDEX `idx_lost_reporter` (`reported_by_user_id`),
  INDEX `idx_lost_transporter` (`transporter_id`),
  INDEX `idx_lost_status` (`status`),
  CONSTRAINT `fk_lost_cargo_bilty`
    FOREIGN KEY (`bilty_id`) REFERENCES `cargo` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lost_cargo_reporter`
    FOREIGN KEY (`reported_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lost_cargo_transporter`
    FOREIGN KEY (`transporter_id`) REFERENCES `users` (`id`)
    ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

-- 2. Create `lost_cargo_logs` table (Audit trail & investigation timeline)
CREATE TABLE IF NOT EXISTS `lost_cargo_logs` (
  `id` INT NOT NULL AUTO_INCREMENT,
  `report_id` INT NOT NULL,
  `updated_by_user_id` INT NOT NULL,
  `role` VARCHAR(50) NOT NULL,
  `action_note` TEXT NOT NULL,
  `status_changed_to` VARCHAR(50) NULL,
  `created_at` DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  INDEX `idx_log_report` (`report_id`),
  INDEX `idx_log_user` (`updated_by_user_id`),
  CONSTRAINT `fk_lost_cargo_log_report`
    FOREIGN KEY (`report_id`) REFERENCES `lost_cargo_reports` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `fk_lost_cargo_log_user`
    FOREIGN KEY (`updated_by_user_id`) REFERENCES `users` (`id`)
    ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

