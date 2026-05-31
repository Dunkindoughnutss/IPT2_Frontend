function esc(s) {
  return String(s == null ? '—' : s)
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}
function initials(n) { return (n || '?').split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase(); }
function fmt2(g)     { return parseFloat(g).toFixed(2); }
function today()     { return new Date().toLocaleDateString('en-PH', { weekday:'long', year:'numeric', month:'long', day:'numeric' }); }

function gradeDesc(g) {
  if (g === 'INC') return 'Incomplete';
  if (g <= 1.0) return 'Excellent';
  if (g <= 1.5) return 'Very Good';
  if (g <= 2.0) return 'Good';
  if (g <= 2.5) return 'Satisfactory';
  if (g <= 3.0) return 'Passing';
  return 'Failed';
}

function gradeColor(g) {
  if (g === 'INC') return 'var(--warning)';
  return g > 3 ? 'var(--danger)' : g > 2.5 ? 'var(--warning)' : 'var(--success)';
}

// Student status helpers
function stuStatus(s)       { return ({ enrolled:'Enrolled', inactive:'Inactive', graduated:'Graduated', archived:'Archived' }[s.status] || s.status); }
function stuStatusBadge(s)  { return ({ enrolled:'success',  inactive:'muted',    graduated:'info',       archived:'muted'    }[s.status] || 'muted'); }
function stuEnrolled(s)     { return s.status === 'enrolled'; }

// Lookups
const getCollege = id => DB.colleges.find(c => c.id === id);
const getDept    = id => DB.departments.find(d => d.id === id);
const getSubject = id => DB.subjects.find(s => s.id === id);
const getSection = id => DB.sections.find(s => s.id === id);
const getUser    = id => DB.users.find(u => u.id === id);
const getStudent = id => DB.students.find(s => s.id === id);

// Scoped section ID arrays
function secIdsForCollege(cid) {
  const dids = DB.departments.filter(d => d.collegeId === cid).map(d => d.id);
  const sids = DB.subjects.filter(s => dids.includes(s.deptId)).map(s => s.id);
  return DB.sections.filter(s => sids.includes(s.subjectId)).map(s => s.id);
}

function secIdsForDept(did) {
  const sids = DB.subjects.filter(s => s.deptId === did).map(s => s.id);
  return DB.sections.filter(s => sids.includes(s.subjectId)).map(s => s.id);
}

// Aggregate grade summary — never exposes individual records
function gradeSummary(secIds) {
  const gs       = DB.grades.filter(g => secIds.includes(g.sectionId) && g.grade !== 'INC');
  const total    = gs.length;
  const passed   = gs.filter(g => g.grade <= 3).length;
  const failed   = total - passed;
  const avg      = total ? gs.reduce((a, g) => a + g.grade, 0) / total : null;
  const passRate = total ? Math.round(passed / total * 100) : null;
  return { total, passed, failed, avg, passRate };
}

// Students enrolled in a section
function enrolledIn(sectionId) {
  return DB.enrollments
    .filter(e => e.sectionId === sectionId)
    .map(e => getStudent(e.studentId))
    .filter(Boolean);
}

// Grade of a student in a section
function gradeFor(studentId, sectionId) {
  return DB.grades.find(g => g.studentId === studentId && g.sectionId === sectionId);
}

// Pass rate for one section
function sectionPassRate(sectionId) {
  const gs = DB.grades.filter(g => g.sectionId === sectionId);
  if (!gs.length) return null;
  return Math.round(gs.filter(g => g.grade <= 3).length / gs.length * 100);
}

// Overall GPA for a student (passing grades only, excludes INC)
function calcGPA(studentId) {
  const gs = DB.grades.filter(g => g.studentId === studentId && g.grade !== 'INC' && g.grade <= 3);
  if (!gs.length) return null;
  return gs.reduce((a, g) => a + g.grade, 0) / gs.length;
}

// GPA for a student in one specific semester
function semesterGPA(studentId, sy, sem) {
  const secIds = DB.sections
    .filter(s => s.sy === sy && s.sem === sem && s.submitted)
    .map(s => s.id);
  const enrIds = DB.enrollments
    .filter(e => e.studentId === studentId && secIds.includes(e.sectionId))
    .map(e => e.sectionId);
  const gs = enrIds
    .map(sid => gradeFor(studentId, sid))
    .filter(Boolean)
    .filter(g => g.grade <= 3);
  if (!gs.length) return null;
  return gs.reduce((a, g) => a + g.grade, 0) / gs.length;
}

