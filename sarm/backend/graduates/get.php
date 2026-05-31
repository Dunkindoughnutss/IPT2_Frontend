<?php
// ══════════════════════════════════════════
// api/graduates/get.php   GET
// Query params: college_id, dept_id, year (all optional)
// Auth: Registrar, Dean, Chairman
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman');

$db     = getDB();
$where  = [];
$params = [];

// Role-based scope
if ($me['role'] === 'Dean') {
    $where[]  = 'g.college_id = ?';
    $params[] = $me['college_id'];
} elseif ($me['role'] === 'Chairman') {
    $where[]  = 'g.dept_id = ?';
    $params[] = $me['dept_id'];
}

// Optional filters
if (!empty($_GET['college_id'])) { $where[] = 'g.college_id = ?';      $params[] = (int)$_GET['college_id']; }
if (!empty($_GET['dept_id']))    { $where[] = 'g.dept_id = ?';         $params[] = (int)$_GET['dept_id']; }
if (!empty($_GET['year']))       { $where[] = 'g.graduation_year = ?'; $params[] = $_GET['year']; }

$sql = "SELECT g.id, g.name, g.college_id, g.dept_id,
               g.graduation_year, g.honors, g.gpa,
               c.name AS college_name, d.name AS dept_name
          FROM graduates g
          JOIN colleges    c ON c.id = g.college_id
          JOIN departments d ON d.id = g.dept_id"
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY g.graduation_year DESC, g.dept_id, g.gpa ASC';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['college_id'] = (int)$r['college_id'];
    $r['dept_id']    = (int)$r['dept_id'];
    $r['gpa']        = (float)$r['gpa'];
}

ok($rows);