<?php
/**
 * Fix schema - add missing columns
 */

declare(strict_types=1);

require_once __DIR__ . '/lib/db.php';

try {
    $pdo = db();
    $pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
    
    echo "Checking and fixing schema...\n\n";
    
    // Get current columns in users table
    $columns = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    
    // Add phone_number if missing
    if (!in_array('phone_number', $columns)) {
        echo "Adding phone_number column to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN phone_number VARCHAR(30) NULL AFTER email");
        echo "  Done!\n";
    } else {
        echo "phone_number column already exists.\n";
    }
    
    // Add created_by if missing
    if (!in_array('created_by', $columns)) {
        echo "Adding created_by column to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN created_by BIGINT UNSIGNED NULL AFTER password_hash");
        echo "  Done!\n";
    } else {
        echo "created_by column already exists.\n";
    }
    
    // Add active if missing
    if (!in_array('active', $columns)) {
        echo "Adding active column to users table...\n";
        $pdo->exec("ALTER TABLE users ADD COLUMN active TINYINT(1) NOT NULL DEFAULT 1");
        echo "  Done!\n";
    } else {
        echo "active column already exists.\n";
    }
    
    echo "\nSchema fix completed!\n";
    
} catch (Throwable $e) {
    echo "Error: " . $e->getMessage() . "\n";
}
