<?php
// ══════════════════════════════════════════
// helpers/generate_passwords.php
// Run once from browser: localhost/sarm_simple/backend/helpers/generate_passwords.php
// Copy the UPDATE statements into phpMyAdmin SQL tab
// ══════════════════════════════════════════

$accounts = [
    ['username' => 'registrar', 'password' => 'reg123'],
    ['username' => 'dean1',     'password' => 'dean123'],
    ['username' => 'chair1',    'password' => 'chair123'],
    ['username' => 'fac1',      'password' => 'fac123'],
    ['username' => 'fac2',      'password' => 'fac456'],
];

header('Content-Type: text/plain');
echo "-- Run these UPDATE statements in phpMyAdmin:\n\n";

foreach ($accounts as $acc) {
    $hash = password_hash($acc['password'], PASSWORD_BCRYPT);
    echo "UPDATE users SET password = '{$hash}' WHERE username = '{$acc['username']}';\n";
}

echo "\n-- Done. Paste the above into phpMyAdmin > SQL tab and click Go.\n";