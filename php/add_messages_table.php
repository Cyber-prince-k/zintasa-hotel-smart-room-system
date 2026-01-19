<?php
declare(strict_types=1);
require_once __DIR__ . '/lib/db.php';

echo "<pre>";
echo "=== Adding Messages Table ===\n\n";

try {
    $pdo = db();
    
    // Check if messages table already exists
    $stmt = $pdo->query("SHOW TABLES LIKE 'messages'");
    if ($stmt->fetch()) {
        echo "Messages table already exists.\n";
    } else {
        echo "Creating messages table...\n";
        
        $sql = "
        CREATE TABLE IF NOT EXISTS `messages` (
          `id` BIGINT UNSIGNED NOT NULL AUTO_INCREMENT,
          `sender_id` BIGINT UNSIGNED NOT NULL,
          `recipient_id` BIGINT UNSIGNED NULL,
          `room_number` VARCHAR(20) NULL,
          `message` TEXT NOT NULL,
          `is_from_guest` TINYINT(1) NOT NULL DEFAULT 1,
          `is_read` TINYINT(1) NOT NULL DEFAULT 0,
          `created_at` TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
          PRIMARY KEY (`id`),
          KEY `idx_messages_sender` (`sender_id`),
          KEY `idx_messages_recipient` (`recipient_id`),
          KEY `idx_messages_room` (`room_number`),
          KEY `idx_messages_created` (`created_at`),
          CONSTRAINT `fk_messages_sender` FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`) ON DELETE CASCADE,
          CONSTRAINT `fk_messages_recipient` FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
        ) ENGINE=InnoDB
        ";
        
        $pdo->exec($sql);
        echo "Messages table created successfully!\n";
    }
    
    echo "\n=== Done ===\n";
} catch (Exception $e) {
    echo "Error: " . $e->getMessage() . "\n";
}

echo "</pre>";
