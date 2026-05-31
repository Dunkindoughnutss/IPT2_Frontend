<?php
// ══════════════════════════════════════════
// api/sections/assign.php   POST
// Body: { section_id, faculty_id }
// Auth: Chairman
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');
guard('Chairman');

$b         = body();
$sectionId = (int)($b['section_id'] ?? 0);
$facultyId = isset($b['faculty_id']) && $b['faculty_id'] ? (int)$b['faculty_id'] : null;

if (!$sectionId) fail('Section ID is required.');

$db = getDB();
$db->prepare('UPDATE sections SET faculty_id = ? WHERE id = ?')
   ->execute([$facultyId, $sectionId]);

ok(null, 'Faculty assigned.');