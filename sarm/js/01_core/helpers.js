'use strict';

/* ══════════════════════════════════════════
   HELPERS — utility functions
══════════════════════════════════════════ */

/* ── String helpers ──────────────────── */
function esc(s) {
  return String(s == null ? '—' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function initials(n) {
  return (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}
function fmt2(g) { return parseFloat(g).toFixed(2); }

/* ── Grade helpers ───────────────────── */
function gradeDesc(g) {
  if (g === 'INC') return 'Incomplete';
  if (g <= 1.0)   return 'Excellent';
  if (g <= 1.5)   return 'Very Good';
  if (g <= 2.0)   return 'Good';
  if (g <= 2.5)   return 'Satisfactory';
  if (g <= 3.0)   return 'Passing';
  return 'Failed';
}

function gradeClass(g) {
  if (g === 'INC') return 'grade-inc';
  if (g > 3.0)    return 'grade-fail';
  if (g > 2.5)    return 'grade-warn';
  return 'grade-pass';
}

function isPassing(g) {
  return g !== 'INC' && g <= 3.0;
}

/* ── Record lookups ──────────────────── */
const getCollege = id => DB.colleges.find(c => c.id === id);
const getDept    = id => DB.departments.find(d => d.id === id);
const getSubject = id => DB.subjects.find(s => s.id === id);
const getSection = id => DB.sections.find(s => s.id === id);
const getUser    = id => DB.users.find(u => u.id === id);
const getStudent = id => DB.students.find(s => s.id === id);

/* ── Students enrolled in a section ─── */
function enrolledIn(sectionId) {
  return DB.enrollments
    .filter(e => e.sectionId === sectionId)
    .map(e => getStudent(e.studentId))
    .filter(Boolean);
}

/* ── Grade of a student in a section ── */
function gradeFor(studentId, sectionId) {
  return DB.grades.find(g => g.studentId === studentId && g.sectionId === sectionId);
}

/* ── Grade summary for an array of section IDs ── */
function gradeSummary(secIds) {
  const gs = DB.grades.filter(g => secIds.includes(g.sectionId) && g.grade !== 'INC');
  const total    = gs.length;
  const passed   = gs.filter(g => g.grade <= 3).length;
  const failed   = total - passed;
  const avg      = total ? gs.reduce((a, g) => a + g.grade, 0) / total : null;
  const passRate = total ? Math.round(passed / total * 100) : null;
  return { total, passed, failed, avg, passRate };
}

/* ── All section IDs under a department ── */
function secIdsForDept(deptId) {
  const subjIds = DB.subjects.filter(s => s.deptId === deptId).map(s => s.id);
  return DB.sections.filter(s => subjIds.includes(s.subjectId)).map(s => s.id);
}

/* ── All section IDs under a college ─── */
function secIdsForCollege(collegeId) {
  const deptIds = DB.departments.filter(d => d.collegeId === collegeId).map(d => d.id);
  const subjIds = DB.subjects.filter(s => deptIds.includes(s.deptId)).map(s => s.id);
  return DB.sections.filter(s => subjIds.includes(s.subjectId)).map(s => s.id);
}

/* ── Students with at least one failing grade ──
   scoped to a set of section IDs              */
function getFailingStudents(scopeSecIds) {
  // All grade records that are failing, within scope
  const failGrades = DB.grades.filter(g =>
    scopeSecIds.includes(g.sectionId) &&
    g.grade !== 'INC' &&
    g.grade > 3.0
  );
  // Unique student IDs
  const stuIds = [...new Set(failGrades.map(g => g.studentId))];
  return stuIds.map(sid => {
    const student = getStudent(sid);
    const fails   = failGrades.filter(g => g.studentId === sid);
    return { student, failCount: fails.length };
  }).filter(x => x.student);
}

/* ── Performance by year level ──────── */
function perfByYear(secIds) {
  const years = [1, 2, 3, 4];
  return years.map(yr => {
    const subjIds = DB.subjects.filter(s => s.year === yr).map(s => s.id);
    const sIds    = DB.sections.filter(s => secIds.includes(s.id) && subjIds.includes(s.subjectId)).map(s => s.id);
    const sm      = gradeSummary(sIds);
    return { year: yr, ...sm };
  }).filter(r => r.total > 0);
}

/* ── Bar row helper ──────────────────── */
function barRow(label, pct, color) {
  const w = pct == null ? 0 : Math.min(pct, 100);
  return `
    <div class="bar-row">
      <div class="bar-label">${esc(label)}</div>
      <div class="bar-track"><div class="bar-fill" style="width:${w}%;background:${color}"></div></div>
      <div class="bar-val" style="color:${color}">${pct == null ? '—' : pct + '%'}</div>
    </div>`;
}

/* ── Stat card helper ────────────────── */
function statCard(icon, label, val, color, bg) {
  return `
    <div class="stat-card">
      <div class="stat-icon" style="background:${bg};color:${color}">${icon}</div>
      <div>
        <div class="stat-val">${val}</div>
        <div class="stat-label">${label}</div>
      </div>
    </div>`;
}

/* ── Pass rate cell ──────────────────── */
function prCell(pr) {
  if (pr == null) return '<span class="text-muted text-sm">—</span>';
  const color = pr >= 75 ? 'var(--success)' : 'var(--danger)';
  return `<span style="color:${color};font-weight:700">${pr}%</span>`;
}
