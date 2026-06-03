<?php
// ══════════════════════════════════════════
// api/students/get.php   GET
// Query params: college_id (optional), dept_id (optional filter), search (optional text query)
// Auth: Registrar, Dean, Chairman, Faculty
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman', 'Faculty');

$db = getDB();

$where  = [];
$params = [];

// Scope by role
if ($me['role'] === 'Chairman' || $me['role'] === 'Faculty') {
    if ($me['role'] === 'Chairman' && !empty($_GET['college_id'])) {
        if ((int)$_GET['college_id'] !== $me['college_id']) {
            fail('Forbidden college filter.', 403);
        }
        // Allow the chairman to list students across their own college.
    } elseif (!empty($_GET['dept_id'])) {
        if ($me['role'] === 'Chairman') {
            $deptStmt = $db->prepare('SELECT college_id FROM departments WHERE id = ? LIMIT 1');
            $deptStmt->execute([(int)$_GET['dept_id']]);
            $deptRow = $deptStmt->fetch();
            if (!$deptRow || (int)$deptRow['college_id'] !== $me['college_id']) {
                fail('Forbidden department filter.', 403);
            }
        } elseif ($me['role'] === 'Faculty' && (int)$_GET['dept_id'] !== $me['dept_id']) {
            fail('Forbidden department filter.', 403);
        }
        $where[]  = 's.dept_id = ?';
        $params[] = (int)$_GET['dept_id'];
    } else {
        $where[]  = 's.dept_id = ?';
        $params[] = $me['dept_id'];
    }
} elseif ($me['role'] === 'Dean') {
    $where[]  = 'd.college_id = ?';
    $params[] = $me['college_id'];
}

// Optional extra filter
if (!empty($_GET['college_id'])) {
    $where[]  = 'c.id = ?';
    $params[] = (int)$_GET['college_id'];
}
if (!empty($_GET['dept_id'])) {
    if ($me['role'] === 'Chairman' || $me['role'] === 'Faculty') {
        // Already handled above to enforce scope.
    } else {
        $where[]  = 's.dept_id = ?';
        $params[] = (int)$_GET['dept_id'];
    }
}
if (!empty($_GET['year_level'])) {
    $where[]  = 's.year_level = ?';
    $params[] = (int)$_GET['year_level'];
}

//Process the frontend search parameter
if (!empty($_GET['search'])) {
    // Allows searching by name OR student ID
    $where[]  = '(s.name LIKE ? OR s.id LIKE ?)';
    $searchTerm = '%' . trim($_GET['search']) . '%';
    $params[] = $searchTerm;
    $params[] = $searchTerm;
}

$sql = "SELECT s.id, s.name, s.dept_id, s.year_level, s.status,
               d.name AS dept_name, c.id AS college_id, c.name AS college_name
          FROM students s
          JOIN departments d ON d.id = s.dept_id
          JOIN colleges    c ON c.id = d.college_id"
     . ($where ? ' WHERE ' . implode(' AND ', $where) : '')
     . ' ORDER BY s.id ASC';

$rows = $db->prepare($sql);
$rows->execute($params);
$data = $rows->fetchAll();

foreach ($data as &$r) {
    $r['dept_id']   = (int)$r['dept_id'];
    $r['college_id']= (int)$r['college_id'];
    $r['year_level']= (int)$r['year_level'];
}

ok($data);