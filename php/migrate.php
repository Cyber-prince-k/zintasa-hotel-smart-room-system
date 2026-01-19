<?php
/**
 * Database Migration Script
 * Migrates from old single-table schema to new inheritance-based schema
 * Run this once to update your database structure
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/db.php';

echo "Starting database migration...\n";

try {
    $pdo = db();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    // Check if guests table exists
    $tablesResult = $pdo->query("SHOW TABLES LIKE 'guests'");
    $guestsTableExists = $tablesResult->rowCount() > 0;
    
    if ($guestsTableExists) {
        echo "Migration already completed (guests table exists).\n";
        exit(0);
    }
    
    echo "Creating new role-specific tables...\n";
    
    // Create guests table
    $pdo->exec("
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
        ) ENGINE=InnoDB
    ");
    echo "  - Created guests table\n";
    
    // Create staff table
    $pdo->exec("
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
          CONSTRAINT `fk_staff_user` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE CASCADE
        ) ENGINE=InnoDB
    ");
    echo "  - Created staff table\n";
    
    // Create admins table
    $pdo->exec("
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
        ) ENGINE=InnoDB
    ");
    echo "  - Created admins table\n";
    
    // Migrate existing users to role-specific tables
    echo "Migrating existing users to role tables...\n";
    
    // Check if old columns exist in users table
    $columns = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    $hasRoomNumber = in_array('room_number', $columns);
    $hasKeyCardId = in_array('key_card_id', $columns);
    
    // Migrate guests
    $guests = $pdo->query("SELECT id, " . ($hasRoomNumber ? "room_number, " : "") . ($hasKeyCardId ? "key_card_id " : "id ") . "FROM users WHERE role = 'guest'")->fetchAll();
    foreach ($guests as $guest) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO guests (user_id, room_number, key_card_id) VALUES (:user_id, :room_number, :key_card_id)");
        $stmt->execute([
            ':user_id' => $guest['id'],
            ':room_number' => $hasRoomNumber ? ($guest['room_number'] ?? null) : null,
            ':key_card_id' => $hasKeyCardId ? ($guest['key_card_id'] ?? null) : null,
        ]);
    }
    echo "  - Migrated " . count($guests) . " guests\n";
    
    // Migrate staff
    $staffUsers = $pdo->query("SELECT id FROM users WHERE role = 'staff'")->fetchAll();
    foreach ($staffUsers as $staff) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO staff (user_id, department) VALUES (:user_id, 'front_desk')");
        $stmt->execute([':user_id' => $staff['id']]);
    }
    echo "  - Migrated " . count($staffUsers) . " staff members\n";
    
    // Migrate admins
    $adminUsers = $pdo->query("SELECT id FROM users WHERE role = 'admin'")->fetchAll();
    $isFirst = true;
    foreach ($adminUsers as $admin) {
        $stmt = $pdo->prepare("INSERT IGNORE INTO admins (user_id, access_level) VALUES (:user_id, :access_level)");
        $stmt->execute([
            ':user_id' => $admin['id'],
            ':access_level' => $isFirst ? 'super_admin' : 'admin',
        ]);
        $isFirst = false;
    }
    echo "  - Migrated " . count($adminUsers) . " admins\n";
    
    echo "\nMigration completed successfully!\n";
    echo "You can now add guests through the staff dashboard.\n";
    
} catch (Throwable $e) {
    echo "Migration failed: " . $e->getMessage() . "\n";
    exit(1);
}
