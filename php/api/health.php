<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/env.php';

handle_options();
require_method('GET');

try {
    load_env(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env');

    $host = getenv('DB_HOST') ?: 'localhost';
    $port = getenv('DB_PORT') ?: '3306';
    $name = getenv('DB_NAME') ?: 'golden';
    $user = getenv('DB_USER') ?: 'root';

    $pdo = db();

    $dbName = (string)$pdo->query('SELECT DATABASE()')->fetchColumn();

    $tableExists = false;
    $columns = [];

    try {
        $stmt = $pdo->query("SHOW TABLES LIKE 'users'");
        $tableExists = (bool)$stmt->fetchColumn();

        if ($tableExists) {
            $colsStmt = $pdo->query("SHOW COLUMNS FROM users");
            $columns = $colsStmt->fetchAll();
        }
    } catch (Throwable $e) {
        // ignore and report below
    }

    json_response([
        'ok' => true,
        'running_file' => __FILE__,
        'env_loaded' => is_file(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env'),
        'db' => [
            'configured' => [
                'host' => $host,
                'port' => $port,
                'name' => $name,
                'user' => $user,
            ],
            'connected_database' => $dbName,
        ],
        'users_table' => [
            'exists' => $tableExists,
            'columns' => array_map(static fn($c) => $c['Field'] ?? $c[0] ?? null, $columns),
        ],
    ]);
} catch (Throwable $e) {
    json_response([
        'ok' => false,
        'running_file' => __FILE__,
        'error' => $e->getMessage(),
    ], 500);
}
