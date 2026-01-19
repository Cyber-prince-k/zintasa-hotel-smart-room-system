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

    // Get available columns in users table
    $columns = $pdo->query("SHOW COLUMNS FROM users")->fetchAll(PDO::FETCH_COLUMN);
    $hasPhoneNumber = in_array('phone_number', $columns);
    $hasCreatedBy = in_array('created_by', $columns);

    // Get creator ID if column exists
    $creatorId = 0;
    if ($hasCreatedBy) {
        $creatorId = (int)($actor['id'] ?? 0);
        if ($creatorId > 0) {
            $chk = $pdo->prepare('SELECT id FROM users WHERE id = :id LIMIT 1');
            $chk->execute([':id' => $creatorId]);
            if (!$chk->fetch()) {
                $creatorId = 0;
            }
        }
    }

    // Build dynamic INSERT query based on available columns
    $insertCols = ['role', 'full_name', 'username', 'email', 'password_hash'];
    $insertParams = [
        ':role' => $role,
        ':full_name' => $fullName,
        ':username' => $username !== '' ? $username : null,
        ':email' => $email,
        ':password_hash' => $passwordHash,
    ];

    if ($hasPhoneNumber) {
        $insertCols[] = 'phone_number';
        $insertParams[':phone_number'] = $phoneNumber !== '' ? $phoneNumber : null;
    }
    if ($hasCreatedBy) {
        $insertCols[] = 'created_by';
        $insertParams[':created_by'] = $creatorId > 0 ? $creatorId : null;
    }

    $placeholders = array_map(fn($c) => ':' . $c, $insertCols);
    $sql = 'INSERT INTO users (' . implode(', ', $insertCols) . ') VALUES (' . implode(', ', $placeholders) . ')';
    $stmt = $pdo->prepare($sql);
    $stmt->execute($insertParams);

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

    $msg = $e->getMessage();

    // Handle specific database errors
    if (stripos($msg, 'Duplicate entry') !== false && stripos($msg, 'email') !== false) {
        json_response(['ok' => false, 'error' => 'Email address already exists'], 409);
    }
    if (stripos($msg, 'Duplicate entry') !== false && stripos($msg, 'username') !== false) {
        json_response(['ok' => false, 'error' => 'Username already exists'], 409);
    }
    if (stripos($msg, "Table") !== false && stripos($msg, "doesn't exist") !== false) {
        json_response(['ok' => false, 'error' => 'Database tables not found. Please import the new schema.sql file.'], 500);
    }
    if (stripos($msg, 'Unknown column') !== false) {
        json_response(['ok' => false, 'error' => 'Database schema outdated. Please import the new schema.sql file.'], 500);
    }

    json_response([
        'ok' => false,
        'error' => $msg,
    ], 400);
}

