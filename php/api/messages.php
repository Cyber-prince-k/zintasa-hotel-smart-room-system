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

// GET - Fetch messages
if ($method === 'GET') {
    try {
        $userId = (int)$user['id'];
        $role = $user['role'];
        
        // Get room_number for guests
        $roomNumber = null;
        if ($role === 'guest') {
            $stmt = $pdo->prepare("SELECT room_number FROM guests WHERE user_id = ?");
            $stmt->execute([$userId]);
            $guest = $stmt->fetch(PDO::FETCH_ASSOC);
            $roomNumber = $guest['room_number'] ?? null;
        }
        
        // For guests: get messages for their room
        // For staff/admin: get messages for a specific room (via query param) or all
        if ($role === 'guest' && $roomNumber) {
            $stmt = $pdo->prepare("
                SELECT m.*, u.full_name as sender_name, u.role as sender_role
                FROM messages m
                JOIN users u ON m.sender_id = u.id
                WHERE m.room_number = ?
                ORDER BY m.created_at ASC
                LIMIT 100
            ");
            $stmt->execute([$roomNumber]);
        } elseif ($role === 'staff' || $role === 'admin') {
            $filterRoom = $_GET['room'] ?? null;
            if ($filterRoom) {
                $stmt = $pdo->prepare("
                    SELECT m.*, u.full_name as sender_name, u.role as sender_role
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    WHERE m.room_number = ?
                    ORDER BY m.created_at ASC
                    LIMIT 100
                ");
                $stmt->execute([$filterRoom]);
            } else {
                // Get all recent messages grouped by room
                $stmt = $pdo->prepare("
                    SELECT m.*, u.full_name as sender_name, u.role as sender_role
                    FROM messages m
                    JOIN users u ON m.sender_id = u.id
                    ORDER BY m.created_at DESC
                    LIMIT 100
                ");
                $stmt->execute();
            }
        } else {
            echo json_encode(['ok' => true, 'messages' => []]);
            exit;
        }
        
        $messages = $stmt->fetchAll(PDO::FETCH_ASSOC);
        
        // Mark messages as read for the current user
        if ($role === 'guest' && $roomNumber) {
            $pdo->prepare("UPDATE messages SET is_read = 1 WHERE room_number = ? AND is_from_guest = 0")->execute([$roomNumber]);
        }
        
        echo json_encode(['ok' => true, 'messages' => $messages, 'room_number' => $roomNumber]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch messages: ' . $e->getMessage()]);
    }
    exit;
}

// POST - Send a message
if ($method === 'POST') {
    try {
        $input = json_decode(file_get_contents('php://input'), true);
        $messageText = trim($input['message'] ?? '');
        $targetRoom = $input['room_number'] ?? null;
        
        if (empty($messageText)) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Message cannot be empty']);
            exit;
        }
        
        $userId = (int)$user['id'];
        $role = $user['role'];
        $isFromGuest = ($role === 'guest') ? 1 : 0;
        
        // Get room number
        $roomNumber = $targetRoom;
        if ($role === 'guest') {
            $stmt = $pdo->prepare("SELECT room_number FROM guests WHERE user_id = ?");
            $stmt->execute([$userId]);
            $guest = $stmt->fetch(PDO::FETCH_ASSOC);
            $roomNumber = $guest['room_number'] ?? null;
            
            if (!$roomNumber) {
                http_response_code(400);
                echo json_encode(['ok' => false, 'error' => 'No room assigned']);
                exit;
            }
        }
        
        if (!$roomNumber) {
            http_response_code(400);
            echo json_encode(['ok' => false, 'error' => 'Room number required']);
            exit;
        }
        
        // Insert message
        $stmt = $pdo->prepare("
            INSERT INTO messages (sender_id, room_number, message, is_from_guest, is_read)
            VALUES (?, ?, ?, ?, 0)
        ");
        $stmt->execute([$userId, $roomNumber, $messageText, $isFromGuest]);
        
        $messageId = $pdo->lastInsertId();
        
        // Fetch the inserted message
        $stmt = $pdo->prepare("
            SELECT m.*, u.full_name as sender_name, u.role as sender_role
            FROM messages m
            JOIN users u ON m.sender_id = u.id
            WHERE m.id = ?
        ");
        $stmt->execute([$messageId]);
        $message = $stmt->fetch(PDO::FETCH_ASSOC);
        
        echo json_encode(['ok' => true, 'message' => $message]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to send message: ' . $e->getMessage()]);
    }
    exit;
}

// Get rooms with unread messages (for staff)
if ($method === 'GET' && isset($_GET['unread'])) {
    try {
        $stmt = $pdo->prepare("
            SELECT room_number, COUNT(*) as unread_count
            FROM messages
            WHERE is_from_guest = 1 AND is_read = 0
            GROUP BY room_number
        ");
        $stmt->execute();
        $rooms = $stmt->fetchAll(PDO::FETCH_ASSOC);
        echo json_encode(['ok' => true, 'rooms' => $rooms]);
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch unread: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
