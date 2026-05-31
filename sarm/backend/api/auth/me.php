<?php
// ══════════════════════════════════════════
// api/auth/me.php   GET
// Validates token and returns current user
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$user = guard();
ok($user);