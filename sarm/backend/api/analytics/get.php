<?php
// ══════════════════════════════════════════
// api/analytics/get.php   GET
// Returns: semester_trend, headcount_trend,
//          dept_comparison, grade_distribution
// Query params: college_id, dept_id (optional filters)
// Auth: Registrar, Dean, Chairman
// ══════════════════════════════════════════

require_once __DIR__ . '/../../helpers/response.php';
require_once __DIR__ . '/../../config/db.php';

method('GET');
$me = guard('Registrar', 'Dean', 'Chairman');

$db = getDB();

// ── Build base WHERE for scope + filters ──
$scopeWhere  = [];
$scopeParams = [];

// Role scope
if ($me['role'] === 'Dean') {
    $scopeWhere[]  = 'd.college_id = ?';
    $scopeParams[] = $me['college_id'];
} elseif ($me['role'] === 'Chairman') {
    $scopeWhere[]  = 'sub.dept_id = ?';
    $scopeParams[] = $me['dept_id'];
}

// Filter overrides (Registrar/Dean can pass college_id or dept_id)
if (!empty($_GET['college_id']) && $me['role'] !== 'Chairman') {
    $scopeWhere[]  = 'd.college_id = ?';
    $scopeParams[] = (int)$_GET['college_id'];
}
if (!empty($_GET['dept_id'])) {
    $scopeWhere[]  = 'sub.dept_id = ?';
    $scopeParams[] = (int)$_GET['dept_id'];
}

$baseJoin  = "FROM grades g
               JOIN sections sec ON sec.id = g.section_id
               JOIN subjects sub ON sub.id = sec.subject_id
               JOIN departments d ON d.id  = sub.dept_id
              WHERE sec.submitted = 1
                AND g.grade != 'INC'"
           . ($scopeWhere ? ' AND ' . implode(' AND ', $scopeWhere) : '');

// ── 1. Semester Trend ─────────────────────
$trendSql = "SELECT sec.sy, sec.sem,
                    COUNT(*)                                      AS total,
                    SUM(CASE WHEN g.grade <= 3 THEN 1 ELSE 0 END) AS passed,
                    SUM(CASE WHEN g.grade >  3 THEN 1 ELSE 0 END) AS failed,
                    AVG(g.grade)                                   AS avg_grade
              {$baseJoin}
             GROUP BY sec.sy, sec.sem
             ORDER BY sec.sy ASC,
                      FIELD(sec.sem,'1st','2nd','Summer')";

$tStmt = $db->prepare($trendSql);
$tStmt->execute($scopeParams);
$trendRaw = $tStmt->fetchAll();

$semesterTrend = [];
foreach ($trendRaw as $r) {
    $total    = (int)$r['total'];
    $passed   = (int)$r['passed'];
    $failed   = (int)$r['failed'];
    $avg      = $r['avg_grade'] !== null ? round((float)$r['avg_grade'], 2) : null;
    $passRate = $total ? round($passed / $total * 100) : null;

    // Headcount for this semester
    $hcSql = "SELECT COUNT(DISTINCT e.student_id) AS cnt
                FROM enrollments e
                JOIN sections sec ON sec.id = e.section_id
                JOIN subjects sub ON sub.id = sec.subject_id
                JOIN departments d ON d.id  = sub.dept_id
               WHERE sec.sy = ? AND sec.sem = ? AND sec.submitted = 1"
            . ($scopeWhere ? ' AND ' . implode(' AND ', $scopeWhere) : '');
    $hcStmt = $db->prepare($hcSql);
    $hcStmt->execute(array_merge([$r['sy'], $r['sem']], $scopeParams));
    $headcount = (int)($hcStmt->fetch()['cnt'] ?? 0);

    $semesterTrend[] = [
        'label'     => "{$r['sy']} {$r['sem']}",
        'sy'        => $r['sy'],
        'sem'       => $r['sem'],
        'total'     => $total,
        'passed'    => $passed,
        'failed'    => $failed,
        'avg_grade' => $avg,
        'pass_rate' => $passRate,
        'headcount' => $headcount,
    ];
}

// ── 2. Department Comparison ──────────────
// Determine which departments to compare
$deptWhere  = [];
$deptParams = [];

if ($me['role'] === 'Registrar') {
    if (!empty($_GET['college_id'])) {
        $deptWhere[]  = 'd.college_id = ?';
        $deptParams[] = (int)$_GET['college_id'];
    }
    if (!empty($_GET['dept_id'])) {
        $deptWhere[]  = 'd.id = ?';
        $deptParams[] = (int)$_GET['dept_id'];
    }
} elseif ($me['role'] === 'Dean') {
    $deptWhere[]  = 'd.college_id = ?';
    $deptParams[] = $me['college_id'];
    if (!empty($_GET['dept_id'])) {
        $deptWhere[]  = 'd.id = ?';
        $deptParams[] = (int)$_GET['dept_id'];
    }
} elseif ($me['role'] === 'Chairman') {
    $deptWhere[]  = 'd.id = ?';
    $deptParams[] = $me['dept_id'];
}

