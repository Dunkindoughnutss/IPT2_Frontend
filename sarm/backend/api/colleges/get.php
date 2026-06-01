<?php
// ══════════════════════════════════════════
// api/colleges/get.php   GET
// Returns all colleges and departments
// Auth: all staff
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
guard('Registrar', 'Dean', 'Chairman', 'Faculty');

$db = getDB();

$colleges = $db->query("SELECT id, name FROM colleges ORDER BY name")->fetchAll();
$depts    = $db->query("SELECT id, name, college_id FROM departments ORDER BY name")->fetchAll();

foreach ($colleges as &$c) $c['id'] = (int)$c['id'];
foreach ($depts    as &$d) { $d['id'] = (int)$d['id']; $d['college_id'] = (int)$d['college_id']; }

ok(['colleges' => $colleges, 'departments' => $depts]);