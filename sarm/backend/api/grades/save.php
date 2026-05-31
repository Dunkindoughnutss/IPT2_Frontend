<?php
// ══════════════════════════════════════════
// api/grades/save.php   POST
// Save one draft grade (upsert)
// Body: { student_id, section_id, grade }
// Auth: Faculty (own sections only)
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
$me = guard('Faculty');

$b         = body();
$studentId = trim($b['student_id'] ?? '');
$sectionId = (int)($b['section_id'] ?? 0);
$grade     = trim($b['grade']       ?? '');

$validGrades = ['1.0','1.25','1.5','1.75','2.0','2.25','2.5','2.75','3.0','5.0','INC'];
if (!$studentId || !$sectionId) fail('student_id and section_id are required.');
if ($grade !== '' && !in_array($grade, $validGrades, true)) fail('Invalid grade value.');

$db = getDB();

// Verify faculty owns this section and it's not yet submitted
$sec = $db->prepare('SELECT faculty_id, submitted FROM sections WHERE id = ? LIMIT 1');
$sec->execute([$sectionId]);
$section = $sec->fetch();

if (!$section)                             fail('Section not found.', 404);
if ((int)$section['faculty_id'] !== $me['id']) fail('You are not assigned to this section.', 403);
if ($section['submitted'])                 fail('Grades already submitted and locked.', 409);

if ($grade === '') {
    // Clear grade
    $db->prepare('DELETE FROM grades WHERE student_id = ? AND section_id = ?')
       ->execute([$studentId, $sectionId]);
    ok(null, 'Grade cleared.');
}

// Upsert grade
$db->prepare(
    'INSERT INTO grades (student_id, section_id, grade) VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE grade = VALUES(grade)'
)->execute([$studentId, $sectionId, $grade]);

ok(null, 'Grade saved.');