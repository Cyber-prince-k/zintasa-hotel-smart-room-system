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

if ($method === 'GET') {
    try {
        $role = strtolower($user['role'] ?? '');
        $roomNumber = $_GET['room'] ?? null;
        
        // For guests, use their room number
        if ($role === 'guest') {
            $roomNumber = $user['room_number'] ?? null;
            if (!$roomNumber) {
                $stmt = $pdo->prepare("SELECT room_number FROM guests WHERE user_id = ?");
                $stmt->execute([$user['id']]);
                $guest = $stmt->fetch(PDO::FETCH_ASSOC);
                $roomNumber = $guest['room_number'] ?? null;
            }
        }
        
        // Generate energy data based on device states in the room
        $deviceData = [];
        if ($roomNumber) {
            $stmt = $pdo->prepare("
                SELECT device_type, device_name, state, brightness, temperature, speed
                FROM room_devices 
                WHERE room_number = ?
            ");
            $stmt->execute([$roomNumber]);
            $deviceData = $stmt->fetchAll(PDO::FETCH_ASSOC);
        }
        
        // Calculate current consumption based on device states
        $currentConsumption = 0;
        $deviceBreakdown = [];
        
        $powerRatings = [
            'light' => 15,
            'ac' => 1500,
            'tv' => 100,
            'fan' => 75,
            'heater' => 1200,
            'curtains' => 10,
            'thermostat' => 5
        ];
        
        foreach ($deviceData as $device) {
            $type = strtolower($device['device_type'] ?? 'other');
            $basePower = $powerRatings[$type] ?? 50;
            $isOn = ($device['state'] ?? 'off') === 'on';
            
            if ($isOn) {
                $power = $basePower;
                
                // Adjust for brightness/speed
                if (isset($device['brightness'])) {
                    $power = $basePower * ($device['brightness'] / 100);
                }
                if (isset($device['speed'])) {
                    $speeds = ['low' => 0.3, 'medium' => 0.6, 'high' => 1.0];
                    $power = $basePower * ($speeds[$device['speed']] ?? 0.6);
                }
                
                $currentConsumption += $power;
                $deviceBreakdown[] = [
                    'name' => $device['device_name'] ?? $type,
                    'type' => $type,
                    'power' => round($power, 2),
                    'state' => 'on'
                ];
            } else {
                $deviceBreakdown[] = [
                    'name' => $device['device_name'] ?? $type,
                    'type' => $type,
                    'power' => 0,
                    'state' => 'off'
                ];
            }
        }
        
        // Generate hourly data for today (simulated based on typical patterns)
        $hourlyData = [];
        $currentHour = (int)date('G');
        
        for ($h = 0; $h <= $currentHour; $h++) {
            // Simulate consumption pattern (higher during day, lower at night)
            $baseLoad = 50; // Standby devices
            $timeMultiplier = 1.0;
            
            if ($h >= 6 && $h <= 9) $timeMultiplier = 1.5; // Morning peak
            if ($h >= 10 && $h <= 17) $timeMultiplier = 0.8; // Daytime (guest might be out)
            if ($h >= 18 && $h <= 22) $timeMultiplier = 2.0; // Evening peak
            if ($h >= 23 || $h <= 5) $timeMultiplier = 0.3; // Night
            
            $hourlyConsumption = ($baseLoad + rand(20, 100)) * $timeMultiplier;
            $hourlyData[] = [
                'hour' => $h,
                'label' => sprintf('%02d:00', $h),
                'consumption' => round($hourlyConsumption, 2)
            ];
        }
        
        // Generate daily data for the week
        $dailyData = [];
        $days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
        $today = (int)date('w');
        
        for ($d = 0; $d < 7; $d++) {
            $dayIndex = ($today - 6 + $d + 7) % 7;
            $dailyConsumption = rand(800, 2500) / 100; // kWh
            $dailyData[] = [
                'day' => $days[$dayIndex],
                'consumption' => round($dailyConsumption, 2)
            ];
        }
        
        // Calculate totals and savings
        $todayTotal = array_sum(array_column($hourlyData, 'consumption')) / 1000; // kWh
        $weekTotal = array_sum(array_column($dailyData, 'consumption'));
        $avgDaily = $weekTotal / 7;
        
        // Compare with hotel average (simulated)
        $hotelAverage = 18.5; // kWh per day
        $savingsPercent = round((($hotelAverage - $avgDaily) / $hotelAverage) * 100, 1);
        
        // Carbon footprint (0.5 kg CO2 per kWh average)
        $carbonSaved = round(max(0, ($hotelAverage - $avgDaily) * 7 * 0.5), 2);
        
        echo json_encode([
            'ok' => true,
            'room_number' => $roomNumber,
            'current' => [
                'consumption' => round($currentConsumption, 2),
                'unit' => 'W'
            ],
            'devices' => $deviceBreakdown,
            'hourly' => $hourlyData,
            'daily' => $dailyData,
            'summary' => [
                'today_kwh' => round($todayTotal, 2),
                'week_kwh' => round($weekTotal, 2),
                'avg_daily_kwh' => round($avgDaily, 2),
                'hotel_avg_kwh' => $hotelAverage,
                'savings_percent' => $savingsPercent,
                'carbon_saved_kg' => $carbonSaved
            ]
        ]);
        
    } catch (Exception $e) {
        http_response_code(500);
        echo json_encode(['ok' => false, 'error' => 'Failed to fetch energy data: ' . $e->getMessage()]);
    }
    exit;
}

http_response_code(405);
echo json_encode(['ok' => false, 'error' => 'Method not allowed']);
