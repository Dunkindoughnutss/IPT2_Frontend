<?php
// ══════════════════════════════════════════
// helpers/response.php
// Token-based auth — no PHP sessions needed
// ══════════════════════════════════════════

// ── CORS ──────────────────────────────────
$origin = $_SERVER['HTTP_ORIGIN'] ?? '';
if (preg_match('#^https?://(localhost|127\.0\.0\.1)(:\d+)?$#', $origin)) {
    header("Access-Control-Allow-Origin: $origin");
} else {
    header('Access-Control-Allow-Origin: http://localhost');
}
header('Access-Control-Allow-Credentials: true');
header('Access-Control-Allow-Methods: GET, POST, PUT, DELETE, OPTIONS');
header('Access-Control-Allow-Headers: Content-Type, X-Requested-With, X-Auth-Token');
header('Content-Type: application/json; charset=utf-8');

if ($_SERVER['REQUEST_METHOD'] === 'OPTIONS') {
    http_response_code(204);
    exit;
}

// ── Response helpers ──────────────────────
function ok(mixed $data, string $message = 'OK'): never {
    echo json_encode(['success' => true, 'message' => $message, 'data' => $data]);
    exit;
}

function fail(string $message, int $code = 400): never {
    http_response_code($code);
    echo json_encode(['success' => false, 'message' => $message, 'data' => null]);
    exit;
}

function body(): array {
    $raw = file_get_contents('php://input');
    return $raw ? (json_decode($raw, true) ?? []) : [];
}

// ── Token-based guard ─────────────────────
function guard(string ...$roles): array {
    $token = $_SERVER['HTTP_X_AUTH_TOKEN'] ?? '';
    if (!$token) {
        fail('Unauthenticated. No token provided.', 401);
    }

    $dbPath = dirname(__DIR__) . '/config/db.php';
    require_once $dbPath;
    $db = getDB();

    $stmt = $db->prepare("SELECT user_json FROM auth_tokens WHERE token = ? LIMIT 1");
    $stmt->execute([$token]);
    $row = $stmt->fetch();

    if (!$row) {
        fail('Unauthenticated. Invalid or expired token.', 401);
    }

    $user = json_decode($row['user_json'], true);
    if (!$user) {
        fail('Unauthenticated. Corrupted token data.', 401);
    }

    if (!empty($roles) && !in_array($user['role'], $roles, true)) {
        fail('Forbidden. Your role (' . ($user['role'] ?? 'unknown') . ') cannot access this.', 403);
    }

    return $user;
}

function method(string $expected): void {
    if ($_SERVER['REQUEST_METHOD'] !== strtoupper($expected)) {
        fail('Method not allowed.', 405);
    }
}