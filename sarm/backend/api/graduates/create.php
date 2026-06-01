<?php
// ══════════════════════════════════════════
// api/graduates/create.php   POST
// Body: { id, name, college_id, dept_id, graduation_year, honors, gpa }
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Registrar');

$b      = body();
$id     = trim($b['id']              ?? '');
$name   = trim($b['name']            ?? '');
$colId  = (int)($b['college_id']     ?? 0);
$deptId = (int)($b['dept_id']        ?? 0);
$year   = trim($b['graduation_year'] ?? '');
$honors = trim($b['honors']          ?? '');
$gpa    = isset($b['gpa'])           ? (float)$b['gpa'] : null;

if (!$id || !$name || !$colId || !$deptId || !$year || $gpa === null) {
    fail('All fields are required.');
}
if ($gpa < 1.0 || $gpa > 5.0) {
    fail('GPA must be between 1.0 and 5.0.');
}

$validHonors = ['', 'Cum Laude', 'Magna Cum Laude', 'Summa Cum Laude'];
if (!in_array($honors, $validHonors, true)) {
    fail('Invalid honors value.');
}

$db = getDB();

$check = $db->prepare('SELECT id FROM graduates WHERE id = ? LIMIT 1');
$check->execute([$id]);
if ($check->fetch()) fail('A graduate with that ID already exists.');

$db->prepare(
    'INSERT INTO graduates (id, name, college_id, dept_id, graduation_year, honors, gpa)
     VALUES (?, ?, ?, ?, ?, ?, ?)'
)->execute([$id, $name, $colId, $deptId, $year, $honors, $gpa]);

ok(['id' => $id], 'Graduate record created.');