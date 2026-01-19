<?php

declare(strict_types=1);

require_once __DIR__ . '/env.php';

function send_email(string $toEmail, string $toName, string $subject, string $htmlBody): void {
    load_env(dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . '.env');

    $autoload = dirname(__DIR__, 2) . DIRECTORY_SEPARATOR . 'vendor' . DIRECTORY_SEPARATOR . 'autoload.php';
    if (!is_file($autoload)) {
        throw new RuntimeException('Missing Composer dependencies. Run: composer install');
    }

    require_once $autoload;

    $host = getenv('SMTP_HOST') ?: 'smtp.gmail.com';
    $port = (int)(getenv('SMTP_PORT') ?: '587');
    $secure = getenv('SMTP_SECURE') ?: 'tls';
    $user = getenv('SMTP_USER') ?: '';
    $pass = getenv('SMTP_PASS') ?: '';
    $from = getenv('SMTP_FROM') ?: $user;
    $fromName = getenv('SMTP_FROM_NAME') ?: 'Golden Peacock Hotel';

    $missing = [];
    if ($user === false || $user === '') {
        $missing[] = 'SMTP_USER';
    }
    if ($pass === false || $pass === '') {
        $missing[] = 'SMTP_PASS';
    }
    if ($from === false || $from === '') {
        $missing[] = 'SMTP_FROM';
    }
    if (!empty($missing)) {
        throw new RuntimeException('SMTP not configured. Missing: ' . implode(', ', $missing));
    }

    $mail = new PHPMailer\PHPMailer\PHPMailer(true);

    $debug = getenv('SMTP_DEBUG') ?: '';
    if ($debug === '1') {
        $mail->SMTPDebug = 2;
        $mail->Debugoutput = static function (string $str, int $level): void {
            error_log('SMTP[' . $level . ']: ' . $str);
        };
    }

    $mail->isSMTP();
    $mail->Host = $host;
    $mail->SMTPAuth = true;
    $mail->Username = $user;
    $mail->Password = $pass;
    $mail->SMTPSecure = $secure;
    $mail->Port = $port;

    $mail->setFrom($from, $fromName);
    $mail->addAddress($toEmail, $toName);

    $mail->isHTML(true);
    $mail->Subject = $subject;
    $mail->Body = $htmlBody;

    $mail->send();
}
