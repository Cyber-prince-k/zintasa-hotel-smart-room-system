CREATE DATABASE IF NOT EXISTS `golden` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
USE `golden`;

-- ============================================================================
-- BASE USERS TABLE
-- All user types (admin, staff, guest) inherit common fields from this table
-- ============================================================================
CREATE TABLE IF NOT EXISTS `users` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `role` ENUM('admin','staff','guest') NOT NULL,
  `full_name` VARCHAR(120) NOT NULL,
  `username` VARCHAR(80) NULL,
  `email` VARCHAR(190) NOT NULL,
  `phone_number` VARCHAR(30) NULL,
  `password_hash` VARCHAR(255) NOT NULL,
  `created_by` BIGINT UNSIGNED NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `active` TINYINT(1) NOT NULL DEFAULT 1,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_users_username` (`username`),
  UNIQUE KEY `uniq_users_email` (`email`),
  KEY `idx_users_role` (`role`),
  CONSTRAINT `fk_users_created_by` FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- GUESTS TABLE
-- Extends users with guest-specific fields (room assignment, check-in/out, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `guests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `room_number` VARCHAR(20) NULL,
  `key_card_id` VARCHAR(64) NULL,
  `check_in_date` DATE NULL,
  `check_out_date` DATE NULL,
  `guest_code` VARCHAR(10) NULL,
  `vip_status` TINYINT(1) NOT NULL DEFAULT 0,
  `special_requests` TEXT NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_guests_user` (`user_id`),
  KEY `idx_guests_room` (`room_number`),
  KEY `idx_guests_keycard` (`key_card_id`),
  CONSTRAINT `fk_guests_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- STAFF TABLE
-- Extends users with staff-specific fields (department, shift, employee ID, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `staff` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `employee_id` VARCHAR(20) NULL,
  `department` ENUM('front_desk','housekeeping','maintenance','room_service','security','concierge','management') NOT NULL DEFAULT 'front_desk',
  `shift` ENUM('morning','afternoon','night') NULL,
  `hire_date` DATE NULL,
  `supervisor_id` BIGINT UNSIGNED NULL,
  `can_manage_guests` TINYINT(1) NOT NULL DEFAULT 1,
  `can_manage_requests` TINYINT(1) NOT NULL DEFAULT 1,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_staff_user` (`user_id`),
  UNIQUE KEY `uniq_staff_employee_id` (`employee_id`),
  KEY `idx_staff_department` (`department`),
  CONSTRAINT `fk_staff_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_staff_supervisor` FOREIGN KEY (`supervisor_id`) REFERENCES `staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- ADMINS TABLE
-- Extends users with admin-specific fields (access level, permissions, etc.)
-- ============================================================================
CREATE TABLE IF NOT EXISTS `admins` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NOT NULL,
  `access_level` ENUM('super_admin','admin','manager') NOT NULL DEFAULT 'admin',
  `can_manage_users` TINYINT(1) NOT NULL DEFAULT 1,
  `can_manage_staff` TINYINT(1) NOT NULL DEFAULT 1,
  `can_manage_rooms` TINYINT(1) NOT NULL DEFAULT 1,
  `can_manage_system` TINYINT(1) NOT NULL DEFAULT 1,
  `can_view_logs` TINYINT(1) NOT NULL DEFAULT 1,
  `can_export_data` TINYINT(1) NOT NULL DEFAULT 1,
  `last_login_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_admins_user` (`user_id`),
  KEY `idx_admins_access_level` (`access_level`),
  CONSTRAINT `fk_admins_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB;

-- ============================================================================
-- ROOMS TABLE
-- Room inventory and current status
-- ============================================================================
CREATE TABLE IF NOT EXISTS `rooms` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `room_number` VARCHAR(20) NOT NULL,
  `floor` INT NOT NULL DEFAULT 1,
  `room_type` ENUM('standard','deluxe','suite','presidential') NOT NULL DEFAULT 'standard',
  `status` ENUM('available','occupied','maintenance','cleaning','reserved') NOT NULL DEFAULT 'available',
  `max_occupancy` INT NOT NULL DEFAULT 2,
  `price_per_night` DECIMAL(10,2) NULL,
  `amenities` JSON NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uniq_rooms_number` (`room_number`),
  KEY `idx_rooms_status` (`status`),
  KEY `idx_rooms_floor` (`floor`)
) ENGINE=InnoDB;

-- ============================================================================
-- SERVICE REQUESTS TABLE
-- Guest service requests tracked by staff
-- ============================================================================
CREATE TABLE IF NOT EXISTS `service_requests` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `guest_id` BIGINT UNSIGNED NOT NULL,
  `room_number` VARCHAR(20) NOT NULL,
  `request_type` ENUM('housekeeping','room_service','maintenance','laundry','amenities','other') NOT NULL,
  `priority` ENUM('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `status` ENUM('pending','assigned','in_progress','completed','cancelled') NOT NULL DEFAULT 'pending',
  `description` TEXT NULL,
  `assigned_to` BIGINT UNSIGNED NULL,
  `preferred_time` TIME NULL,
  `completed_at` TIMESTAMP NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  `updated_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_requests_guest` (`guest_id`),
  KEY `idx_requests_status` (`status`),
  KEY `idx_requests_assigned` (`assigned_to`),
  CONSTRAINT `fk_requests_guest` FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_requests_staff` FOREIGN KEY (`assigned_to`) REFERENCES `staff`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;

-- ============================================================================
-- SYSTEM LOGS TABLE
-- Audit trail for admin monitoring
-- ============================================================================
CREATE TABLE IF NOT EXISTS `system_logs` (
  `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id` BIGINT UNSIGNED NULL,
  `action` VARCHAR(100) NOT NULL,
  `entity_type` VARCHAR(50) NULL,
  `entity_id` BIGINT UNSIGNED NULL,
  `details` JSON NULL,
  `ip_address` VARCHAR(45) NULL,
  `user_agent` VARCHAR(255) NULL,
  `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_logs_user` (`user_id`),
  KEY `idx_logs_action` (`action`),
  KEY `idx_logs_created` (`created_at`),
  CONSTRAINT `fk_logs_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB;
