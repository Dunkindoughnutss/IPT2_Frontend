<?php
// ══════════════════════════════════════════
// api/grades/submit.php   POST
// Lock all grades for a section
// Body: { section_id }
// Auth: Faculty (own sections only)
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
$me = guard('Faculty');

$b         = body();
$sectionId = (int)($b['section_id'] ?? 0);
if (!$sectionId) fail('section_id is required.');

$db = getDB();

// Ownership + status check
$sec = $db->prepare('SELECT faculty_id, submitted FROM sections WHERE id = ? LIMIT 1');
$sec->execute([$sectionId]);
$section = $sec->fetch();

if (!$section)                                 fail('Section not found.', 404);
if ((int)$section['faculty_id'] !== $me['id']) fail('You are not assigned to this section.', 403);
if ($section['submitted'])                     fail('Already submitted.', 409);

// Check all enrolled students have a grade
$enrolled = $db->prepare(
    'SELECT COUNT(*) AS total FROM enrollments WHERE section_id = ?'
);
$enrolled->execute([$sectionId]);
$enrolledCount = (int)$enrolled->fetch()['total'];

$graded = $db->prepare(
    'SELECT COUNT(*) AS total FROM grades WHERE section_id = ?'
);
$graded->execute([$sectionId]);
$gradedCount = (int)$graded->fetch()['total'];

if ($gradedCount < $enrolledCount) {
    $missing = $enrolledCount - $gradedCount;
    fail("{$missing} student(s) still have no grade. Grade everyone before submitting.");
}

// Lock the section
$db->prepare('UPDATE sections SET submitted = 1 WHERE id = ?')
   ->execute([$sectionId]);

ok(null, 'Grades submitted and locked.');