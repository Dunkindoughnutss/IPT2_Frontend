<?php
// ══════════════════════════════════════════
// api/enrollments/get.php   GET
// ?section_id=N  → students enrolled in that section
// ?student_id=X  → sections the student is enrolled in
// Auth: all staff + student (own records only)
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard();

$db     = getDB();
$where  = [];
$params = [];

if (!empty($_GET['section_id'])) {
    $where[]  = 'e.section_id = ?';
    $params[] = (int)$_GET['section_id'];
}
if (!empty($_GET['student_id'])) {
    // Students can only see their own
    if ($me['role'] === 'Student' && ($_SESSION['user']['student_id'] ?? '') !== $_GET['student_id']) {
        fail('Forbidden.', 403);
    }
    $where[]  = 'e.student_id = ?';
    $params[] = $_GET['student_id'];
}

if (empty($where)) fail('Provide section_id or student_id.');

$sql = "SELECT e.id, e.student_id, e.section_id,
               CONCAT(s.firstName, ' ', IF(s.middleName != '', CONCAT(s.middleName, ' '), ''), s.lastName) AS student_name,
               s.year_level, s.dept_id
          FROM enrollments e
          JOIN students s ON s.id = e.student_id"
     . ' WHERE ' . implode(' AND ', $where)
     . ' ORDER BY s.firstName, s.lastName';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']         = (int)$r['id'];
    $r['section_id'] = (int)$r['section_id'];
    $r['year_level'] = (int)$r['year_level'];
    $r['dept_id']    = (int)$r['dept_id'];
}

ok($rows);