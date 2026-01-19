<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('POST');

load_env(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env');
$setupToken = getenv('SETUP_TOKEN') ?: '';
$provided = $_SERVER['HTTP_X_SETUP_TOKEN'] ?? '';

if ($setupToken === '' || !hash_equals($setupToken, $provided)) {
    json_response(['ok' => false, 'error' => 'Forbidden'], 403);
}

$body = get_json_body();
$fullName = trim((string)($body['full_name'] ?? ''));
$username = trim((string)($body['username'] ?? ''));
$email = trim((string)($body['email'] ?? ''));
$password = (string)($body['password'] ?? '');

if ($fullName === '' || $email === '' || $password === '') {
    json_response(['ok' => false, 'error' => 'full_name, email, password are required'], 400);
}

try {
    $pdo = db();

    $exists = (int)$pdo->query("SELECT COUNT(*) FROM users WHERE role='admin'")->fetchColumn();
    if ($exists > 0) {
        json_response(['ok' => false, 'error' => 'Admin already exists'], 409);
    }

    $hash = password_hash($password, PASSWORD_DEFAULT);

    $pdo->beginTransaction();

    // Insert into base users table
    $stmt = $pdo->prepare('INSERT INTO users (role, full_name, username, email, password_hash) VALUES (\'admin\', :full_name, :username, :email, :password_hash)');
    $stmt->execute([
        ':full_name' => $fullName,
        ':username' => $username !== '' ? $username : null,
        ':email' => $email,
        ':password_hash' => $hash,
    ]);

    $userId = (int)$pdo->lastInsertId();

    // Insert into admins table with super_admin access level for first admin
    $stmt = $pdo->prepare('INSERT INTO admins (user_id, access_level) VALUES (:user_id, :access_level)');
    $stmt->execute([
        ':user_id' => $userId,
        ':access_level' => 'super_admin',
    ]);

    $pdo->commit();

    set_session_user(['id' => $userId, 'role' => 'admin', 'full_name' => $fullName, 'username' => $username !== '' ? $username : null, 'email' => $email]);

    json_response(['ok' => true, 'user' => ['id' => $userId, 'role' => 'admin', 'full_name' => $fullName, 'username' => $username !== '' ? $username : null, 'email' => $email]]);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo instanceof PDO && $pdo->inTransaction()) {
        $pdo->rollBack();
    }
    json_exception($e);
}