// Email guest code (after DB commit)
if ($role === 'guest' && $generatedGuestCode !== null) {
    try {
        $subject = 'Welcome to Golden Peacock Hotel - Your Room Access Details';
        $safeRoom = htmlspecialchars($roomNumber, ENT_QUOTES, 'UTF-8');
        $safeCode = htmlspecialchars($generatedGuestCode, ENT_QUOTES, 'UTF-8');
        $safeName = htmlspecialchars($fullName, ENT_QUOTES, 'UTF-8');
        $safeEmail = htmlspecialchars($email, ENT_QUOTES, 'UTF-8');
        $currentYear = date('Y');

        $html = <<<HTML
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
</head>
<body style="margin: 0; padding: 0; font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f4f4f4;">
    <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #f4f4f4; padding: 40px 20px;">
        <tr>
            <td align="center">
                <table role="presentation" width="600" cellspacing="0" cellpadding="0" style="background-color: #ffffff; border-radius: 12px; overflow: hidden; box-shadow: 0 4px 20px rgba(0,0,0,0.1);">
                    <!-- Header -->
                    <tr>
                        <td style="background: linear-gradient(135deg, #1a472a 0%, #2d5a3d 100%); padding: 40px 30px; text-align: center;">
                            <div style="font-size: 36px; margin-bottom: 10px;">👑</div>
                            <h1 style="color: #d4af37; margin: 0; font-size: 28px; font-weight: 600;">Golden Peacock Hotel</h1>
                            <p style="color: #a8c5b5; margin: 8px 0 0 0; font-size: 14px; letter-spacing: 2px;">LUXURY & COMFORT</p>
                        </td>
                    </tr>
                    
                    <!-- Welcome Message -->
                    <tr>
                        <td style="padding: 40px 30px 20px 30px;">
                            <h2 style="color: #1a472a; margin: 0 0 15px 0; font-size: 24px;">Welcome, {$safeName}!</h2>
                            <p style="color: #555555; font-size: 16px; line-height: 1.6; margin: 0;">
                                We are delighted to have you as our guest. Your smart room has been prepared and is ready for your arrival. Below are your access credentials.
                            </p>
                        </td>
                    </tr>
                    
                    <!-- Access Details Card -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background: linear-gradient(135deg, #f8f9fa 0%, #e9ecef 100%); border-radius: 10px; border-left: 4px solid #d4af37;">
                                <tr>
                                    <td style="padding: 25px;">
                                        <h3 style="color: #1a472a; margin: 0 0 20px 0; font-size: 18px;">🔐 Your Access Details</h3>
                                        
                                        <table role="presentation" width="100%" cellspacing="0" cellpadding="0">
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                                                    <span style="color: #6c757d; font-size: 14px;">Room Number</span><br>
                                                    <span style="color: #1a472a; font-size: 24px; font-weight: 700;">{$safeRoom}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0; border-bottom: 1px solid #dee2e6;">
                                                    <span style="color: #6c757d; font-size: 14px;">Access Code (Password)</span><br>
                                                    <span style="color: #d4af37; font-size: 24px; font-weight: 700; letter-spacing: 3px;">{$safeCode}</span>
                                                </td>
                                            </tr>
                                            <tr>
                                                <td style="padding: 12px 0;">
                                                    <span style="color: #6c757d; font-size: 14px;">Login Email</span><br>
                                                    <span style="color: #1a472a; font-size: 16px;">{$safeEmail}</span>
                                                </td>
                                            </tr>
                                        </table>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Instructions -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <h3 style="color: #1a472a; margin: 0 0 15px 0; font-size: 16px;">📱 How to Access Your Smart Room</h3>
                            <ol style="color: #555555; font-size: 14px; line-height: 1.8; margin: 0; padding-left: 20px;">
                                <li>Visit our guest portal or scan the QR code at your room door</li>
                                <li>Enter your room number or email address</li>
                                <li>Use your access code as your password</li>
                                <li>Control your room's lighting, temperature, and request services</li>
                            </ol>
                        </td>
                    </tr>
                    
                    <!-- Security Notice -->
                    <tr>
                        <td style="padding: 0 30px 30px 30px;">
                            <table role="presentation" width="100%" cellspacing="0" cellpadding="0" style="background-color: #fff3cd; border-radius: 8px; border-left: 4px solid #ffc107;">
                                <tr>
                                    <td style="padding: 15px;">
                                        <p style="color: #856404; font-size: 13px; margin: 0;">
                                            <strong>🔒 Security Notice:</strong> Please keep your access code confidential. Do not share it with anyone. If you suspect unauthorized access, contact our front desk immediately.
                                        </p>
                                    </td>
                                </tr>
                            </table>
                        </td>
                    </tr>
                    
                    <!-- Footer -->
                    <tr>
                        <td style="background-color: #1a472a; padding: 30px; text-align: center;">
                            <p style="color: #a8c5b5; font-size: 14px; margin: 0 0 10px 0;">Need assistance? We're here 24/7</p>
                            <p style="color: #d4af37; font-size: 16px; margin: 0 0 20px 0;">📞 +265 996 850 711</p>
                            <p style="color: #6c8f7a; font-size: 12px; margin: 0;">
                                © {$currentYear} Golden Peacock Hotel. All rights reserved.<br>
                                This is an automated message. Please do not reply directly to this email.
                            </p>
                        </td>
                    </tr>
                </table>
            </td>
        </tr>
    </table>
</body>
</html>
HTML;

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