$deptSql = "SELECT d.id, d.name AS dept_name, c.name AS college_name,
                   COUNT(g.id)                                     AS total,
                   SUM(CASE WHEN g.grade <= 3 THEN 1 ELSE 0 END)  AS passed,
                   SUM(CASE WHEN g.grade >  3 THEN 1 ELSE 0 END)  AS failed,
                   AVG(g.grade)                                    AS avg_grade
              FROM departments d
              JOIN colleges c   ON c.id   = d.college_id
              LEFT JOIN subjects sub ON sub.dept_id = d.id
              LEFT JOIN sections sec ON sec.subject_id = sub.id AND sec.submitted = 1
              LEFT JOIN grades g    ON g.section_id = sec.id AND g.grade != 'INC'"
          . ($deptWhere ? ' WHERE ' . implode(' AND ', $deptWhere) : '')
          . ' GROUP BY d.id ORDER BY d.name';

$dStmt = $db->prepare($deptSql);
$dStmt->execute($deptParams);
$deptRaw = $dStmt->fetchAll();

$deptComparison = [];
foreach ($deptRaw as $r) {
    $total    = (int)$r['total'];
    $passed   = (int)$r['passed'];
    $passRate = $total ? round($passed / $total * 100) : null;

    // Headcount per dept
    $hcSql2 = "SELECT COUNT(DISTINCT e.student_id) AS cnt
                 FROM enrollments e
                 JOIN sections sec ON sec.id = e.section_id
                 JOIN subjects sub ON sub.id = sec.subject_id
                WHERE sub.dept_id = ? AND sec.submitted = 1";
    $hcStmt2 = $db->prepare($hcSql2);
    $hcStmt2->execute([$r['id']]);
    $headcount = (int)($hcStmt2->fetch()['cnt'] ?? 0);

    $deptComparison[] = [
        'dept_id'     => (int)$r['id'],
        'dept_name'   => $r['dept_name'],
        'college_name'=> $r['college_name'],
        'total'       => $total,
        'passed'      => $passed,
        'failed'      => (int)$r['failed'],
        'avg_grade'   => $r['avg_grade'] !== null ? round((float)$r['avg_grade'], 2) : null,
        'pass_rate'   => $passRate,
        'headcount'   => $headcount,
    ];
}

// ── 3. Grade Distribution ─────────────────
$distSql = "SELECT
              SUM(CASE WHEN g.grade != 'INC' AND g.grade <= 1.5  THEN 1 ELSE 0 END) AS excellent,
              SUM(CASE WHEN g.grade != 'INC' AND g.grade > 1.5 AND g.grade <= 2.0 THEN 1 ELSE 0 END) AS good,
              SUM(CASE WHEN g.grade != 'INC' AND g.grade > 2.0 AND g.grade <= 2.5 THEN 1 ELSE 0 END) AS satisfactory,
              SUM(CASE WHEN g.grade != 'INC' AND g.grade > 2.5 AND g.grade <= 3.0 THEN 1 ELSE 0 END) AS passing,
              SUM(CASE WHEN g.grade != 'INC' AND g.grade > 3.0                   THEN 1 ELSE 0 END) AS failed,
              SUM(CASE WHEN g.grade  = 'INC'                                      THEN 1 ELSE 0 END) AS incomplete,
              COUNT(*) AS grand_total
             FROM grades g
             JOIN sections sec ON sec.id = g.section_id
             JOIN subjects sub ON sub.id = sec.subject_id
             JOIN departments d ON d.id  = sub.dept_id
            WHERE sec.submitted = 1"
          . ($scopeWhere ? ' AND ' . implode(' AND ', $scopeWhere) : '');

$distStmt = $db->prepare($distSql);
$distStmt->execute($scopeParams);
$dist = $distStmt->fetch();

$gradeDistribution = [
    'excellent'    => (int)$dist['excellent'],
    'good'         => (int)$dist['good'],
    'satisfactory' => (int)$dist['satisfactory'],
    'passing'      => (int)$dist['passing'],
    'failed'       => (int)$dist['failed'],
    'incomplete'   => (int)$dist['incomplete'],
    'grand_total'  => (int)$dist['grand_total'],
];

// ── Return all ────────────────────────────
ok([
    'semester_trend'     => $semesterTrend,
    'dept_comparison'    => $deptComparison,
    'grade_distribution' => $gradeDistribution,
]);