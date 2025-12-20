<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('GET');

try {
    $user = current_user();
    json_response(['ok' => true, 'user' => $user]);
} catch (Throwable $e) {
    json_exception($e);
}
