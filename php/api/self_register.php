<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('POST');

$body = get_json_body();

$role = strtolower(trim((string)($body['role'] ?? '')));
$fullName = trim((string)($body['full_name'] ?? ''));
$username = trim((string)($body['username'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if (!in_array($role, ['admin', 'staff'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid role'], 400);
}

if ($fullName === '' || $username === '' || $email === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'full_name, username, email, password are required'], 400);
}

try {
    $pdo = db();

    if ($role === 'admin') {
        $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
        if ($adminCount >= 3) {
            json_response(['ok' => false, 'error' => 'Admin account limit reached (max 3)'], 403);
        }
    }

    $passwordHash = password_hash($password, PASSWORD_DEFAULT);

    $pdo->beginTransaction();

    // Insert into base users table
    $stmt = $pdo->prepare('INSERT INTO users (role, full_name, username, email, password_hash, created_by) VALUES (:role, :full_name, :username, :email, :password_hash, NULL)');
    $stmt->execute([
        ':role' => $role,
        ':full_name' => $fullName,
        ':username' => $username,
        ':email' => $email,
        ':password_hash' => $passwordHash,
    ]);

    $newUserId = (int)$pdo->lastInsertId();

    // Insert into role-specific table
    if ($role === 'admin') {
        $stmt = $pdo->prepare('INSERT INTO admins (user_id, access_level) VALUES (:user_id, :access_level)');
        $stmt->execute([
            ':user_id' => $newUserId,
            ':access_level' => 'admin',
        ]);
    } elseif ($role === 'staff') {
        $stmt = $pdo->prepare('INSERT INTO staff (user_id, department) VALUES (:user_id, :department)');
        $stmt->execute([
            ':user_id' => $newUserId,
            ':department' => 'front_desk',
        ]);
    }

    $pdo->commit();

    $createdUser = [
        'id' => $newUserId,
        'role' => $role,
        'full_name' => $fullName,
        'username' => $username,
        'email' => $email,
        'room_number' => null,
    ];

    json_response(['ok' => true, 'user' => $createdUser], 201);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }

    $msg = $e->getMessage();
    if (stripos($msg, 'Unknown column') !== false && stripos($msg, 'username') !== false) {
        json_response(['ok' => false, 'error' => 'Database not updated: username column is missing. Run ALTER TABLE users ADD COLUMN username VARCHAR(80) NULL, ADD UNIQUE KEY uniq_users_username (username).'], 500);
    }
    if (stripos($msg, 'Base table or view not found') !== false || stripos($msg, "Table '" ) !== false) {
        json_response(['ok' => false, 'error' => 'Database table not found. Import php/schema.sql into your MySQL database and ensure DB_NAME matches in .env.'], 500);
    }
    if (stripos($msg, 'uniq_users_username') !== false) {
        json_response(['ok' => false, 'error' => 'Username already exists'], 409);
    }
    if (stripos($msg, 'uniq_users_email') !== false) {
        json_response(['ok' => false, 'error' => 'Email already exists'], 409);
    }

    json_exception($e, 'Failed to create account', 400);
}
