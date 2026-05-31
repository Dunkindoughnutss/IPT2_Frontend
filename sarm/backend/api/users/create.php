<?php
// ══════════════════════════════════════════
// api/users/create.php   POST
// Body: { name, role, username, password, college_id, dept_id }
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Registrar');

$b         = body();
$name      = trim($b['name']      ?? '');
$role      = trim($b['role']      ?? '');
$username  = trim($b['username']  ?? '');
$password  = trim($b['password']  ?? '');
$collegeId = isset($b['college_id']) ? (int)$b['college_id'] : null;
$deptId    = isset($b['dept_id'])    ? (int)$b['dept_id']    : null;

$allowedRoles = ['Dean', 'Chairman', 'Faculty'];

if (!$name || !$role || !$username || !$password) {
    fail('Name, role, username, and password are required.');
}
if (!in_array($role, $allowedRoles, true)) {
    fail('Invalid role.');
}

$db = getDB();

// Check username uniqueness
$check = $db->prepare('SELECT id FROM users WHERE username = ? LIMIT 1');
$check->execute([$username]);
if ($check->fetch()) {
    fail('Username already taken.');
}

$hash = password_hash($password, PASSWORD_BCRYPT);

$stmt = $db->prepare(
    'INSERT INTO users (name, role, username, password, active, college_id, dept_id)
     VALUES (?, ?, ?, ?, 1, ?, ?)'
);
$stmt->execute([$name, $role, $username, $hash, $collegeId ?: null, $deptId ?: null]);

ok(['id' => (int)$db->lastInsertId()], 'Account created.');