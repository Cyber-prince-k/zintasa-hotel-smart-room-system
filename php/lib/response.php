<?php

declare(strict_types=1);

function log_exception(Throwable $e): void {
    $msg = $e::class . ': ' . $e->getMessage() . "\n" . $e->getTraceAsString();
    error_log($msg);
}

function json_exception(Throwable $e, string $publicMessage = 'Server error', int $status = 500): void {
    log_exception($e);
    json_response(['ok' => false, 'error' => $publicMessage], $status);
}

function json_response(array $data, int $status = 200): void {
    http_response_code($status);
    header('Content-Type: application/json; charset=utf-8');
    header('Access-Control-Allow-Origin: *');
    header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-Setup-Token');
    header('Access-Control-Allow-Methods: GET, POST, OPTIONS');
    echo json_encode($data, JSON_UNESCAPED_SLASHES);
    exit;
}

function handle_options(): void {
    if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
        json_response(['ok' => true], 200);
    }
}

function require_method(string $method): void {
    if (strtoupper($_SERVER['REQUEST_METHOD'] ?? '') !== strtoupper($method)) {
        json_response(['ok' => false, 'error' => 'Method not allowed'], 405);
    }
}

function get_json_body(): array {
    $raw = file_get_contents('php://input');
    if ($raw === false || trim($raw) === '') {
        return [];
    }

    $data = json_decode($raw, true);
    if (!is_array($data)) {
        json_response(['ok' => false, 'error' => 'Invalid JSON body'], 400);
    }
    return $data;
}
