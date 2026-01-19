<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('POST');

$body = get_json_body();
$login = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');
$requestedRole = strtolower(trim((string)($body['role'] ?? '')));

if ($login === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'email and password are required'], 400);
}

if ($requestedRole !== '' && !in_array($requestedRole, ['admin', 'staff', 'guest'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid role'], 400);
}

try {
    $pdo = db();
    $user = null;

    // Query with LEFT JOIN to guests table for room_number
    $baseSelect = 'SELECT u.id, u.role, u.full_name, u.username, u.email, u.password_hash, u.active, g.room_number FROM users u LEFT JOIN guests g ON u.id = g.user_id';

    // Prefer username > room_number (from guests) > email
    $stmt = $pdo->prepare($baseSelect . ' WHERE u.username = :login LIMIT 1');
    $stmt->execute([':login' => $login]);
    $user = $stmt->fetch();

    if (!$user) {
        // Check by room_number in guests table
        $stmt = $pdo->prepare($baseSelect . ' WHERE g.room_number = :login LIMIT 1');
        $stmt->execute([':login' => $login]);
        $user = $stmt->fetch();
    }

    if (!$user) {
        $cntStmt = $pdo->prepare('SELECT COUNT(*) FROM users WHERE email = :login');
        $cntStmt->execute([':login' => $login]);
        $count = (int)$cntStmt->fetchColumn();

        if ($count > 1) {
            json_response(['ok' => false, 'error' => 'Multiple accounts use this email. Please login with your username instead.'], 409);
        }

        $stmt = $pdo->prepare($baseSelect . ' WHERE u.email = :login LIMIT 1');
        $stmt->execute([':login' => $login]);
        $user = $stmt->fetch();
    }

    if (!$user || (int)$user['active'] !== 1) {
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    if (!password_verify($password, $user['password_hash'])) {
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    if ($requestedRole !== '' && strtolower((string)$user['role']) !== $requestedRole) {
        json_response(['ok' => false, 'error' => 'Selected user type does not match this account'], 403);
    }

    $sessionUser = [
        'id' => (int)$user['id'],
        'role' => $user['role'],
        'full_name' => $user['full_name'],
        'username' => $user['username'] ?? null,
        'email' => $user['email'],
        'room_number' => $user['room_number'] ?? null,
    ];

    set_session_user($sessionUser);
    json_response(['ok' => true, 'user' => $sessionUser]);
} catch (Throwable $e) {
    $msg = $e->getMessage();
    if (stripos($msg, 'Unknown column') !== false && stripos($msg, 'username') !== false) {
        json_response(['ok' => false, 'error' => 'Database not updated: username column is missing. Run ALTER TABLE users ADD COLUMN username VARCHAR(80) NULL, ADD UNIQUE KEY uniq_users_username (username).'], 500);
    }
    if (stripos($msg, 'Base table or view not found') !== false || stripos($msg, "Table '") !== false) {
        json_response(['ok' => false, 'error' => 'Database table not found. Import php/schema.sql into your MySQL database and ensure DB_NAME matches in .env.'], 500);
    }
    if (stripos($msg, 'Access denied for user') !== false) {
        json_response(['ok' => false, 'error' => 'Database credentials are incorrect. Update DB_USER/DB_PASS in .env to match your MySQL user.'], 500);
    }
    if (stripos($msg, 'Unknown database') !== false) {
        json_response(['ok' => false, 'error' => 'Database name not found. Create/import the database and ensure DB_NAME in .env is correct.'], 500);
    }
    if (stripos($msg, 'SQLSTATE[HY000]') !== false || stripos($msg, 'Connection refused') !== false) {
        json_response(['ok' => false, 'error' => 'Database connection failed. Check your .env DB_HOST/DB_PORT/DB_USER/DB_PASS/DB_NAME and ensure MySQL is running.'], 500);
    }

    json_response(['ok' => false, 'error' => $msg], 500);
}
