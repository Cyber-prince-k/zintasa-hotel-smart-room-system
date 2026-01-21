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

$method = $_SERVER['REQUEST_METHOD'];
$pdo = db();
$role = strtolower($user['role'] ?? '');
$userId = (int)$user['id'];

// GET - Fetch service requests
if ($method === 'GET') {
    try {
        if ($role === 'guest') {
            // Get guest's room number from session or DB
            $roomNumber = $user['room_number'] ?? null;
            if (!$roomNumber) {
                $stmt = $pdo->prepare("SELECT room_number FROM guests WHERE user_id = ?");
                $stmt->execute([$userId]);
                $guest = $stmt->fetch(PDO::FETCH_ASSOC);
                $roomNumber = $guest['room_number'] ?? null;
            }
            
            if (!$roomNumber) {
                echo json_encode(['ok' => true, 'requests' => []]);
                exit;
            }
            
            $stmt = $pdo->prepare("
                SELECT sr.*, u.full_name as assigned_staff_name
                FROM service_requests sr
                LEFT JOIN staff s ON sr.assigned_to = s.id
                LEFT JOIN users u ON s.user_id = u.id
                WHERE sr.room_number = ?
                ORDER BY sr.created_at DESC
                LIMIT 50
            ");
            $stmt->execute([$roomNumber]);
        } else {
            // Staff/Admin - get all or filtered requests
            $status = $_GET['status'] ?? null;
            $room = $_GET['room'] ?? null;
            
            $sql = "
                SELECT sr.*, u.full_name as guest_name, su.full_name as assigned_staff_name
                FROM service_requests sr
                LEFT JOIN guests g ON sr.guest_id = g.id
                LEFT JOIN users u ON g.user_id = u.id
                LEFT JOIN staff s ON sr.assigned_to = s.id
                LEFT JOIN users su ON s.user_id = su.id
                WHERE 1=1
            ";
            $params = [];
            
            if ($status) {
                $sql .= " AND sr.status = ?";
                $params[] = $status;
            }
            if ($room) {
                $sql .= " AND sr.room_number = ?";
                $params[] = $room;
            }
            
            $sql .= " ORDER BY 
                CASE sr.priority 
                    WHEN 'urgent' THEN 1 
                    WHEN 'high' THEN 2 
                    WHEN 'medium' THEN 3 
                    WHEN 'low' THEN 4 
                END,
                sr.created_at DESC
                LIMIT 100";
            
            $stmt = $pdo->prepare($sql);
            $stmt->execute($params);
        }
        
        $requests = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['ok' => true, 'requests' => $requests]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch requests: ' . $e->getMessage()]);
    }
    exit;
}

// POST - Create a new service request
if ($method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $requestType = $input['request_type'] ?? '';
        $description = trim($input['description'] ?? '');
        $priority = $input['priority'] ?? 'medium';
        $preferredTime = $input['preferred_time'] ?? null;
        
        $validTypes = ['housekeeping', 'room_service', 'maintenance', 'laundry', 'amenities', 'other'];
        if (!in_array($requestType, $validTypes)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Invalid request type']);
            exit;
        }
        
        // Get guest info
        $roomNumber = $user['room_number'] ?? null;
        $guestId = null;
        
        if ($role === 'guest') {
            $stmt = $pdo->prepare("SELECT id, room_number FROM guests WHERE user_id = ?");
            $stmt->execute([$userId]);
            $guest = $stmt->fetch(PDO::FETCH_ASSOC);
            $guestId = $guest['id'] ?? null;
            $roomNumber = $guest['room_number'] ?? $roomNumber;
        } else {
            // Staff creating on behalf of a guest
            $roomNumber = $input['room_number'] ?? null;
            if ($roomNumber) {
                $stmt = $pdo->prepare("SELECT id FROM guests WHERE room_number = ? LIMIT 1");
                $stmt->execute([$roomNumber]);
                $guest = $stmt->fetch(PDO::FETCH_ASSOC);
                $guestId = $guest['id'] ?? null;
            }
        }
        
        if (!$guestId || !$roomNumber) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Guest or room information missing']);
            exit;
        }
        
        $stmt = $pdo->prepare("
            INSERT INTO service_requests (guest_id, room_number, request_type, priority, description, preferred_time, status)
            VALUES (?, ?, ?, ?, ?, ?, 'pending')
        ");
        $stmt->execute([$guestId, $roomNumber, $requestType, $priority, $description, $preferredTime]);
        
        $requestId = $pdo->lastInsertId();
        
        // Fetch the created request
        $stmt = $pdo->prepare("SELECT * FROM service_requests WHERE id = ?");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode(['ok' => true, 'request' => $request]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to create request: ' . $e->getMessage()]);
    }
    exit;
}

// PUT - Update a service request (staff only)
if ($method === 'PUT') {
    if ($role === 'guest') {
        http_response_code(403);
        echo json_encode(['ok' => false, 'error' => 'Only staff can update requests']);
        exit;
    }
    
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $requestId = (int)($input['id'] ?? 0);
        $status = $input['status'] ?? null;
        $assignedTo = $input['assigned_to'] ?? null;
        
        if (!$requestId) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Request ID required']);
            exit;
        }
        
        $updates = [];
        $params = [];
        
        if ($status) {
            $validStatuses = ['pending', 'assigned', 'in_progress', 'completed', 'cancelled'];
            if (in_array($status, $validStatuses)) {
                $updates[] = "status = ?";
                $params[] = $status;
                if ($status === 'completed') {
                    $updates[] = "completed_at = NOW()";
                }
            }
        }
        
        if ($assignedTo !== null) {
            $updates[] = "assigned_to = ?";
            $params[] = $assignedTo ?: null;
            if ($assignedTo && (!$status || $status === 'pending')) {
                $updates[] = "status = 'assigned'";
            }
        }
        
        if (empty($updates)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'No valid updates provided']);
            exit;
        }
        
        $params[] = $requestId;
        $sql = "UPDATE service_requests SET " . implode(', ', $updates) . " WHERE id = ?";
        $stmt = $pdo->prepare($sql);
        $stmt->execute($params);
        
        // Fetch updated request
        $stmt = $pdo->prepare("SELECT * FROM service_requests WHERE id = ?");
        $stmt->execute([$requestId]);
        $request = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode(['ok' => true, 'request' => $request]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to update request: ' . $e->getMessage()]);
    }
    exit;
}

// DELETE - Cancel a service request
if ($method === 'DELETE') {
    try {
        $requestId = (int)($_GET['id'] ?? 0);
        
        if (!$requestId) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Request ID required']);
            exit;
        }
        
        // Guests can only cancel their own pending requests
        if ($role === 'guest') {
            $stmt = $pdo->prepare("
                UPDATE service_requests sr
                JOIN guests g ON sr.guest_id = g.id
                SET sr.status = 'cancelled'
                WHERE sr.id = ? AND g.user_id = ? AND sr.status = 'pending'
            ");
            $stmt->execute([$requestId, $userId]);
        } else {
            $stmt = $pdo->prepare("UPDATE service_requests SET status = 'cancelled' WHERE id = ?");
            $stmt->execute([$requestId]);
        }
        
        echo json_encode(['ok' => true]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to cancel request: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
