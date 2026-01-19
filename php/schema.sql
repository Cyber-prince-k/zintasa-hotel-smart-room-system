CREATE DATABASE IF NOT EXISTS `golden` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `golden`;

CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role` ENUM('admin','staff','guest') NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone_number` VARCHAR(30) NULL,
  `room_number` VARCHAR(20) NULL,
  `key_card_id` VARCHAR(64) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_username` (`username`),
  KEY `idx_users_role` (`role`),
  KEY `idx_users_room` (`room_number`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