// All semesters a student has submitted grades in
function studentSemesters(studentId) {
  const myEnr = DB.enrollments.filter(e => e.studentId === studentId);
  const keys  = [...new Set(
    DB.sections
      .filter(s => myEnr.some(e => e.sectionId === s.id) && s.submitted)
      .map(s => `${s.sy}|${s.sem}`)
  )].sort();
  return keys.map(k => {
    const [sy, sem] = k.split('|');
    return { sy, sem, gpa: semesterGPA(studentId, sy, sem) };
  });
}

// Institution-wide pass rate trend by semester
function institutionTrend() {
  const keys = [...new Set(DB.sections.filter(s => s.submitted).map(s => `${s.sy}|${s.sem}`))].sort();
  return keys.map(k => {
    const [sy, sem] = k.split('|');
    const sids = DB.sections.filter(s => s.sy === sy && s.sem === sem && s.submitted).map(s => s.id);
    const sm   = gradeSummary(sids);
    return { label: `${sem} ${sy}`, passRate: sm.passRate, total: sm.total, passed: sm.passed, failed: sm.failed };
  });
}

// College-scoped trend
function collegeTrend(collegeId) {
  const allSids = secIdsForCollege(collegeId);
  const keys    = [...new Set(
    DB.sections.filter(s => allSids.includes(s.id) && s.submitted).map(s => `${s.sy}|${s.sem}`)
  )].sort();
  return keys.map(k => {
    const [sy, sem] = k.split('|');
    const sids = DB.sections.filter(s => allSids.includes(s.id) && s.sy === sy && s.sem === sem && s.submitted).map(s => s.id);
    const sm   = gradeSummary(sids);
    return { label: `${sem} ${sy}`, passRate: sm.passRate, total: sm.total, passed: sm.passed, failed: sm.failed };
  });
}

// Department-scoped trend
function deptTrend(deptId) {
  const allSids = secIdsForDept(deptId);
  const keys    = [...new Set(
    DB.sections.filter(s => allSids.includes(s.id) && s.submitted).map(s => `${s.sy}|${s.sem}`)
  )].sort();
  return keys.map(k => {
    const [sy, sem] = k.split('|');
    const sids = DB.sections.filter(s => allSids.includes(s.id) && s.sy === sy && s.sem === sem && s.submitted).map(s => s.id);
    const sm   = gradeSummary(sids);
    return { label: `${sem} ${sy}`, passRate: sm.passRate, total: sm.total, passed: sm.passed, failed: sm.failed };
  });
}

// Bottleneck detection — subjects with high failure rates across semesters
function getBottleneckSubjects(scopeSecIds) {
  const allSecs = scopeSecIds
    ? DB.sections.filter(s => scopeSecIds.includes(s.id) && s.submitted)
    : DB.sections.filter(s => s.submitted);
  const subjIds = [...new Set(allSecs.map(s => s.subjectId))];
  return subjIds
    .map(sid => {
      const subj     = getSubject(sid);
      const secIds   = allSecs.filter(s => s.subjectId === sid).map(s => s.id);
      const gs       = DB.grades.filter(g => secIds.includes(g.sectionId));
      if (!gs.length) return null;
      const failed   = gs.filter(g => g.grade > 3).length;
      const failRate = Math.round(failed / gs.length * 100);
      return { subj, failRate, total: gs.length, failed };
    })
    .filter(Boolean)
    .filter(b => b.total >= 1)
    .sort((a, b) => b.failRate - a.failRate)
    .slice(0, 10);
}

// Early Warning System — detect at-risk students
function getAtRiskStudents(pool) {
  return pool.map(s => {
    const gpa       = calcGPA(s.id);
    const sems      = studentSemesters(s.id).filter(x => x.gpa != null);
    let declining   = false;
    if (sems.length >= 2) {
      const last = sems[sems.length - 1].gpa;
      const prev = sems[sems.length - 2].gpa;
      declining  = last > prev + 0.25; // GPA worsened by 0.25+
    }
    const failedSubjIds = DB.grades
      .filter(g => g.studentId === s.id && g.grade > 3)
      .map(g => getSection(g.sectionId)?.subjectId);
    const repeatedFail = failedSubjIds.some((id, i) => failedSubjIds.indexOf(id) !== i);
    const failCount    = DB.grades.filter(g => g.studentId === s.id && g.grade > 3).length;
    const isAtRisk     = declining || repeatedFail || (gpa != null && gpa >= 2.75) || failCount >= 2;
    return { s, gpa, declining, repeatedFail, failCount, isAtRisk };
  }).filter(x => x.isAtRisk);
}


/* ──────────────────────────────────────────────
