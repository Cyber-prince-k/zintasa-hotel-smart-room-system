<?php
declare(strict_types=1);
require_once __DIR__ . '/../lib/db.php';
require_once __DIR__ . '/../lib/auth.php';

start_session();
header('Content-Type: application/json');

$user = current_user();
if (!$user) {
    http_response_code(401);
    echo json_encode(['ok' => false, 'error' => 'Not authenticated']);
    exit;
}

$role = strtolower($user['role'] ?? '');
if ($role !== 'staff' && $role !== 'admin') {
    http_response_code(403);
    echo json_encode(['ok' => false, 'error' => 'Access denied']);
    exit;
}

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();

// GET - Fetch guests
if ($method === 'GET') {
    try {
        $status = $_GET['status'] ?? null;
        $search = $_GET['search'] ?? null;
        
        $sql = "
            SELECT 
                g.id,
                g.room_number,
                g.check_in_date,
                g.check_out_date,
                g.access_code,
                u.id as user_id,
                u.full_name,
                u.email,
                u.phone_number,
                u.created_at,
                CASE 
                    WHEN g.check_out_date < CURDATE() THEN 'checked_out'
                    WHEN g.check_out_date = CURDATE() THEN 'checkout_today'
                    WHEN g.check_in_date > CURDATE() THEN 'upcoming'
                    ELSE 'active'
                END as status
            FROM guests g
            JOIN users u ON g.user_id = u.id
            WHERE u.active = 1
        ";
        $params = [];
        
        if ($status === 'active') {
            $sql .= " AND g.check_in_date <= CURDATE() AND g.check_out_date >= CURDATE()";
        } elseif ($status === 'checkout_today') {
            $sql .= " AND g.check_out_date = CURDATE()";
        } elseif ($status === 'checked_out') {
            $sql .= " AND g.check_out_date < CURDATE()";
        }
        
        if ($search) {
            $sql .= " AND (u.full_name LIKE ? OR u.email LIKE ? OR g.room_number LIKE ?)";
            $searchParam = "%$search%";
            $params[] = $searchParam;
            $params[] = $searchParam;
            $params[] = $searchParam;
        }
        
        $sql .= " ORDER BY g.check_in_date DESC LIMIT 100";
        
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        $guests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        echo json_encode(['ok' => true, 'guests' => $guests]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch guests: ' . $e->getMessage()]);
    }
    exit;
}

// GET single guest by ID
if ($method === 'GET' && isset($_GET['id'])) {
    try {
        $guestId = (int)$_GET['id'];
        $stmt = $pdo->prepare("
            SELECT g.*, u.full_name, u.email, u.phone_number
            FROM guests g
            JOIN users u ON g.user_id = u.id
            WHERE g.id = ?
        ");
        $stmt->execute([$guestId]);
        $guest = $stmt->fetch(PDO::FETCH_ASSOC);
        
        if (!$guest) {
            http_response_code(404);
            echo json_encode(['ok' => false, 'error' => 'Guest not found']);
            exit;
        }
        
        echo json_encode(['ok' => true, 'guest' => $guest]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch guest: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
