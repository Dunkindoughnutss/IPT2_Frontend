<?php
// ══════════════════════════════════════════
// api/sections/create.php   POST
// Body: { subject_id, faculty_id, section_name, sy, sem }
// Auth: Chairman
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Chairman', 'Registrar');

$b          = body();
$subjectId  = (int)($b['subject_id']  ?? 0);
$facultyId  = isset($b['faculty_id']) && $b['faculty_id'] ? (int)$b['faculty_id'] : null;
$name       = trim($b['section_name'] ?? '');
$sy         = trim($b['sy']           ?? '');
$sem        = trim($b['sem']          ?? '');

if (!$subjectId || !$name || !$sy || !$sem) {
    fail('Subject, section name, school year, and semester are required.');
}
if (!in_array($sem, ['1st','2nd','Summer'], true)) {
    fail('Invalid semester value.');
}

$db = getDB();

$db->prepare(
    'INSERT INTO sections (subject_id, faculty_id, section_name, sy, sem, submitted)
     VALUES (?, ?, ?, ?, ?, 0)'
)->execute([$subjectId, $facultyId, $name, $sy, $sem]);

ok(['id' => (int)$db->lastInsertId()], 'Section created.');