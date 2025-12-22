<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';
require_once __DIR__ . '/../lib/mailer.php';

handle_options();
require_method('POST');

$actor = require_role(['admin', 'staff']);

$body = get_json_body();
$role = strtolower(trim((string)($body['role'] ?? '')));
$fullName = trim((string)($body['full_name'] ?? ''));
$username = trim((string)($body['username'] ?? ''));
$email = trim((string)($body['email'] ?? ''));

$roomNumber = trim((string)($body['room_number'] ?? ''));
$keyCardId = trim((string)($body['key_card_id'] ?? ''));
$password = (string)($body['password'] ?? '');

if (!in_array($role, ['admin', 'staff', 'guest'], true)) {
    json_response(['ok' => false, 'error' => 'Invalid role'], 400);
}
if ($fullName === '' || $email === '') {
    json_response(['ok' => false, 'error' => 'full_name and email are required'], 400);
}

$pdo = db();

// Role rules
if ($role === 'admin' && ($actor['role'] ?? '') !== 'admin') {
    json_response(['ok' => false, 'error' => 'Only admin can create admin accounts'], 403);
}

if ($role === 'admin') {
    $adminCount = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
    if ($adminCount >= 3) {
        json_response(['ok' => false, 'error' => 'Admin account limit reached (max 3)'], 403);
    }
}

$generatedGuestCode = null;

if ($role === 'guest') {
    if ($roomNumber === '') {
        json_response(['ok' => false, 'error' => 'room_number is required for guest'], 400);
    }

    // Room-bound code: ROOM<room>-<6 random chars>
    $rand = strtoupper(substr(bin2hex(random_bytes(4)), 0, 6));
    $generatedGuestCode = 'ROOM' . preg_replace('/\s+/', '', $roomNumber) . '-' . $rand;
    $passwordHash = password_hash($generatedGuestCode, PASSWORD_DEFAULT);
} else {
    if ($password === '') {
        json_response(['ok' => false, 'error' => 'password is required for staff/admin'], 400);
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
}

try {
    $pdo->beginTransaction();

    $stmt = $pdo->prepare('INSERT INTO users (role, full_name, username, email, room_number, key_card_id, password_hash, created_by) VALUES (:role, :full_name, :username, :email, :room_number, :key_card_id, :password_hash, :created_by)');
    $stmt->execute([
        ':role' => $role,
        ':full_name' => $fullName,
        ':username' => $username !== '' ? $username : null,
        ':email' => $email,
        ':room_number' => $roomNumber !== '' ? $roomNumber : null,
        ':key_card_id' => $keyCardId !== '' ? $keyCardId : null,
        ':password_hash' => $passwordHash,
        ':created_by' => (int)$actor['id'],
    ]);

    $newUserId = (int)$pdo->lastInsertId();

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_exception($e, 'Failed to create user', 400);
}

// Email guest code (after DB commit)
if ($role === 'guest' && $generatedGuestCode !== null) {
    try {
        $subject = 'Your Golden Peacock Smart Room Access Code';
        $safeRoom = htmlspecialchars($roomNumber, ENT_QUOTES, 'UTF-8');
        $safeCode = htmlspecialchars($generatedGuestCode, ENT_QUOTES, 'UTF-8');
        $safeName = htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8');

        $html = "<p>Hello {$safeName},</p>\n" .
                "<p>Welcome to Golden Peacock Hotel.</p>\n" .
                "<p>Your room number: <strong>{$safeRoom}</strong></p>\n" .
                "<p>Your login code (password): <strong>{$safeCode}</strong></p>\n" .
                "<p>Please keep this code private.</p>";

        send_email($email, $fullName, $subject, $html);
    } catch (Throwable $e) {
        log_exception($e);
        // User is created; email may fail if SMTP not configured yet
        json_response([
            'ok' => true,
            'user' => ['id' => $newUserId, 'role' => $role, 'full_name' => $fullName, 'email' => $email, 'room_number' => $roomNumber],
            'warning' => 'Guest created but email failed. Configure SMTP and resend code manually.',
        ], 201);
    }
}

json_response([
    'ok' => true,
    'user' => ['id' => $newUserId, 'role' => $role, 'full_name' => $fullName, 'email' => $email, 'room_number' => $roomNumber !== '' ? $roomNumber : null],
], 201);
