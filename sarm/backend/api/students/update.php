<?php
// ══════════════════════════════════════════
// api/students/update.php   POST
// Body: { id, name?, year_level?, status?, birthday? }
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Registrar');

$b  = body();
$id = trim($b['id'] ?? '');
if (!$id) fail('Student ID is required.');

$db   = getDB();
$chk  = $db->prepare('SELECT id FROM students WHERE id = ? LIMIT 1');
$chk->execute([$id]);
if (!$chk->fetch()) fail('Student not found.', 404);

$sets   = [];
$params = [];

if (isset($b['name']) && trim($b['name']) !== '') {
    $sets[]   = 'name = ?';
    $params[] = trim($b['name']);
}
if (isset($b['year_level'])) {
    $sets[]   = 'year_level = ?';
    $params[] = (int)$b['year_level'];
}
if (isset($b['status']) && in_array($b['status'], ['enrolled','inactive','graduated'], true)) {
    $sets[]   = 'status = ?';
    $params[] = $b['status'];
}
if (isset($b['birthday']) && preg_match('/^\d{8}$/', $b['birthday'])) {
    $sets[]   = 'birthday = ?';
    $params[] = $b['birthday'];
}

if (empty($sets)) fail('Nothing to update.');

$params[] = $id;
$db->prepare('UPDATE students SET ' . implode(', ', $sets) . ' WHERE id = ?')
   ->execute($params);

ok(null, 'Student updated.');