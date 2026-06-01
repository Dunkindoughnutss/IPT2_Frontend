<?php
// ══════════════════════════════════════════
// api/subjects/get.php   GET
// Returns subjects scoped by role's dept
// Auth: Chairman, Dean, Registrar, Faculty
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman', 'Faculty');

$db     = getDB();
$where  = [];
$params = [];

if ($me['role'] === 'Chairman' || $me['role'] === 'Faculty') {
    $where[]  = 's.dept_id = ?';
    $params[] = $me['dept_id'];
} elseif ($me['role'] === 'Dean') {
    $where[]  = 'd.college_id = ?';
    $params[] = $me['college_id'];
}

// Optional filter
if (!empty($_GET['dept_id'])) {
    $where[]  = 's.dept_id = ?';
    $params[] = (int)$_GET['dept_id'];
}

$sql = "SELECT s.id, s.code, s.name, s.units, s.year, s.sem, s.dept_id,
               d.name AS dept_name, d.college_id,
               c.name AS college_name
          FROM subjects s
          JOIN departments d ON d.id = s.dept_id
          JOIN colleges    c ON c.id = d.college_id"
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY s.year, s.sem, s.code';

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']         = (int)$r['id'];
    $r['dept_id']    = (int)$r['dept_id'];
    $r['college_id'] = (int)$r['college_id'];
    $r['units']      = (int)$r['units'];
    $r['year']       = (int)$r['year'];
}

ok($rows);