<?php
// ══════════════════════════════════════════
// api/sections/get.php   GET
// Returns sections with subject + faculty info
// Scoped by role automatically
// Auth: all staff
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman', 'Faculty');

$db     = getDB();
$where  = [];
$params = [];

// Role-based scope
if ($me['role'] === 'Faculty') {
    $where[]  = 'sec.faculty_id = ?';
    $params[] = $me['id'];
} elseif ($me['role'] === 'Chairman') {
    $where[]  = 'sub.dept_id = ?';
    $params[] = $me['dept_id'];
} elseif ($me['role'] === 'Dean') {
    $where[]  = 'd.college_id = ?';
    $params[] = $me['college_id'];
}

// Optional filters from query string
if (!empty($_GET['sy']))          { $where[] = 'sec.sy = ?';          $params[] = $_GET['sy']; }
if (!empty($_GET['sem']))         { $where[] = 'sec.sem = ?';         $params[] = $_GET['sem']; }
if (!empty($_GET['submitted']))   { $where[] = 'sec.submitted = ?';   $params[] = (int)$_GET['submitted']; }
if (!empty($_GET['subject_id']))  { $where[] = 'sec.subject_id = ?';  $params[] = (int)$_GET['subject_id']; }

$sql = "SELECT sec.id, sec.section_name, sec.sy, sec.sem, sec.submitted,
               sec.subject_id, sec.faculty_id,
               sub.code AS subject_code, sub.name AS subject_name,
               sub.units, sub.year AS subject_year, sub.dept_id,
               u.name AS faculty_name,
               d.name AS dept_name, d.college_id
          FROM sections sec
          JOIN subjects    sub ON sub.id = sec.subject_id
          JOIN departments d   ON d.id   = sub.dept_id
          LEFT JOIN users  u   ON u.id   = sec.faculty_id"
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY sec.sy DESC, sec.sem, sub.dept_id, sec.section_name';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']          = (int)$r['id'];
    $r['subject_id']  = (int)$r['subject_id'];
    $r['faculty_id']  = $r['faculty_id'] !== null ? (int)$r['faculty_id'] : null;
    $r['submitted']   = (bool)$r['submitted'];
    $r['dept_id']     = (int)$r['dept_id'];
    $r['college_id']  = (int)$r['college_id'];
    $r['units']       = (int)$r['units'];
    $r['subject_year']= (int)$r['subject_year'];
}

ok($rows);