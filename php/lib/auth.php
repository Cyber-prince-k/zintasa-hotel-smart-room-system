<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';
require_once __DIR__ . '/response.php';

function start_session(): void {
    load_env(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env');
    $name = getenv('SESSION_NAME') ?: 'golden_session';

    if (session_status() !== PHP_SESSION_ACTIVE) {
        session_name($name);
        session_start([
            'cookie_httponly' => true,
            'cookie_samesite' => 'Lax',
        ]);
    }
}

function current_user(): ?array {
    start_session();
    $u = $_SESSION['user'] ?? null;
    return is_array($u) ? $u : null;
}

function require_login(): array {
    $u = current_user();
    if (!$u) {
        json_response(['ok' => false, 'error' => 'Unauthorized'], 401);
    }
    return $u;
}

function require_role(array $roles): array {
    $u = require_login();
    if (!in_array($u['role'] ?? '', $roles, true)) {
        json_response(['ok' => false, 'error' => 'Forbidden'], 403);
    }
    return $u;
}

function set_session_user(array $user): void {
    start_session();
    $_SESSION['user'] = $user;
}

function clear_session(): void {
    start_session();
    $_SESSION = [];
    if (ini_get('session.use_cookies')) {
        $params = session_get_cookie_params();
        setcookie(session_name(), '', time() - 42000, $params['path'], $params['domain'], $params['secure'] ?? false, $params['httponly'] ?? true);
    }
    session_destroy();
}
