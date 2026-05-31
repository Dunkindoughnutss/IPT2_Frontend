<?php
// ══════════════════════════════════════════
// api/grades/get.php   GET
// ?section_id=N   → all grades in that section
// ?student_id=X   → all grades for that student
// Auth: all (students scoped to own records)
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard();

$db     = getDB();
$where  = [];
$params = [];

if ($me['role'] === 'Student') {
    // Students can only see their own submitted grades
    $where[]  = 'g.student_id = ?';
    $params[] = $me['student_id'];
    $where[]  = 'sec.submitted = 1';
} else {
    if (!empty($_GET['section_id'])) {
        $where[]  = 'g.section_id = ?';
        $params[] = (int)$_GET['section_id'];
    }
    if (!empty($_GET['student_id'])) {
        $where[]  = 'g.student_id = ?';
        $params[] = $_GET['student_id'];
    }
    if (empty($where)) fail('Provide section_id or student_id.');
}

$sql = "SELECT g.id, g.student_id, g.section_id, g.grade,
               s.name  AS student_name, s.year_level,
               sec.sy, sec.sem, sec.section_name, sec.submitted,
               sub.id   AS subject_id,  sub.code AS subject_code,
               sub.name AS subject_name, sub.units, sub.year AS subject_year,
               u.name   AS faculty_name
          FROM grades g
          JOIN students s  ON s.id   = g.student_id
          JOIN sections sec ON sec.id = g.section_id
          JOIN subjects sub ON sub.id = sec.subject_id
          LEFT JOIN users u ON u.id  = sec.faculty_id"
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY sec.sy, sec.sem, sub.name';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']          = (int)$r['id'];
    $r['section_id']  = (int)$r['section_id'];
    $r['subject_id']  = (int)$r['subject_id'];
    $r['units']       = (int)$r['units'];
    $r['subject_year']= (int)$r['subject_year'];
    $r['year_level']  = (int)$r['year_level'];
    $r['submitted']   = (bool)$r['submitted'];
    // Keep grade as string ('1.50', '5.00', 'INC')
}

ok($rows);