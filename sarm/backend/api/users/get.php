<?php
// ══════════════════════════════════════════
// api/users/get.php   GET
// Returns all non-Registrar staff users
// Auth: Registrar
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
guard('Registrar');

$db   = getDB();
$rows = $db->query(
    "SELECT u.id, u.name, u.role, u.username, u.active,
            u.college_id, u.dept_id,
            c.name AS college_name,
            d.name AS dept_name
       FROM users u
       LEFT JOIN colleges    c ON c.id = u.college_id
       LEFT JOIN departments d ON d.id = u.dept_id
      WHERE u.role != 'Registrar'
      ORDER BY u.role, u.name"
)->fetchAll();

foreach ($rows as &$r) {
    $r['id']         = (int)$r['id'];
    $r['active']     = (bool)$r['active'];
    $r['college_id'] = $r['college_id'] !== null ? (int)$r['college_id'] : null;
    $r['dept_id']    = $r['dept_id']    !== null ? (int)$r['dept_id']    : null;
}

ok($rows);