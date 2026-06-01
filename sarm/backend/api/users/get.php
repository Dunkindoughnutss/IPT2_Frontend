<?php
// ══════════════════════════════════════════
// api/users/get.php   GET
// Registrar: all staff
// Dean: staff in their college
// Chairman: faculty in their dept
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman');

$db     = getDB();
$where  = ["u.role != 'Registrar'"];
$params = [];

if ($me['role'] === 'Chairman') {
    $where[]  = "u.role = 'Faculty'";
    $where[]  = 'u.dept_id = ?';
    $params[] = $me['dept_id'];
} elseif ($me['role'] === 'Dean') {
    $where[]  = 'u.college_id = ?';
    $params[] = $me['college_id'];
}

$sql = "SELECT u.id, u.name, u.role, u.username, u.active,
               u.college_id, u.dept_id,
               c.name AS college_name,
               d.name AS dept_name
          FROM users u
          LEFT JOIN colleges    c ON c.id = u.college_id
          LEFT JOIN departments d ON d.id = u.dept_id
         WHERE " . implode(' AND ', $where) . "
         ORDER BY u.role, u.name";

$stmt = $db->prepare($sql);
$stmt->execute($params);
$rows = $stmt->fetchAll();

foreach ($rows as &$r) {
    $r['id']         = (int)$r['id'];
    $r['active']     = (bool)$r['active'];
    $r['college_id'] = $r['college_id'] !== null ? (int)$r['college_id'] : null;
    $r['dept_id']    = $r['dept_id']    !== null ? (int)$r['dept_id']    : null;
}

ok($rows);