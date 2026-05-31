<?php
// ══════════════════════════════════════════
// api/users/update.php   POST
// Body: { id, name?, password?, active?, college_id?, dept_id? }
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Registrar');

$b  = body();
$id = (int)($b['id'] ?? 0);
if (!$id) fail('User ID is required.');

$db   = getDB();
$stmt = $db->prepare('SELECT id, role FROM users WHERE id = ? LIMIT 1');
$stmt->execute([$id]);
$user = $stmt->fetch();
if (!$user) fail('User not found.', 404);
if ($user['role'] === 'Registrar') fail('Cannot edit Registrar account.');

// Build dynamic SET clause
$sets   = [];
$params = [];

if (isset($b['name']) && trim($b['name']) !== '') {
    $sets[]   = 'name = ?';
    $params[] = trim($b['name']);
}
if (isset($b['password']) && trim($b['password']) !== '') {
    $sets[]   = 'password = ?';
    $params[] = password_hash(trim($b['password']), PASSWORD_BCRYPT);
}
if (isset($b['active'])) {
    $sets[]   = 'active = ?';
    $params[] = $b['active'] ? 1 : 0;
}
if (array_key_exists('college_id', $b)) {
    $sets[]   = 'college_id = ?';
    $params[] = $b['college_id'] !== null ? (int)$b['college_id'] : null;
}
if (array_key_exists('dept_id', $b)) {
    $sets[]   = 'dept_id = ?';
    $params[] = $b['dept_id'] !== null ? (int)$b['dept_id'] : null;
}

if (empty($sets)) fail('Nothing to update.');

$params[] = $id;
$db->prepare('UPDATE users SET ' . implode(', ', $sets) . ' WHERE id = ?')
   ->execute($params);

ok(null, 'User updated.');