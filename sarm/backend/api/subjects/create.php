<?php
// Establish base cross-origin communication policies
header("Content-Type: application/json");
header("Access-Control-Allow-Origin: *");
header("Access-Control-Allow-Methods: POST");
header("Access-Control-Allow-Headers: Content-Type, Authorization, X-Auth-Token, X-Requested-With");

// Require your database utility configuration script file
require_once __DIR__ . '/../../config/db.php';

// Read the raw JSON payload arriving from the JavaScript request
$data = json_decode(file_get_contents("php://input"), true);

// Run a validation checklist to verify core parameters are present
if (
    !empty($data['code']) && 
    !empty($data['name']) && 
    isset($data['units']) && 
    !empty($data['dept_id'])
) {
    try {
        $pdo = getDB();

        // Prepare execution query statement parameters
        $query = "INSERT INTO subjects (code, name, units, dept_id, year, sem) 
                  VALUES (:code, :name, :units, :dept_id, :year, :sem)";
                  
        $stmt = $pdo->prepare($query);
        
        $stmt->execute([
            ':code'    => strtoupper(trim($data['code'])),
            ':name'    => trim($data['name']),
            ':units'   => intval($data['units']),
            ':dept_id' => intval($data['dept_id']), // Ensuring ID evaluates clean numbers
            ':year'    => !empty($data['year']) ? intval($data['year']) : 1,
            ':sem'     => !empty($data['sem']) ? trim($data['sem']) : '1st'
        ]);

        // 🌟 SUCCESS RESPONSE FORMAT: Matches what apiFetch structure expects
        echo json_encode([
            "success" => true,
            "message" => "Subject added to the curriculum successfully.",
            "data"    => null
        ]);

    } catch (PDOException $e) {
        http_response_code(500);
        echo json_encode([
            "success" => false,
            "message" => "Database processing error: " . $e->getMessage(),
            "data"    => null
        ]);
    }
} else {
    http_response_code(400);
    echo json_encode([
        "success" => false,
        "message" => "Incomplete request payload structure data details.",
        "data"    => null
    ]);
}
?>