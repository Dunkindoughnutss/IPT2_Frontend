<?php
header('Content-Type: application/json');
require __DIR__ . '/config/db.php';

try {
    $pdo = getDB();

    // Check students table columns
    $stmt = $pdo->query("DESCRIBE students");
    $columns = $stmt->fetchAll(PDO::FETCH_ASSOC);

    echo json_encode([
        'success' => true,
        'students_columns' => array_column($columns, 'Field'),
        'full_schema' => $columns
    ], JSON_PRETTY_PRINT);
} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => $e->getMessage(),
    ]);
}
