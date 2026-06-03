<?php
// ══════════════════════════════════════════
// api/auth/login.php   POST
// Token-based auth — stores token in DB
// Body: { username, password }
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');

$b        = body();
$username = trim($b['username'] ?? '');
$password = trim($b['password'] ?? '');

if (!$username || !$password) {
    fail('Username and password are required.');
}

$db = getDB();

// Ensure auth_tokens table exists
$db->exec("CREATE TABLE IF NOT EXISTS auth_tokens (
    token      VARCHAR(64) PRIMARY KEY,
    user_json  TEXT        NOT NULL,
    created_at TIMESTAMP   DEFAULT CURRENT_TIMESTAMP
) ENGINE=InnoDB");

// ── Staff login ───────────────────────────
$stmt = $db->prepare(
    'SELECT id, name, role, username, password, active, college_id, dept_id
       FROM users WHERE username = ? LIMIT 1'
);
$stmt->execute([$username]);
$user = $stmt->fetch();

if ($user && $user['active'] && password_verify($password, $user['password'])) {
    unset($user['password']);
    $user['id']         = (int)$user['id'];
    $user['college_id'] = $user['college_id'] !== null ? (int)$user['college_id'] : null;
    $user['dept_id']    = $user['dept_id']    !== null ? (int)$user['dept_id']    : null;
    $user['active']     = (bool)$user['active'];

    $token = bin2hex(random_bytes(32));
    $db->prepare("INSERT INTO auth_tokens (token, user_json) VALUES (?, ?)")
       ->execute([$token, json_encode($user)]);

    ok(['token' => $token, 'user' => $user], 'Login successful.');
}

// ── Student login (ID + birthday) ─────────
$stmt = $db->prepare(
    'SELECT id, firstName, middleName, lastName, dept_id, year_level, status
       FROM students WHERE id = ? AND birthday = ? LIMIT 1'
);
$stmt->execute([$username, $password]);
$student = $stmt->fetch();

if ($student && $student['status'] === 'enrolled') {
    // Build full name from components
    $fullName = trim($student['firstName'] . ' ' . ($student['middleName'] ? $student['middleName'] . ' ' : '') . $student['lastName']);

    $user = [
        'id'         => null,
        'name'       => $fullName,
        'role'       => 'Student',
        'student_id' => $student['id'],
        'dept_id'    => (int)$student['dept_id'],
        'college_id' => null,
        'active'     => true,
    ];

    $token = bin2hex(random_bytes(32));
    $db->prepare("INSERT INTO auth_tokens (token, user_json) VALUES (?, ?)")
       ->execute([$token, json_encode($user)]);

    ok(['token' => $token, 'user' => $user], 'Login successful.');
}

fail('Invalid username or password.', 401);