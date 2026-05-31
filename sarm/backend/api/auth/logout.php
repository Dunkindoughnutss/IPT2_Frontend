<?php
// ══════════════════════════════════════════
// api/auth/logout.php   POST
// Deletes token from DB
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('POST');

$token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
if ($token) {
    $db = getDB();
    $db->prepare("DELETE FROM auth_tokens WHERE token = ?")
       ->execute([$token]);
}

ok(null, 'Logged out.');