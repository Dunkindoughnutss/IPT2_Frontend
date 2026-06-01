<?php
header('Content-Type: application/json');
require __DIR__ . '/config/db.php';

try {
    $pdo = getDB();
    echo json_encode([
        'success' => true,
        'message' => 'Database connection successful',
        'host' => DB_HOST,
        'database' => DB_NAME,
        'driver' => $pdo->getAttribute(PDO::ATTR_DRIVER_NAME),
    ]);
    echo json_encode(['success' => true, 'message' => 'Database connection successful']);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Database connection test failed: ' . $e->getMessage(),
    ]);
    echo json_encode(['success' => false, 'message' => 'Database connection test failed: ' . $e->getMessage()]);
}
