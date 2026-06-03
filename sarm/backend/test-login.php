<?php
header('Content-Type: application/json');
require __DIR__ . '/config/db.php';

try {
    $db = getDB();

    // Test student login
    $username = '238101'; // First student ID from seed
    $password = '02242003'; // Alice's birthday

    $stmt = $db->prepare(
        'SELECT id, firstName, middleName, lastName, dept_id, year_level, status
           FROM students WHERE id = ? AND birthday = ? LIMIT 1'
    );
    $stmt->execute([$username, $password]);
    $student = $stmt->fetch();

    if (!$student) {
        echo json_encode([
            'success' => false,
            'message' => 'Student not found with ID: ' . $username . ' and birthday: ' . $password,
            'debug' => [
                'query_student_id' => $username,
                'query_birthday' => $password,
                'fetch_result' => $student,
            ]
        ], JSON_PRETTY_PRINT);
        exit;
    }

    echo json_encode([
        'success' => true,
        'message' => 'Student found',
        'student_data' => $student,
        'full_name_test' => trim($student['firstName'] . ' ' . ($student['middleName'] ? $student['middleName'] . ' ' : '') . $student['lastName'])
    ], JSON_PRETTY_PRINT);

} catch (Throwable $e) {
    http_response_code(500);
    echo json_encode([
        'success' => false,
        'message' => 'Error: ' . $e->getMessage(),
        'file' => $e->getFile(),
        'line' => $e->getLine(),
    ], JSON_PRETTY_PRINT);
}
