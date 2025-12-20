<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('POST');

$body = get_json_body();
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($email === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'email and password are required'], 400);
}

try {
    $pdo = db();
    $stmt = $pdo->prepare('SELECT id, role, full_name, email, room_number, password_hash, active FROM users WHERE email = :email LIMIT 1');
    $stmt->execute([':email' => $email]);
    $user = $stmt->fetch();

    if (!$user || (int)$user['active'] !== 1) {
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    if (!password_verify($password, $user['password_hash'])) {
        json_response(['ok' => false, 'error' => 'Invalid credentials'], 401);
    }

    $sessionUser = [
        'id' => (int)$user['id'],
        'role' => $user['role'],
        'full_name' => $user['full_name'],
        'email' => $user['email'],
        'room_number' => $user['room_number'],
    ];

    set_session_user($sessionUser);
    json_response(['ok' => true, 'user' => $sessionUser]);
} catch (Throwable $e) {
    json_exception($e);
}
