<?php
// ══════════════════════════════════════════
// api/enrollments/toggle.php   POST
// Body: { student_id, section_id, enroll: true|false }
// Auth: Chairman
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Chairman', 'Registrar');

$b         = body();
$studentId = trim($b['student_id'] ?? '');
$sectionId = (int)($b['section_id'] ?? 0);
$enroll    = (bool)($b['enroll']    ?? false);

if (!$studentId || !$sectionId) fail('student_id and section_id are required.');

$db = getDB();

if ($enroll) {
    $db->prepare(
        'INSERT IGNORE INTO enrollments (student_id, section_id) VALUES (?, ?)'
    )->execute([$studentId, $sectionId]);
    ok(null, 'Student enrolled.');
} else {
    // Remove enrollment and grade if present
    $db->prepare('DELETE FROM grades      WHERE student_id = ? AND section_id = ?')->execute([$studentId, $sectionId]);
    $db->prepare('DELETE FROM enrollments WHERE student_id = ? AND section_id = ?')->execute([$studentId, $sectionId]);
    ok(null, 'Student unenrolled.');
}