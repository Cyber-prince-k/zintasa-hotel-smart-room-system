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

$phoneNumber = trim((string)($body['phone_number'] ?? ''));

// Guest-specific fields
$roomNumber = trim((string)($body['room_number'] ?? ''));
$keyCardId = trim((string)($body['key_card_id'] ?? ''));

// Staff-specific fields
$department = trim((string)($body['department'] ?? 'front_desk'));
$employeeId = trim((string)($body['employee_id'] ?? ''));

// Admin-specific fields
$accessLevel = trim((string)($body['access_level'] ?? 'admin'));

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
    // Auto-assign room if not provided
    if ($roomNumber === '') {
        // Get occupied rooms from guests table
        $occupied = $pdo->query("SELECT room_number FROM guests WHERE room_number IS NOT NULL")->fetchAll(PDO::FETCH_COLUMN);
        $occupiedSet = [];
        foreach ($occupied as $r) {
            $k = trim((string)$r);
            if ($k !== '') {
                $occupiedSet[$k] = true;
            }
        }

        $assigned = null;
        // Inventory: floors 1-4, rooms 01-40 => 101-140, 201-240, 301-340, 401-440
        for ($floor = 1; $floor <= 4 && $assigned === null; $floor++) {
            for ($n = 1; $n <= 40; $n++) {
                $candidate = (string)(($floor * 100) + $n);
                if (!isset($occupiedSet[$candidate])) {
                    $assigned = $candidate;
                    break;
                }
            }
        }

        if ($assigned === null) {
            json_response(['ok' => false, 'error' => 'No vacant rooms available'], 409);
        }
        $roomNumber = $assigned;
    }

    // 7-character access code (letters + digits)
    $alphabet = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
    $generatedGuestCode = '';
    $bytes = random_bytes(7);
    for ($i = 0; $i < 7; $i++) {
        $generatedGuestCode .= $alphabet[ord($bytes[$i]) % strlen($alphabet)];
    }
    $passwordHash = password_hash($generatedGuestCode, PASSWORD_DEFAULT);
} else {
    if ($password === '') {
        json_response(['ok' => false, 'error' => 'password is required for staff/admin'], 400);
    }
    $passwordHash = password_hash($password, PASSWORD_DEFAULT);
}

try {
    $pdo->beginTransaction();

    // Get creator ID
    $creatorId = (int)($actor['id'] ?? 0);
    if ($creatorId > 0) {
        $chk = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
        $chk->execute([':id' => $creatorId]);
        if (!$chk->fetch()) {
            $creatorId = 0;
        }
    }

    // Insert into base users table
    $stmt = $pdo->prepare('INSERT INTO users (role, full_name, username, email, phone_number, password_hash, created_by) VALUES (:role, :full_name, :username, :email, :phone_number, :password_hash, :created_by)');
    $stmt->execute([
        ':role' => $role,
        ':full_name' => $fullName,
        ':username' => $username !== '' ? $username : null,
        ':email' => $email,
        ':phone_number' => $phoneNumber !== '' ? $phoneNumber : null,
        ':password_hash' => $passwordHash,
        ':created_by' => $creatorId > 0 ? $creatorId : null,
    ]);

    $newUserId = (int)$pdo->lastInsertId();

    // Insert into role-specific table
    if ($role === 'guest') {
        $stmt = $pdo->prepare('INSERT INTO guests (user_id, room_number, key_card_id, guest_code) VALUES (:user_id, :room_number, :key_card_id, :guest_code)');
        $stmt->execute([
            ':user_id' => $newUserId,
            ':room_number' => $roomNumber !== '' ? $roomNumber : null,
            ':key_card_id' => $keyCardId !== '' ? $keyCardId : null,
            ':guest_code' => $generatedGuestCode,
        ]);
    } elseif ($role === 'staff') {
        $stmt = $pdo->prepare('INSERT INTO staff (user_id, employee_id, department) VALUES (:user_id, :employee_id, :department)');
        $stmt->execute([
            ':user_id' => $newUserId,
            ':employee_id' => $employeeId !== '' ? $employeeId : null,
            ':department' => $department,
        ]);
    } elseif ($role === 'admin') {
        $stmt = $pdo->prepare('INSERT INTO admins (user_id, access_level) VALUES (:user_id, :access_level)');
        $stmt->execute([
            ':user_id' => $newUserId,
            ':access_level' => $accessLevel,
        ]);
    }

    $pdo->commit();
} catch (Throwable $e) {
    if ($pdo->inTransaction()) {
        $pdo->rollBack();
    }

    json_response([
        'ok' => false,
        'error' => 'Failed to create user',
        'error_detail' => $e->getMessage(),
    ], 400);
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
            'guest_code' => $generatedGuestCode,
            'warning' => 'Guest created but email failed. Configure SMTP and resend code manually.',
            'warning_detail' => $e->getMessage(),
        ], 201);
    }
}

json_response([
    'ok' => true,
    'user' => ['id' => $newUserId, 'role' => $role, 'full_name' => $fullName, 'email' => $email, 'room_number' => $roomNumber !== '' ? $roomNumber : null],
], 201);
