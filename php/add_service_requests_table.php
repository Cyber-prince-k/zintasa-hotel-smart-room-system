<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/db.php';

echo "<pre>";
echo "=== Adding Service Requests Table ===\n\n";

try {
    $pdo = db();
    
    // Check if service_requests table already exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'service_requests'");
    if ($stmt->fetch()) {
        echo "Service requests table already exists.\n";
    } else {
        echo "Creating service_requests table...\n";
        
        $sql = "
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
          KEY `idx_requests_assigned` (`assigned_to`)
        ) ENGINE=InnoDB
        ";
        
        $pdo->exec($sql);
        echo "Service requests table created successfully!\n";
        
        // Try to add foreign keys if the related tables exist
        try {
            $pdo->exec("ALTER TABLE service_requests ADD CONSTRAINT `fk_requests_guest` FOREIGN KEY (`guest_id`) REFERENCES `guests`(`id`) ON DELETE CASCADE");
            echo "Added foreign key for guest_id.\n";
        } catch (Exception $e) {
            echo "Note: Could not add guest_id foreign key (guests table may not exist).\n";
        }
        
        try {
            $pdo->exec("ALTER TABLE service_requests ADD CONSTRAINT `fk_requests_staff` FOREIGN KEY (`assigned_to`) REFERENCES `staff`(`id`) ON DELETE SET NULL");
            echo "Added foreign key for assigned_to.\n";
        } catch (Exception $e) {
            echo "Note: Could not add assigned_to foreign key (staff table may not exist).\n";
        }
    }
    
    echo "\n=== Done ===\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "</pre>";
