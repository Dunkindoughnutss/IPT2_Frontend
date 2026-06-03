<?php
// ══════════════════════════════════════════
// api/students/create.php   POST
// Body: { id, firstName, middleName, lastName, dept_id, year_level, birthday }
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Registrar');

$b          = body();
$id         = trim($b['id']       ?? '');
$firstName  = trim($b['firstName']  ?? '');
$middleName = trim($b['middleName'] ?? '');
$lastName   = trim($b['lastName']   ?? '');
$deptId     = (int)($b['dept_id']     ?? 0);
$yearLevel  = (int)($b['year_level']  ?? 1);
$birthday   = trim($b['birthday'] ?? '');

if (!$id || !$firstName || !$lastName || !$deptId || !$birthday) {
    fail('ID, firstName, lastName, department, and birthday are required.');
}
if (!preg_match('/^\d{6}$/', $id)) {
    fail('Student ID must be exactly 6 digits.');
}
if (!preg_match('/^\d{8}$/', $birthday)) {
    fail('Birthday must be 8 digits (mmddyyyy).');
}

$db = getDB();

$check = $db->prepare('SELECT id FROM students WHERE id = ? LIMIT 1');
$check->execute([$id]);
if ($check->fetch()) fail('Student ID already exists.');

$db->prepare(
    'INSERT INTO students (id, firstName, middleName, lastName, dept_id, year_level, birthday, status)
     VALUES (?, ?, ?, ?, ?, ?, ?, "enrolled")'
)->execute([$id, $firstName, $middleName, $lastName, $deptId, $yearLevel, $birthday]);

ok(['id' => $id], 'Student account created.');