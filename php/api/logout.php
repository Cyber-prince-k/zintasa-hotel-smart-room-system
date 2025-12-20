<?php

declare(strict_types=1);

require_once __DIR__ . '/../lib/response.php';
require_once __DIR__ . '/../lib/auth.php';

handle_options();
require_method('POST');

try {
    clear_session();
    json_response(['ok' => true]);
} catch (Throwable $e) {
    json_exception($e);
}
