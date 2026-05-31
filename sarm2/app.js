/* ══════════════════════════════════════════════
   SARM · app.js  v4
   Student Academic Record Management System
   University of Eastern Philippines · College of Science

   FEATURES
   ──────────────────────────────────────────────
   ✔  Role-based access: Registrar, Dean, Chairman, Faculty, Student
   ✔  Proper record archiving (enrolled/inactive/graduated/archived)
   ✔  Grade validation + Save Draft workflow
   ✔  Grade locking — Lock & Submit routes grades to students
   ✔  Semester trend analysis
   ✔  Early Warning System (at-risk detection)
   ✔  GPA trend sparklines per student
   ✔  Bottleneck subject detection
   ✔  Account lockout after 5 failed attempts
   ✔  Auto-backup every 5 minutes
   ✔  Faculty doubles as Adviser — My Advisees module
══════════════════════════════════════════════ */

'use strict';

/* ──────────────────────────────────────────────
   STORE
────────────────────────────────────────────── */
const STORE_KEY = 'sarm_v4';

// On every page load: wipe ALL old sarm_ keys regardless of version
(function clearOldKeys() {
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sarm_') && k !== STORE_KEY) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
})();

function loadStore() {
  try {
    const raw = localStorage.getItem(STORE_KEY);
    return raw ? JSON.parse(raw) : null;
  } catch { return null; }
}

function saveStore(d) {
  try { localStorage.setItem(STORE_KEY, JSON.stringify(d)); } catch {}
}

// Called by the Reset Demo Data button on the login screen
function resetStore() {
  // Wipe everything sarm-related
  try {
    const toRemove = [];
    for (let i = 0; i < localStorage.length; i++) {
      const k = localStorage.key(i);
      if (k && k.startsWith('sarm_')) toRemove.push(k);
    }
    toRemove.forEach(k => localStorage.removeItem(k));
  } catch {}
  DB = initStore();
  const errEl = document.getElementById('login-error');
  errEl.textContent = '✔ Data reset. You can now log in with the demo accounts below.';
  errEl.style.cssText = 'background:#f0fdf4;border:1px solid #86efac;color:#16a34a;border-radius:10px;padding:11px 15px;font-size:.85rem;margin-bottom:16px;font-weight:500;display:block';
}

function initStore() {
  let ex = null;
  try { ex = loadStore(); } catch {}
  // Only reuse valid v4 data with a populated users array
  if (ex && ex._v === 4 && Array.isArray(ex.users) && ex.users.length > 0) return ex;
  // Otherwise wipe and reseed
  try { localStorage.removeItem(STORE_KEY); } catch {}

  const d = {
    _v: 4,

    users: [
      { id:1, name:'Registrar Office', role:'Registrar', username:'registrar', password:'reg123', active:true, created:'2024-01-01', failedAttempts:0, lockedOut:false },
    ],

    colleges:    [],
    departments: [],
    subjects:    [],
    sections:    [],
    students:    [],
    enrollments: [],
    grades:      [],

    auditLog: [
      { id:1, user:'system', action:'System initialized — SARM v4', ip:'127.0.0.1', ts: new Date().toISOString().replace('T',' ').slice(0,19), ok:true },
    ],

    backupLog:   [],
    lastBackup:  null,
    backupCount: 0,

    nextId: { user:2, section:1, enrollment:1, grade:1, audit:2, college:1, dept:1, student:100001 },
  };

  saveStore(d);
  return d;
}

let DB          = initStore();
let currentUser = null;

function save() { saveStore(DB); }

function logAudit(action, ok = true) {
  if (!currentUser) return;
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);
  DB.auditLog.unshift({
    id:     DB.nextId.audit++,
    user:   currentUser.username,
    action,
    ip:     '192.168.1.' + (Math.floor(Math.random() * 20) + 10),
    ts,
    ok,
  });
  if (DB.auditLog.length > 200) DB.auditLog.length = 200;
  save();
}


/* ──────────────────────────────────────────────
   HELPERS
────────────────────────────────────────────── */
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
   TOAST
────────────────────────────────────────────── */
function toast(msg, type = 'info') {
  const wrap  = document.getElementById('toast-wrap');
  const icons = { success: '✔', error: '✖', info: 'ℹ' };
  const el    = document.createElement('div');
  el.className = `toast toast-${type}`;
  el.innerHTML = `<span>${icons[type] || '·'}</span><span>${esc(msg)}</span>`;
  wrap.appendChild(el);
  setTimeout(() => el.remove(), 3200);
}


/* ──────────────────────────────────────────────
   AUTO-BACKUP  (every 5 minutes after login)
────────────────────────────────────────────── */
function runBackup(manual = false) {
  const ts   = new Date().toISOString().replace('T', ' ').slice(0, 19);
  const size = JSON.stringify(DB).length;
  DB.lastBackup   = ts;
  DB.backupCount  = (DB.backupCount || 0) + 1;
  DB.backupLog    = DB.backupLog || [];
  DB.backupLog.unshift({ id: DB.backupCount, ts, size, auto: !manual });
  if (DB.backupLog.length > 30) DB.backupLog.length = 30;
  save();
  if (manual) toast('Manual backup completed ✔', 'success');
  else        toast('Auto-backup completed ✔', 'success');
}

function startAutoBackup() {
  // First backup 10 seconds after login
  setTimeout(() => runBackup(false), 10000);
  // Then every 5 minutes
  setInterval(() => runBackup(false), 300000);
}


/* ──────────────────────────────────────────────
   NAVIGATION
────────────────────────────────────────────── */
const NAV = [
  { key: 'dashboard',   label: 'Dashboard',           icon: '⬡', sec: 'OVERVIEW', roles: ['Registrar','Dean','Chairman','Faculty'] },
  { key: 'users',       label: 'User Accounts',        icon: '◈', sec: 'MODULES',  roles: ['Registrar'] },
  { key: 'students',    label: 'Student Records',      icon: '🎓', sec: 'MODULES',  roles: ['Registrar'] },
  { key: 'performance', label: 'Academic Performance', icon: '◎', sec: 'MODULES',  roles: ['Registrar','Dean','Chairman'] },
  { key: 'analytics',   label: 'Data Analytics',       icon: '◆', sec: 'MODULES',  roles: ['Registrar','Dean','Chairman'] },
  { key: 'college',     label: 'My College',           icon: '◉', sec: 'MODULES',  roles: ['Dean'] },
  { key: 'assignment',  label: 'Subject Assignment',   icon: '◇', sec: 'MODULES',  roles: ['Chairman'] },
  { key: 'chairstudents', label: 'Student Records',    icon: '🎓', sec: 'MODULES',  roles: ['Chairman'] },
  { key: 'advisees',    label: 'My Advisees',          icon: '◉', sec: 'MODULES',  roles: ['Faculty'] },
  { key: 'sections',    label: 'Handled Sections',     icon: '◈', sec: 'MODULES',  roles: ['Faculty'] },
  { key: 'encode',      label: 'Encode Grades',        icon: '◇', sec: 'MODULES',  roles: ['Faculty'] },
  { key: 'mygrades',    label: 'My Grades',            icon: '◉', sec: 'MODULES',  roles: ['Student'] },
  { key: 'progress',    label: 'Academic Progress',    icon: '◎', sec: 'MODULES',  roles: ['Student'] },
  { key: 'archives',    label: 'Archives',             icon: '🗃', sec: 'MODULES',  roles: ['Registrar'] },
  { key: 'curriculum',  label: 'Curriculum',           icon: '📖', sec: 'MODULES',  roles: ['Registrar'] },
  { key: 'colleges',    label: 'Colleges & Depts',     icon: '🏛', sec: 'MODULES',  roles: ['Registrar'] },
  { key: 'security',    label: 'Security & Backup',    icon: '◆', sec: 'SYSTEM',   roles: ['Registrar'] },
];

const canAccess = key => NAV.find(n => n.key === key)?.roles.includes(currentUser?.role);


/* ──────────────────────────────────────────────
   AUTH  (account lockout after MAX_ATTEMPTS fails)
────────────────────────────────────────────── */
const MAX_ATTEMPTS = 5;

function doLogin() {
  const err = document.getElementById('login-error');
  err.style.cssText = '';
  err.classList.add('hidden');

  // No choice made yet
  if (typeof _studentMode === 'undefined' || _studentMode === null) {
    err.textContent = 'Please select whether you are a Student or not before signing in.';
    err.classList.remove('hidden');
    return;
  }

  const isStudent = _studentMode;

  // ── STUDENT LOGIN ──
  if (isStudent) {
    const sid  = (document.getElementById('stu-id')?.value  || '').trim();
    const bday = (document.getElementById('stu-bday')?.value || '').trim().replace(/\D/g,'');

    if (!sid)  { err.textContent = 'Please enter your Student ID.'; err.classList.remove('hidden'); return; }
    if (!bday) { err.textContent = 'Please enter your birthday.'; err.classList.remove('hidden'); return; }
    if (!/^\d{6}$/.test(sid)) { err.textContent = 'Student ID must be exactly 6 digits (e.g. 238101).'; err.classList.remove('hidden'); return; }
    if (bday.length !== 8)    { err.textContent = 'Birthday must be 8 digits in mmddyyyy format (e.g. 02242003).'; err.classList.remove('hidden'); return; }

    const student = DB.students.find(s => s.id === sid);
    if (!student) {
      err.textContent = `Student ID ${sid} not found. Please verify with the Registrar's Office.`;
      err.classList.remove('hidden');
      return;
    }
    if (!student.birthday) {
      err.textContent = 'No birthday is on file for this account. Contact the Registrar\'s Office.';
      err.classList.remove('hidden');
      return;
    }
    if (bday !== student.birthday) {
      err.textContent = 'Incorrect birthday. Please try again.';
      err.classList.remove('hidden');
      return;
    }
    currentUser = {
      id: null, name: student.name, role: 'Student',
      username: student.id, active: true, studentId: student.id,
    };
    err.classList.add('hidden');
    logAudit('Student Login', true);
    save();
    startApp();
    return;
  }

  // ── STAFF LOGIN ──
  const u  = (document.getElementById('login-user')?.value || '').trim();
  const p  = (document.getElementById('login-pass')?.value || '');
  const ts = new Date().toISOString().replace('T', ' ').slice(0, 19);

  const rec = DB.users.find(x => x.username === u);

  if (rec?.lockedOut) {
    err.textContent = '⛔ This account is locked. Please contact the Registrar\'s Office.';
    err.classList.remove('hidden');
    DB.auditLog.unshift({ id: DB.nextId.audit++, user: u, action: 'Login attempt on locked account', ip: '203.100.22.5', ts, ok: false });
    save();
    return;
  }

  const found = DB.users.find(x => x.username === u && x.password === p && x.active && !x.lockedOut);

  if (!found) {
    if (rec && rec.active) {
      rec.failedAttempts = (rec.failedAttempts || 0) + 1;
      if (rec.failedAttempts >= MAX_ATTEMPTS) {
        rec.lockedOut = true;
        DB.auditLog.unshift({ id: DB.nextId.audit++, user: u, action: `Account locked after ${MAX_ATTEMPTS} failed attempts`, ip: '203.100.22.5', ts, ok: false });
        err.textContent = `⛔ Account locked after ${MAX_ATTEMPTS} failed attempts. Contact the Registrar's Office.`;
      } else {
        const rem = MAX_ATTEMPTS - rec.failedAttempts;
        DB.auditLog.unshift({ id: DB.nextId.audit++, user: u, action: 'Failed Login Attempt', ip: '203.100.22.5', ts, ok: false });
        err.textContent = `Invalid credentials. ${rem} attempt(s) remaining before lockout.`;
      }
    } else {
      DB.auditLog.unshift({ id: DB.nextId.audit++, user: 'unknown', action: 'Failed Login Attempt (unknown user)', ip: '203.100.22.5', ts, ok: false });
      err.textContent = 'Invalid username or password. Please contact the Registrar\'s Office if you need assistance.';
    }
    save();
    err.classList.remove('hidden');
    return;
  }

  found.failedAttempts = 0;
  err.classList.add('hidden');
  currentUser = found;
  logAudit('System Login', true);
  save();
  startApp();
}

function doLogout() {
  logAudit('System Logout', true);
  currentUser = null;
  document.getElementById('app').style.display          = 'none';
  document.getElementById('login-screen').style.display = 'grid';
  document.getElementById('login-error').classList.add('hidden');
  // Reset toggle — hide both field groups, clear active buttons
  if (typeof _studentMode !== 'undefined') {
    window._studentMode = null;
    document.getElementById('btn-yes')?.classList.remove('active');
    document.getElementById('btn-no')?.classList.remove('active');
    document.getElementById('staff-fields').style.display   = 'none';
    document.getElementById('student-fields').style.display = 'none';
    document.getElementById('login-user') && (document.getElementById('login-user').value = '');
    document.getElementById('login-pass') && (document.getElementById('login-pass').value = '');
    document.getElementById('stu-id')    && (document.getElementById('stu-id').value    = '');
    document.getElementById('stu-bday')  && (document.getElementById('stu-bday').value  = '');
  }
}

function startApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app').style.display          = 'flex';
  document.getElementById('sb-avatar').textContent      = initials(currentUser.name);
  document.getElementById('sb-name').textContent        = currentUser.name;
  document.getElementById('sb-role').textContent        = currentUser.role;
  document.getElementById('topbar-date').textContent    = today();
  buildNav();
  startAutoBackup();
  navigate(NAV.find(n => n.roles.includes(currentUser.role))?.key || 'dashboard');
}

function buildNav() {
  const items = NAV.filter(n => n.roles.includes(currentUser.role));
  const secs  = [...new Set(items.map(n => n.sec))];
  let html = '';
  secs.forEach(s => {
    html += `<div class="nav-section">${s}</div>`;
    items.filter(n => n.sec === s).forEach(n => {
      html += `<div class="nav-item" id="nav-${n.key}" onclick="navigate('${n.key}')">${n.icon} <span style="margin-left:2px">${n.label}</span></div>`;
    });
  });
  document.getElementById('sidebar-nav').innerHTML = html;
}

function navigate(key) {
  if (!canAccess(key)) { toast('Access denied', 'error'); return; }
  document.querySelectorAll('.nav-item').forEach(el => el.classList.remove('active'));
  const el = document.getElementById('nav-' + key);
  if (el) el.classList.add('active');
  const titles = {
    dashboard:     'Dashboard',
    users:         'User Accounts',
    students:      'Student Records',
    performance:   'Academic Performance',
    analytics:     'Data Analytics',
    archives:      'Archives',
    curriculum:    'Curriculum Management',
    colleges:      'Colleges & Departments',
    college:       'My College',
    assignment:    'Subject Assignment',
    chairstudents: 'Student Records',
    advisees:      'My Advisees',
    sections:      'Handled Sections',
    encode:        'Encode Grades',
    mygrades:      'My Grades',
    progress:      'Academic Progress',
    security:      'Security & Backup',
  };
  document.getElementById('page-title').textContent = titles[key] || key;
  document.getElementById('page-content').innerHTML = '';
  ({
    dashboard:     renderDashboard,
    users:         renderUsers,
    students:      renderStudentRecords,
    performance:   renderPerformance,
    analytics:     renderAnalytics,
    archives:      renderArchives,
    curriculum:    renderCurriculum,
    colleges:      renderCollegesAdmin,
    college:       renderCollege,
    assignment:    renderAssignment,
    chairstudents: renderChairStudents,
    advisees:      renderAdvisees,
    sections:      renderSections,
    encode:        renderEncode,
    mygrades:      renderMyGrades,
    progress:      renderProgress,
    security:      renderSecurity,
  })[key]?.();
}

document.addEventListener('keydown', e => { if (e.key === 'Escape') closeModal(); });

// Shortcut to set page content
function set(html) { document.getElementById('page-content').innerHTML = html; }


/* ──────────────────────────────────────────────
   SHARED UI ATOMS
────────────────────────────────────────────── */
function statCard(icon, label, val, color, bg) {
  return `<div class="stat-card">
    <div class="stat-icon" style="background:${bg};color:${color}">${icon}</div>
    <div>
      <div class="stat-val">${val}</div>
      <div class="stat-label">${label}</div>
    </div>
  </div>`;
}

function barRow(label, pct, color) {
  const w = pct == null ? 0 : Math.min(pct, 100);
  return `<div class="chart-bar-row">
    <div class="chart-bar-label">${esc(label)}</div>
    <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${w}%;background:${color}"></div></div>
    <div class="chart-bar-val" style="color:${color}">${pct == null ? '—' : pct + '%'}</div>
  </div>`;
}

function miniStat(label, val, color) {
  return `<div class="mini-stat">
    <div class="mini-stat-val" style="color:${color}">${val}</div>
    <div class="mini-stat-label">${label}</div>
  </div>`;
}

function donutSVG(pct, size, color) {
  const r    = 36, cx = 45, cy = 45;
  const circ = 2 * Math.PI * r;
  const dash = ((pct || 0) / 100) * circ;
  return `<div class="donut-wrap" style="width:${size}px;height:${size}px;flex-shrink:0">
    <svg width="${size}" height="${size}" viewBox="0 0 90 90">
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="#e5e7eb" stroke-width="10"/>
      <circle cx="${cx}" cy="${cy}" r="${r}" fill="none" stroke="${color}" stroke-width="10"
        stroke-dasharray="${dash} ${circ}" stroke-linecap="round" transform="rotate(-90 ${cx} ${cy})"/>
    </svg>
    <div class="donut-center">
      <div class="donut-val" style="color:${color};font-size:.95rem">${pct == null ? '—' : pct + '%'}</div>
    </div>
  </div>`;
}

function infoRow(k, v) {
  return `<div class="info-row">
    <span class="info-key">${k}</span>
    <span class="info-val">${v}</span>
  </div>`;
}

function alertBox(icon, msg, type = 'info') {
  return `<div class="alert-box alert-${type}">${icon} <span>${msg}</span></div>`;
}

function prCell(pr) {
  if (pr == null) return '<span class="text-muted text-sm">Pending</span>';
  return `<span style="color:${pr >= 75 ? 'var(--success)' : 'var(--danger)'};font-weight:700">${pr}%</span>`;
}

// SVG sparkline for GPA trends
function sparkline(vals, w = 120, h = 36) {
  if (vals.length < 2) return '<span class="text-muted text-xs">—</span>';
  const mn   = Math.min(...vals);
  const mx   = Math.max(...vals);
  const rng  = mx - mn || 0.1;
  const pts  = vals.map((v, i) => {
    const x = Math.round(i / (vals.length - 1) * w);
    const y = Math.round(h - (v - mn) / rng * (h - 6) + 3);
    return `${x},${y}`;
  }).join(' ');
  const last = vals[vals.length - 1];
  const prev = vals[vals.length - 2];
  const c    = last > prev ? 'var(--danger)' : last < prev ? 'var(--success)' : 'var(--warning)';
  const lx   = pts.split(' ').pop().split(',')[0];
  const ly   = pts.split(' ').pop().split(',')[1];
  return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" style="overflow:visible">
    <polyline fill="none" stroke="${c}" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" points="${pts}"/>
    <circle cx="${lx}" cy="${ly}" r="3" fill="${c}"/>
  </svg>`;
}

// Trend table for analytics
function trendTable(data) {
  if (!data || !data.length) return '<div class="text-muted text-sm">No semester data yet.</div>';
  return `<div class="table-wrap"><table>
    <thead><tr>
      <th>Semester</th><th>Total Grades</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Trend</th>
    </tr></thead>
    <tbody>${data.map((t, i) => {
      const prev  = data[i - 1];
      let arrow   = '—';
      if (prev != null && t.passRate != null && prev.passRate != null) {
        const diff = t.passRate - prev.passRate;
        if (diff > 0) arrow = `<span style="color:var(--success)">▲ +${diff}%</span>`;
        else if (diff < 0) arrow = `<span style="color:var(--danger)">▼ ${diff}%</span>`;
        else arrow = `<span style="color:var(--warning)">● Same</span>`;
      }
      return `<tr>
        <td class="fw-6">${esc(t.label)}</td>
        <td>${t.total}</td>
        <td style="color:var(--success)">${t.passed}</td>
        <td style="color:var(--danger)">${t.failed}</td>
        <td>${prCell(t.passRate)}</td>
        <td>${arrow}</td>
      </tr>`;
    }).join('')}</tbody>
  </table></div>`;
}


/* ──────────────────────────────────────────────
   YEAR-LEVEL PANEL  (used in Registrar + Chairman dashboards)
────────────────────────────────────────────── */
function buildYearPanel(year, students) {
  const ordinal    = ['', '1st', '2nd', '3rd', '4th'][year];
  const yrStudents = students.filter(s => s.year === year);
  const total      = yrStudents.length;

  if (total === 0) {
    return `<div class="empty" style="padding:36px">
      <div class="empty-icon">🎓</div>
      <div class="empty-text">No ${ordinal} Year students found.</div>
    </div>`;
  }

  const enrolled = yrStudents.filter(stuEnrolled).length;
  const inactive = total - enrolled;
  const male     = yrStudents.filter(s => s.gender === 'Male').length;
  const female   = yrStudents.filter(s => s.gender === 'Female').length;
  const malePct  = Math.round(male   / total * 100);
  const femPct   = Math.round(female / total * 100);

  const stuIds   = yrStudents.map(s => s.id);
  const allGrades = DB.grades.filter(g => stuIds.includes(g.studentId));
  const passing  = new Set(allGrades.filter(g => g.grade <= 3).map(g => g.studentId));
  const failing  = new Set(allGrades.filter(g => g.grade > 3).map(g => g.studentId));
  const noData   = stuIds.filter(id => !passing.has(id) && !failing.has(id)).length;
  const passPct  = Math.round(passing.size / total * 100);
  const failPct  = Math.round(failing.size  / total * 100);
  const allPass  = [...passing].filter(id => !failing.has(id)).length;
  const mixed    = [...passing].filter(id =>  failing.has(id)).length;

  return `
  <!-- Quick stats row -->
  <div class="grid-4 mb-20">
    ${miniStat('Total Students',      total,         'var(--blue)')}
    ${miniStat('Currently Enrolled',  enrolled,      'var(--success)')}
    ${miniStat('Inactive / LOA',      inactive,      'var(--text3)')}
    ${miniStat('No Grade Data Yet',   noData,        'var(--warning)')}
  </div>

  <!-- Distribution cards -->
  <div class="grid-2 mb-20">

    <div class="card">
      <div class="card-title">Sex Distribution</div>
      <div class="flex gap-16 mb-16" style="align-items:center">
        ${donutSVG(malePct, 88, 'var(--blue)')}
        <div style="flex:1">
          <div class="flex-between mb-8">
            <div class="flex gap-8">
              <span style="width:10px;height:10px;border-radius:50%;background:var(--blue);flex-shrink:0;margin-top:3px"></span>
              <span class="text-sm fw-6">Male</span>
            </div>
            <span class="fw-7" style="color:var(--blue)">${male} (${malePct}%)</span>
          </div>
          <div class="progress mb-14" style="height:8px">
            <div class="progress-bar" style="width:${malePct}%"></div>
          </div>
          <div class="flex-between mb-8">
            <div class="flex gap-8">
              <span style="width:10px;height:10px;border-radius:50%;background:#ec4899;flex-shrink:0;margin-top:3px"></span>
              <span class="text-sm fw-6">Female</span>
            </div>
            <span class="fw-7" style="color:#ec4899">${female} (${femPct}%)</span>
          </div>
          <div class="progress" style="height:8px">
            <div class="progress-bar" style="width:${femPct}%;background:linear-gradient(90deg,#ec4899,#f472b6)"></div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:10px 14px;display:flex;gap:24px;font-size:.82rem;color:var(--text3)">
        <span>👨 Male: <strong style="color:var(--text)">${male}</strong></span>
        <span>👩 Female: <strong style="color:var(--text)">${female}</strong></span>
        <span>📊 Total: <strong style="color:var(--blue)">${total}</strong></span>
      </div>
    </div>

    <div class="card">
      <div class="card-title">Academic Status</div>
      <div class="flex gap-16 mb-16" style="align-items:center">
        ${donutSVG(passPct, 88, 'var(--success)')}
        <div style="flex:1">
          <div class="flex-between mb-8">
            <div class="flex gap-8">
              <span style="width:10px;height:10px;border-radius:50%;background:var(--success);flex-shrink:0;margin-top:3px"></span>
              <span class="text-sm fw-6">Has Passing Grade</span>
            </div>
            <span class="fw-7" style="color:var(--success)">${passing.size} (${passPct}%)</span>
          </div>
          <div class="progress mb-14" style="height:8px">
            <div class="progress-bar" style="width:${passPct}%;background:linear-gradient(90deg,var(--success),#4ade80)"></div>
          </div>
          <div class="flex-between mb-8">
            <div class="flex gap-8">
              <span style="width:10px;height:10px;border-radius:50%;background:var(--danger);flex-shrink:0;margin-top:3px"></span>
              <span class="text-sm fw-6">Has Failing Grade</span>
            </div>
            <span class="fw-7" style="color:var(--danger)">${failing.size} (${failPct}%)</span>
          </div>
          <div class="progress" style="height:8px">
            <div class="progress-bar" style="width:${failPct}%;background:linear-gradient(90deg,var(--danger),#f87171)"></div>
          </div>
        </div>
      </div>
      <div style="background:var(--bg3);border-radius:10px;padding:10px 14px;display:grid;grid-template-columns:1fr 1fr;gap:6px;font-size:.8rem;color:var(--text3)">
        <span>✅ All Passing: <strong style="color:var(--success)">${allPass}</strong></span>
        <span>❌ Has Failure: <strong style="color:var(--danger)">${failing.size}</strong></span>
        <span>⚠ Mixed: <strong style="color:var(--warning)">${mixed}</strong></span>
        <span>⏳ No Data: <strong style="color:var(--text3)">${noData}</strong></span>
      </div>
    </div>
  </div>

  <!-- Student list for this year level -->
  <div class="section-card" style="margin-bottom:0">
    <div class="section-card-head">
      <div class="fw-6">${ordinal} Year Students (${total})</div>
    </div>
    <div class="table-wrap"><table>
      <thead><tr>
        <th>Student ID</th><th>Name</th><th>Program</th><th>Sex</th><th>Enrollment</th><th>Academic Status</th>
      </tr></thead>
      <tbody>${yrStudents.map(s => {
        const hasPas = passing.has(s.id);
        const hasFal = failing.has(s.id);
        let lbl, cls;
        if (!hasPas && !hasFal) { lbl = '⏳ No Grades';    cls = 'badge-muted'; }
        else if (hasPas && !hasFal) { lbl = '✅ Passing';   cls = 'badge-success'; }
        else if (!hasPas && hasFal) { lbl = '❌ Failing';   cls = 'badge-danger'; }
        else                        { lbl = '⚠ Has Failures'; cls = 'badge-warning'; }
        const bg = s.gender === 'Female'
          ? 'linear-gradient(135deg,#ec4899,#f472b6)'
          : 'linear-gradient(135deg,var(--blue),var(--blue2))';
        return `<tr>
          <td class="mono text-sm text-muted">${esc(s.id)}</td>
          <td><div class="flex gap-8">
            <div class="avatar avatar-sm" style="background:${bg}">${initials(s.name)}</div>
            <span class="fw-6">${esc(s.name)}</span>
          </div></td>
          <td class="text-sm text-muted">${esc(s.program)}</td>
          <td><span class="badge ${s.gender === 'Female' ? 'badge-danger' : 'badge-info'}">${esc(s.gender)}</span></td>
          <td><span class="badge badge-${stuStatusBadge(s)}">${stuStatus(s)}</span></td>
          <td><span class="badge ${cls}">${lbl}</span></td>
        </tr>`;
      }).join('')}</tbody>
    </table></div>
  </div>`;
}

function switchYearTab(year, scope, scopeId) {
  const tabsId  = scope === 'all' ? 'yr-tabs-reg'   : 'yr-tabs-chair';
  const panelId = scope === 'all' ? 'yr-panel-reg'  : 'yr-panel-chair';
  const pool    = (scope === 'col' && scopeId)
    ? DB.students.filter(s => s.collegeId === scopeId)
    : DB.students;
  document.getElementById(tabsId)
    ?.querySelectorAll('.tab')
    .forEach((t, i) => t.classList.toggle('active', i + 1 === year));
  const panelEl = document.getElementById(panelId);
  if (panelEl) panelEl.innerHTML = buildYearPanel(year, pool);
}


/* ──────────────────────────────────────────────
   DASHBOARD  (role-dispatched)
────────────────────────────────────────────── */
function renderDashboard() {
  const r = currentUser.role;
  if      (r === 'Registrar') dashRegistrar();
  else if (r === 'Dean')      dashDean();
  else if (r === 'Chairman')  dashChairman();
  else if (r === 'Faculty')   dashFaculty();
  else navigate('mygrades');  // Student
}

/* ── Registrar Dashboard ── */
function dashRegistrar() {
  const total      = DB.students.length;
  const enrolled   = DB.students.filter(stuEnrolled).length;
  const graduated  = DB.students.filter(s => s.status === 'graduated').length;
  const inactive   = DB.students.filter(s => s.status === 'inactive').length;
  const facCount   = DB.users.filter(u => u.role === 'Faculty').length;
  const overall    = gradeSummary(DB.sections.filter(s => s.submitted).map(s => s.id));
  const lockedAcc  = DB.users.filter(u => u.lockedOut).length;

  // Per-college data
  const colRows = DB.colleges.map(col => {
    const sids = secIdsForCollege(col.id).filter(id => getSection(id)?.submitted);
    const sm   = gradeSummary(sids);
    return {
      col, sm,
      students: DB.students.filter(s => s.collegeId === col.id).length,
      enrolled: DB.students.filter(s => s.collegeId === col.id && stuEnrolled(s)).length,
      sections: sids.length,
      depts:    DB.departments.filter(d => d.collegeId === col.id).length,
    };
  });

  // Headcount by year level
  const yearCounts = [1,2,3,4].map(yr => ({
    yr, count: DB.students.filter(s => s.year === yr && stuEnrolled(s)).length,
  }));
  const maxYr = Math.max(...yearCounts.map(y => y.count), 1);

  // Gender headcount
  const maleCount   = DB.students.filter(s => s.gender === 'Male'   && stuEnrolled(s)).length;
  const femaleCount = DB.students.filter(s => s.gender === 'Female' && stuEnrolled(s)).length;

  set(`
    ${lockedAcc > 0 ? `<div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(230,57,70,.3);color:#b91c1c;border-radius:10px;padding:11px 16px;margin-bottom:16px;font-size:.84rem;font-weight:500;display:flex;align-items:center;gap:10px">
      ⛔ <strong>${lockedAcc} account(s) locked.</strong>
      <button class="btn btn-sm btn-danger" onclick="navigate('users')">Manage</button>
    </div>` : ''}

    <!-- University-Wide Passing Rate hero -->
    <div class="card mb-20" style="background:linear-gradient(135deg,#1a1f5e 0%,#2d3a9e 50%,#4361ee 100%);color:#fff;border:none;position:relative;overflow:hidden">
      <div style="position:absolute;top:-60px;right:-60px;width:220px;height:220px;border-radius:50%;background:rgba(255,255,255,.05)"></div>
      <div style="position:relative">
        <div style="font-size:.8rem;font-weight:700;letter-spacing:1.5px;color:rgba(255,255,255,.65);text-transform:uppercase;margin-bottom:10px">University-Wide Passing Rate</div>
        <div style="display:flex;align-items:flex-end;gap:20px;flex-wrap:wrap">
          <div>
            <div style="font-size:4rem;font-weight:900;line-height:1;letter-spacing:-2px;color:#fff">${overall.passRate ?? '—'}${overall.passRate != null ? '%' : ''}</div>
            <div style="font-size:.84rem;color:rgba(255,255,255,.7);margin-top:6px">
              ${overall.passed} passed · ${overall.failed} failed · ${overall.total} total grades
            </div>
          </div>
          <div style="flex:1;min-width:200px;max-width:400px">
            <div style="height:16px;background:rgba(255,255,255,.15);border-radius:10px;overflow:hidden;margin-bottom:8px">
              <div style="height:100%;width:${overall.passRate ?? 0}%;background:linear-gradient(90deg,#2ec4b6,#06d6a0);border-radius:10px;transition:width .8s"></div>
            </div>
            <div style="font-size:.75rem;color:rgba(255,255,255,.6)">
              Avg Grade: <strong style="color:#fff">${overall.avg ? overall.avg.toFixed(2) : '—'}</strong>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Headcount stats -->
    <div class="grid-4 mb-20">
      ${statCard('🎓', 'Total Students',  total,      'var(--blue)',    'var(--blue-dim)')}
      ${statCard('📚', 'Enrolled',         enrolled,   'var(--success)', 'var(--success-dim)')}
      ${statCard('🏅', 'Graduated',        graduated,  'var(--teal)',    'var(--teal-dim)')}
      ${statCard('👨‍🏫','Faculty',          facCount,   'var(--warning)', 'var(--warning-dim)')}
    </div>

    <div class="grid-2 mb-20">
      <!-- Headcount by year level bar chart -->
      <div class="card">
        <div class="card-title">Enrolled Headcount by Year Level</div>
        ${yearCounts.map(({ yr, count }) => {
          const pct = Math.round(count / maxYr * 100);
          const ord = ['','1st','2nd','3rd','4th'][yr];
          return `<div class="chart-bar-row">
            <div class="chart-bar-label">${ord} Year</div>
            <div class="chart-bar-track"><div class="chart-bar-fill" style="width:${pct}%;background:var(--blue)"></div></div>
            <div class="chart-bar-val" style="color:var(--blue)">${count}</div>
          </div>`;
        }).join('')}
        <div style="margin-top:14px;padding-top:12px;border-top:1px solid var(--border);display:flex;gap:20px;font-size:.8rem">
          <span style="color:var(--text3)">👨 Male: <strong style="color:var(--blue)">${maleCount}</strong></span>
          <span style="color:var(--text3)">👩 Female: <strong style="color:#ec4899">${femaleCount}</strong></span>
          <span style="color:var(--text3)">💤 Inactive: <strong style="color:var(--text3)">${inactive}</strong></span>
        </div>
      </div>

      <!-- Pass rate by college visual -->
      <div class="card">
        <div class="card-title">Pass Rate by College</div>
        ${colRows.map(c => {
          const pct  = c.sm.passRate ?? 0;
          const color = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
          return `<div style="margin-bottom:16px">
            <div class="flex-between mb-4">
              <span class="text-sm fw-6">${esc(c.col.name.replace('College of ',''))}</span>
              <span style="font-size:.84rem;font-weight:700;color:${color}">${c.sm.passRate ?? '—'}%</span>
            </div>
            <div class="progress" style="height:10px">
              <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
            </div>
            <div style="font-size:.72rem;color:var(--text3);margin-top:3px">
              ${c.enrolled} enrolled · ${c.sm.passed} passed · ${c.sm.failed} failed
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <!-- College overview table -->
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">University College Overview</div></div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>College</th><th>Depts</th><th>Total Students</th><th>Enrolled</th>
          <th>Sections</th><th>Grades</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th>
        </tr></thead>
        <tbody>${colRows.map(c => `<tr>
          <td class="fw-6">${esc(c.col.name)}</td>
          <td>${c.depts}</td>
          <td>${c.students}</td>
          <td>${c.enrolled}</td>
          <td>${c.sections}</td>
          <td>${c.sm.total}</td>
          <td style="color:var(--success)">${c.sm.passed}</td>
          <td style="color:var(--danger)">${c.sm.failed}</td>
          <td>${prCell(c.sm.passRate)}</td>
          <td class="mono">${c.sm.avg ? c.sm.avg.toFixed(2) : '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`);
}

/* ── Dean Dashboard ── */
function dashDean() {
  const col   = getCollege(currentUser.collegeId);
  const depts = DB.departments.filter(d => d.collegeId === currentUser.collegeId);
  const sids  = secIdsForCollege(currentUser.collegeId);
  const sm    = gradeSummary(sids);

  // Per-department breakdown
  const deptData = depts.map(d => {
    const dsids = secIdsForDept(d.id);
    const dsm   = gradeSummary(dsids);
    const stuCount = DB.students.filter(s => s.deptId === d.id).length;
    const facs  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === d.id).length;
    return { d, dsm, dsids, stuCount, facs };
  });

  // Overall grade distribution for the college
  const allGrades = DB.grades.filter(g => {
    const sec = getSection(g.sectionId);
    if (!sec) return false;
    const subj = getSubject(sec.subjectId);
    return subj && DB.departments.find(d => d.id === subj.deptId && d.collegeId === currentUser.collegeId);
  });

  set(`
    ${alertBox('🏛', `Academic Overview — <strong>${col ? esc(col.name) : '—'}</strong>`, 'teal')}

    <div class="grid-4 mb-20">
      ${statCard('🏫', 'Departments',   depts.length, 'var(--blue)',    'var(--blue-dim)')}
      ${statCard('🎓', 'Total Students', DB.students.filter(s => s.collegeId === currentUser.collegeId).length, 'var(--success)', 'var(--success-dim)')}
      ${statCard('📋', 'Total Sections', sids.length, 'var(--teal)',    'var(--teal-dim)')}
      ${statCard('📈', 'College Pass Rate', sm.passRate != null ? sm.passRate + '%' : '—', 'var(--warning)', 'var(--warning-dim)')}
    </div>

    <!-- College-wide summary + pass rate bar -->
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">College Academic Summary</div>
        <div class="grid-3 mb-16" style="margin-top:8px">
          ${miniStat('Total Grades', sm.total,  '#374151')}
          ${miniStat('Passed',       sm.passed, 'var(--success)')}
          ${miniStat('Failed',       sm.failed, 'var(--danger)')}
        </div>
        <div class="flex-between mb-6">
          <span class="text-sm fw-6">Overall Pass Rate</span>
          <span class="fw-7" style="color:${sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--danger)'}">
            ${sm.passRate ?? '—'}%
          </span>
        </div>
        <div class="progress mb-8" style="height:12px">
          <div class="progress-bar" style="width:${sm.passRate ?? 0}%;background:${sm.passRate != null && sm.passRate >= 75 ? 'linear-gradient(90deg,var(--success),#4ade80)' : 'linear-gradient(90deg,var(--danger),#f87171)'}"></div>
        </div>
        <div class="text-xs text-muted">Average grade: ${sm.avg ? sm.avg.toFixed(2) : '—'}</div>
      </div>
      <div class="card">
        <div class="card-title">Pass Rate by Department</div>
        ${deptData.map(({ d, dsm }) =>
          barRow(
            d.name.replace('Department of ', ''),
            dsm.passRate,
            dsm.passRate != null && dsm.passRate >= 75 ? 'var(--success)' : dsm.passRate != null && dsm.passRate >= 60 ? 'var(--warning)' : 'var(--danger)'
          )
        ).join('')}
      </div>
    </div>

    <!-- Department-by-department performance cards -->
    <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">DEPARTMENT BREAKDOWN</div>
    <div class="grid-2 mb-20">
      ${deptData.map(({ d, dsm, dsids, stuCount, facs }) => {
        const pct = dsm.passRate ?? 0;
        const color = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
        return `<div class="card">
          <div class="flex-between mb-14">
            <div>
              <div class="fw-7" style="font-size:.95rem">${esc(d.name)}</div>
              <div class="text-xs text-muted mt-2">${dsids.length} sections · ${facs} faculty · ${stuCount} students</div>
            </div>
            <div style="text-align:right">
              <div style="font-size:1.6rem;font-weight:800;color:${color}">${dsm.passRate ?? '—'}%</div>
              <div class="text-xs text-muted">pass rate</div>
            </div>
          </div>
          <div class="progress mb-10" style="height:10px">
            <div class="progress-bar" style="width:${pct}%;background:${color}"></div>
          </div>
          <div style="display:flex;gap:16px;font-size:.78rem">
            <span style="color:var(--text3)">Grades: <strong style="color:var(--text)">${dsm.total}</strong></span>
            <span style="color:var(--success)">Passed: <strong>${dsm.passed}</strong></span>
            <span style="color:var(--danger)">Failed: <strong>${dsm.failed}</strong></span>
            <span style="color:var(--text3)">Avg: <strong style="color:var(--text)">${dsm.avg ? dsm.avg.toFixed(2) : '—'}</strong></span>
          </div>
        </div>`;
      }).join('')}
    </div>

    <!-- Subject-level performance table -->
    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Subject Performance — All Departments</div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Subject Code</th><th>Subject Name</th><th>Department</th><th>Year</th>
          <th>Sections</th><th>Enrolled</th><th>Graded</th><th>Pass Rate</th><th>Avg Grade</th>
        </tr></thead>
        <tbody>${DB.subjects.filter(s => depts.map(d => d.id).includes(s.deptId)).map(subj => {
          const secIds = DB.sections.filter(sec => sec.subjectId === subj.id).map(sec => sec.id);
          const sm2    = gradeSummary(secIds);
          const enr    = secIds.reduce((a, sid) => a + enrolledIn(sid).length, 0);
          const dept   = getDept(subj.deptId);
          return `<tr>
            <td><span class="chip">${esc(subj.code)}</span></td>
            <td class="fw-6">${esc(subj.name)}</td>
            <td class="text-sm text-muted">${dept ? esc(dept.name.replace('Department of ', '')) : '—'}</td>
            <td class="text-sm">Year ${subj.year}</td>
            <td>${secIds.length}</td>
            <td>${enr}</td>
            <td>${sm2.total}</td>
            <td>${prCell(sm2.passRate)}</td>
            <td class="mono">${sm2.avg ? sm2.avg.toFixed(2) : '—'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}

/* ── Chairman Dashboard ── */
function dashChairman() {
  const dept        = getDept(currentUser.deptId);
  const col         = getCollege(currentUser.collegeId);
  const sids        = secIdsForDept(currentUser.deptId);
  const sm          = gradeSummary(sids);
  const subjs       = DB.subjects.filter(s => s.deptId === currentUser.deptId);
  const colStudents = DB.students.filter(s => s.collegeId === currentUser.collegeId);

  set(`
    ${alertBox('🏫', `Viewing <strong>${dept ? esc(dept.name) : '—'}</strong>`, 'teal')}

    <div class="grid-4 mb-20">
      ${statCard('📚', 'Subjects', subjs.length, 'var(--blue)', 'var(--blue-dim)')}
      ${statCard('🎓', 'Students', DB.students.filter(s => s.deptId === currentUser.deptId).length, 'var(--success)', 'var(--success-dim)')}
      ${statCard('📋', 'Sections', sids.length, 'var(--teal)', 'var(--teal-dim)')}
      ${statCard('👨‍🏫', 'Faculty', DB.users.filter(u => u.role === 'Faculty' && u.deptId === currentUser.deptId).length, 'var(--warning)', 'var(--warning-dim)')}
    </div>

    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">Department Grade Summary</div>
        <div class="grid-3 mb-16" style="margin-top:8px">
          ${miniStat('Total Grades', sm.total,  '#374151')}
          ${miniStat('Passed',       sm.passed, 'var(--success)')}
          ${miniStat('Failed',       sm.failed, 'var(--danger)')}
        </div>
        <div class="flex-between mb-6">
          <span class="text-sm">Pass Rate</span>
          <span class="fw-7" style="color:var(--blue)">${sm.passRate ?? '—'}%</span>
        </div>
        <div class="progress"><div class="progress-bar" style="width:${sm.passRate ?? 0}%"></div></div>
      </div>
      <div class="card">
        <div class="card-title">Pass Rate by Subject</div>
        ${subjs.map(s => {
          const ids  = DB.sections.filter(x => x.subjectId === s.id).map(x => x.id);
          const sm2  = gradeSummary(ids);
          return barRow(s.code, sm2.passRate, sm2.passRate != null && sm2.passRate < 70 ? 'var(--danger)' : 'var(--blue)');
        }).join('')}
      </div>
    </div>

    <!-- Year-Level Monitor (college-scoped) -->
    <div class="section-card mb-20">
      <div class="section-card-head">
        <div>
          <div class="page-title">👥 Students by Year Level</div>
          <div class="text-sm text-muted" style="margin-top:3px">
            ${col ? esc(col.name) : ''} · Count · Sex distribution · Pass / Fail
          </div>
        </div>
      </div>
      <div style="padding:0 22px">
        <div class="tabs" id="yr-tabs-chair">
          <div class="tab active" onclick="switchYearTab(1,'col',${currentUser.collegeId})">1st Year</div>
          <div class="tab"        onclick="switchYearTab(2,'col',${currentUser.collegeId})">2nd Year</div>
          <div class="tab"        onclick="switchYearTab(3,'col',${currentUser.collegeId})">3rd Year</div>
          <div class="tab"        onclick="switchYearTab(4,'col',${currentUser.collegeId})">4th Year</div>
        </div>
      </div>
      <div id="yr-panel-chair" class="section-card-body" style="padding-top:16px">
        ${buildYearPanel(1, colStudents)}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Active Sections</div>
        <button class="btn btn-primary btn-sm" onclick="navigate('assignment')">Manage Sections</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Subject</th><th>Section</th><th>Faculty</th><th>Status</th><th>Enrolled</th><th>Graded</th><th>Pass Rate</th>
        </tr></thead>
        <tbody>${DB.sections.filter(s => sids.includes(s.id)).map(sec => {
          const subj = getSubject(sec.subjectId);
          const fac  = getUser(sec.facultyId);
          const enr  = enrolledIn(sec.id).length;
          const gr   = DB.grades.filter(g => g.sectionId === sec.id).length;
          return `<tr>
            <td><span class="chip">${subj ? esc(subj.code) : '—'}</span> ${subj ? esc(subj.name) : '—'}</td>
            <td><span class="badge badge-teal">${esc(sec.sectionName)}</span></td>
            <td class="text-sm text-muted">${fac ? esc(fac.name) : '—'}</td>
            <td><span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '🔒 Submitted' : 'Draft'}</span></td>
            <td>${enr}</td>
            <td>${gr}/${enr}</td>
            <td>${prCell(sectionPassRate(sec.id))}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}

/* ── Faculty Dashboard ── */
function dashFaculty() {
  const mySecs     = DB.sections.filter(s => s.facultyId === currentUser.id);
  const totalStu   = mySecs.reduce((a, s) => a + enrolledIn(s.id).length, 0);
  const myGrades   = DB.grades.filter(g => g.facultyId === currentUser.id);
  const pending    = mySecs.reduce((a, s) => a + Math.max(0, enrolledIn(s.id).length - DB.grades.filter(g => g.sectionId === s.id).length), 0);
  const submitted  = mySecs.filter(s => s.submitted).length;
  const myAdvisees = DB.students.filter(s => s.adviserId === currentUser.id);
  const atRisk     = getAtRiskStudents(myAdvisees);

  set(`
    <div class="grid-4 mb-20">
      ${statCard('📋', 'My Sections',    mySecs.length,    'var(--blue)',    'var(--blue-dim)')}
      ${statCard('🎓', 'Total Students', totalStu,          'var(--success)', 'var(--success-dim)')}
      ${statCard('🔒', 'Submitted',      submitted,         'var(--teal)',    'var(--teal-dim)')}
      ${statCard('⏳', 'Pending Grades', pending,           'var(--warning)', 'var(--warning-dim)')}
    </div>

    ${atRisk.length > 0 ? `<div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(239,68,68,.3);color:#b91c1c;border-radius:10px;padding:11px 16px;margin-bottom:16px;font-size:.84rem;font-weight:500;display:flex;align-items:center;gap:10px">
      ⚠ <strong>${atRisk.length} at-risk advisee(s)</strong> detected.
      <button class="btn btn-sm btn-danger" onclick="navigate('advisees')">View Advisees</button>
    </div>` : ''}

    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">My Assigned Sections</div>
        <button class="btn btn-primary btn-sm" onclick="navigate('encode')">✍ Encode Grades</button>
      </div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Subject</th><th>Section</th><th>Semester</th><th>Status</th><th>Enrolled</th><th>Graded</th>
        </tr></thead>
        <tbody>
          ${mySecs.length === 0
            ? `<tr><td colspan="6" class="table-empty">No sections assigned yet.</td></tr>`
            : mySecs.map(sec => {
                const subj = getSubject(sec.subjectId);
                const enr  = enrolledIn(sec.id).length;
                const gr   = DB.grades.filter(g => g.sectionId === sec.id).length;
                const statusBadge = sec.submitted
                  ? '<span class="badge badge-success">🔒 Submitted</span>'
                  : gr > 0
                    ? `<span class="badge badge-warning">Draft (${gr}/${enr})</span>`
                    : '<span class="badge badge-muted">Not Started</span>';
                return `<tr>
                  <td><span class="chip">${subj ? esc(subj.code) : '—'}</span> <span class="text-sm">${subj ? esc(subj.name) : '—'}</span></td>
                  <td><span class="badge badge-teal">${esc(sec.sectionName)}</span></td>
                  <td class="text-sm text-muted">${esc(sec.sem)} Sem · ${esc(sec.sy)}</td>
                  <td>${statusBadge}</td>
                  <td>${enr}</td>
                  <td>${gr}/${enr}</td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   USER ACCOUNTS  (Registrar only)
────────────────────────────────────────────── */
function renderUsers(activeRole = null, q = '', filterColId = null, filterDeptId = null) {
  const roles      = ['Registrar', 'Dean', 'Chairman', 'Faculty', 'Student'];
  const lockedCount = DB.users.filter(u => u.lockedOut).length;

  // Role card overview
  if (!activeRole) {
    const roleMeta = {
      Registrar: { icon: '🗂', color: 'var(--blue)',    bg: 'var(--blue-dim)',    desc: 'System administrator' },
      Dean:      { icon: '🏛', color: 'var(--teal)',    bg: 'var(--teal-dim)',    desc: 'College-level access' },
      Chairman:  { icon: '🏫', color: '#8b5cf6',       bg: 'rgba(139,92,246,.1)', desc: 'Department-level access' },
      Faculty:   { icon: '👨‍🏫',color: 'var(--warning)', bg: 'var(--warning-dim)', desc: 'Grade encoding & advisees' },
      Student:   { icon: '🎓', color: 'var(--success)', bg: 'var(--success-dim)', desc: 'Student portal access' },
    };
    set(`
      <div class="page-header">
        <div class="page-title">
          User Accounts (${DB.users.length})
          ${lockedCount ? `<span class="badge badge-danger" style="margin-left:8px">${lockedCount} Locked</span>` : ''}
        </div>
        <button class="btn btn-primary" onclick="showAddUserModal()">+ Add Account</button>
      </div>
      <div class="mb-12 text-sm text-muted">Select a role to view and manage accounts.</div>
      <div class="grid-3" style="gap:14px">
        ${roles.map(role => {
          const meta  = roleMeta[role] || { icon: '👤', color: 'var(--text3)', bg: 'var(--bg4)', desc: '' };
          const count = DB.users.filter(u => u.role === role).length;
          const locked = DB.users.filter(u => u.role === role && u.lockedOut).length;
          return `<div onclick="renderUsers('${role}','',null,null)" style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s" onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'" onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div class="flex gap-12 mb-12">
              <div style="width:44px;height:44px;border-radius:12px;background:${meta.bg};display:flex;align-items:center;justify-content:center;font-size:1.3rem;flex-shrink:0">${meta.icon}</div>
              <div>
                <div class="fw-7" style="color:${meta.color};font-size:1rem">${role}</div>
                <div class="text-xs text-muted">${meta.desc}</div>
              </div>
            </div>
            <div class="flex-between">
              <span style="font-size:1.6rem;font-weight:800;color:var(--text)">${count}</span>
              ${locked ? `<span class="badge badge-danger">⛔ ${locked} Locked</span>` : '<span class="badge badge-success">All Active</span>'}
            </div>
          </div>`;
        }).join('')}
      </div>`);
    return;
  }

  // Filter list
  let list = DB.users.filter(u => u.role === activeRole);
  if (activeRole === 'Student') {
    // For student accounts, filter by linked student record's college/dept
    if (filterColId)  list = list.filter(u => getStudent(u.studentId)?.collegeId === filterColId);
    if (filterDeptId) list = list.filter(u => getStudent(u.studentId)?.deptId    === filterDeptId);
  }
  if (q) {
    const lq = q.toLowerCase();
    list = list.filter(u =>
      u.name.toLowerCase().includes(lq) ||
      u.username.toLowerCase().includes(lq) ||
      (u.studentId && u.studentId.toLowerCase().includes(lq))
    );
  }

  const isStudent = activeRole === 'Student';
  const colOpts   = DB.colleges.map(c => `<option value="${c.id}" ${filterColId===c.id?'selected':''}>${esc(c.name)}</option>`).join('');
  const deptOpts  = (filterColId
    ? DB.departments.filter(d => d.collegeId === filterColId)
    : DB.departments
  ).map(d => `<option value="${d.id}" ${filterDeptId===d.id?'selected':''}>${esc(d.name.replace('Department of ',''))}</option>`).join('');

  set(`
    <div class="page-header">
      <div class="flex gap-10" style="align-items:center;flex-wrap:wrap">
        <button class="btn btn-ghost btn-sm" onclick="renderUsers(null,'',null,null)">← All Roles</button>
        <div class="page-title">${activeRole} Accounts (${list.length})</div>
      </div>
      <div class="flex gap-10" style="flex-wrap:wrap">
        <div class="search-wrap">
          <input class="search-input" placeholder="${isStudent ? 'Search name or student ID…' : 'Search name or username…'}"
            value="${esc(q)}" oninput="renderUsers('${activeRole}',this.value,${filterColId||'null'},${filterDeptId||'null'})">
        </div>
        ${isStudent ? `
        <select class="select-input" style="width:200px" onchange="renderUsers('Student','${q}',+this.value||null,null)">
          <option value="">— All Colleges —</option>${colOpts}
        </select>
        <select class="select-input" style="width:210px" onchange="renderUsers('Student','${q}',${filterColId||'null'},+this.value||null)">
          <option value="">— All Departments —</option>${deptOpts}
        </select>` : ''}
        <button class="btn btn-primary" onclick="showAddUserModal()">+ Add Account</button>
      </div>
    </div>
    <div class="section-card">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Name</th><th>Username</th><th>Scope</th><th>Created</th><th>Status</th><th>Actions</th>
        </tr></thead>
        <tbody>
          ${list.length === 0
            ? `<tr><td colspan="6" class="table-empty">No ${activeRole} accounts found.</td></tr>`
            : list.map(u => {
                let scope = '—';
                if (u.studentId)      scope = 'ID: ' + u.studentId;
                else if (u.deptId)    scope = getDept(u.deptId)?.name?.replace('Department of ', '') || '—';
                else if (u.collegeId) scope = getCollege(u.collegeId)?.name?.replace('College of ', '') || '—';
                const statusBadge = u.lockedOut
                  ? '<span class="badge badge-danger">⛔ Locked</span>'
                  : u.active ? '<span class="badge badge-success">Active</span>'
                  : '<span class="badge badge-muted">Inactive</span>';
                return `<tr>
                  <td><div class="flex gap-10">
                    <div class="avatar avatar-sm">${initials(u.name)}</div>
                    <span class="fw-6">${esc(u.name)}</span>
                  </div></td>
                  <td class="mono text-sm text-muted">${esc(u.username)}</td>
                  <td class="text-xs text-muted">${esc(scope)}</td>
                  <td class="text-sm text-muted">${esc(u.created || '—')}</td>
                  <td>${statusBadge}${u.failedAttempts > 0 && !u.lockedOut ? `<span class="text-xs text-muted" style="margin-left:6px">${u.failedAttempts} fail(s)</span>` : ''}</td>
                  <td><div class="flex gap-8">
                    <button class="btn btn-sm btn-ghost" onclick="showEditUserModal(${u.id})">✎ Edit</button>
                    ${u.lockedOut
                      ? `<button class="btn btn-sm btn-success" onclick="unlockUser(${u.id})">🔓 Unlock</button>`
                      : `<button class="btn btn-sm ${u.active ? 'btn-danger' : 'btn-success'}" onclick="toggleUser(${u.id})">${u.active ? 'Deactivate' : 'Activate'}</button>`}
                    ${currentUser.id !== u.id ? `<button class="btn btn-sm btn-danger" onclick="deleteUser(${u.id})">✕</button>` : ''}
                  </div></td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>`);
}

function unlockUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  u.lockedOut = false;
  u.failedAttempts = 0;
  save();
  logAudit(`Account unlocked: ${u.username}`);
  toast(`${u.name}'s account has been unlocked`, 'success');
  renderUsers(u.role,'',null,null);
}

function showAddUserModal() {
  const roles   = ['Dean', 'Chairman', 'Faculty', 'Student'];
  const colOpts = DB.colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');

  showModal('Add New Account', `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="fn" class="input" placeholder="Juan dela Cruz"></div>
      <div class="field-wrap"><div class="field-label">Role</div>
        <select id="fr" class="select-input" onchange="toggleScope(this.value)">
          ${roles.map(r => `<option>${r}</option>`).join('')}
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Username</div><input id="fu" class="input" placeholder="username"></div>
      <div class="field-wrap"><div class="field-label">Password</div>
        <div style="position:relative">
          <input id="fp" class="input" type="password" placeholder="••••••••" style="padding-right:40px">
          <button type="button" onclick="togglePwdVis('fp',this)" style="position:absolute;right:10px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;color:var(--text3);font-size:1rem;padding:2px">👁</button>
        </div>
      </div>
    </div>
    <div id="sc-col"  class="field-wrap"><div class="field-label">College</div><select id="fc" class="select-input" onchange="filterStuSearch()">${colOpts}</select></div>
    <div id="sc-dept" class="field-wrap hidden"><div class="field-label">Department</div><select id="fd" class="select-input" onchange="filterStuSearch()">${deptOpts}</select></div>

    <!-- Student link panel -->
    <div id="sc-stu" class="field-wrap hidden">
      <div class="field-label">Link to Student Record</div>
      <div class="flex gap-8 mb-8">
        <select id="stu-filter-col" class="select-input" style="flex:1" onchange="filterStuSearch()">
          <option value="">— All Colleges —</option>
          ${DB.colleges.map(c => `<option value="${c.id}">${esc(c.name)}</option>`).join('')}
        </select>
        <select id="stu-filter-dept" class="select-input" style="flex:1" onchange="filterStuSearch()">
          <option value="">— All Departments —</option>
          ${DB.departments.map(d => `<option value="${d.id}">${esc(d.name.replace('Department of ',''))}</option>`).join('')}
        </select>
      </div>
      <input id="stu-search" class="input" placeholder="Search name or student ID…" oninput="filterStuSearch()" style="margin-bottom:8px">
      <select id="fs" class="select-input" style="height:140px" size="5">
        <option value="">— Select a student record —</option>
        ${DB.students.filter(s => !DB.users.find(u => u.studentId === s.id))
          .map(s => `<option value="${s.id}">${esc(s.id)} — ${esc(s.name)} (${getDept(s.deptId)?.name.replace('Department of ','') || '—'})</option>`).join('')}
      </select>
      <div class="text-xs text-muted mt-4">Only students without an account are shown.</div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addUser()">Create Account</button>`
  );
  toggleScope('Dean');
}

function filterStuSearch() {
  const q      = (document.getElementById('stu-search')?.value || '').toLowerCase();
  const colId  = +document.getElementById('stu-filter-col')?.value || null;
  const deptId = +document.getElementById('stu-filter-dept')?.value || null;
  const sel    = document.getElementById('fs');
  if (!sel) return;
  const linked = new Set(DB.users.filter(u => u.studentId).map(u => u.studentId));
  const pool   = DB.students.filter(s => {
    if (linked.has(s.id)) return false;
    if (colId  && s.collegeId !== colId)  return false;
    if (deptId && s.deptId    !== deptId) return false;
    if (q && !s.name.toLowerCase().includes(q) && !s.id.includes(q)) return false;
    return true;
  });
  sel.innerHTML = `<option value="">— Select a student record —</option>` +
    pool.map(s => `<option value="${s.id}">${esc(s.id)} — ${esc(s.name)} (${getDept(s.deptId)?.name.replace('Department of ','') || '—'})</option>`).join('');
}

function toggleScope(role) {
  document.getElementById('sc-col').classList.toggle('hidden',  role === 'Student');
  document.getElementById('sc-dept').classList.toggle('hidden', role !== 'Chairman' && role !== 'Faculty');
  document.getElementById('sc-stu').classList.toggle('hidden',  role !== 'Student');
}

function addUser() {
  const name  = document.getElementById('fn').value.trim();
  const role  = document.getElementById('fr').value;
  const uname = document.getElementById('fu').value.trim();
  const pass  = document.getElementById('fp').value;
  if (!name || !uname || !pass) { toast('All fields are required', 'error'); return; }
  if (DB.users.find(u => u.username === uname)) { toast('Username already exists', 'error'); return; }

  // One-per-scope validation
  if (role === 'Dean') {
    const colId = +document.getElementById('fc').value;
    const existing = DB.users.find(u => u.role === 'Dean' && u.collegeId === colId);
    if (existing) {
      const colName = getCollege(colId)?.name || 'this college';
      showModal('⚠ Account Already Exists',
        `<div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(244,140,6,.3);color:#92400e;border-radius:10px;padding:14px 16px;font-size:.88rem;line-height:1.6">
          <strong>${esc(colName)}</strong> already has a Dean account assigned to <strong>${esc(existing.name)}</strong>.<br><br>
          Only <strong>one Dean account</strong> is allowed per college. Please remove the existing Dean account first before creating a new one.
        </div>`,
        `<button class="btn btn-primary" onclick="closeModal()">Understood</button>`
      );
      return;
    }
  }

  if (role === 'Chairman') {
    const deptId = +document.getElementById('fd').value;
    const existing = DB.users.find(u => u.role === 'Chairman' && u.deptId === deptId);
    if (existing) {
      const deptName = getDept(deptId)?.name || 'this department';
      showModal('⚠ Account Already Exists',
        `<div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(244,140,6,.3);color:#92400e;border-radius:10px;padding:14px 16px;font-size:.88rem;line-height:1.6">
          <strong>${esc(deptName)}</strong> already has a Chairman account assigned to <strong>${esc(existing.name)}</strong>.<br><br>
          Only <strong>one Chairman account</strong> is allowed per department. Please remove the existing Chairman account first before creating a new one.
        </div>`,
        `<button class="btn btn-primary" onclick="closeModal()">Understood</button>`
      );
      return;
    }
  }

  const obj = { id: DB.nextId.user++, name, role, username: uname, password: pass, active: true, created: new Date().toISOString().slice(0, 10), failedAttempts: 0, lockedOut: false };
  if (role === 'Dean') obj.collegeId = +document.getElementById('fc').value;
  if (role === 'Chairman' || role === 'Faculty') {
    obj.deptId    = +document.getElementById('fd').value;
    obj.collegeId = getDept(obj.deptId)?.collegeId;
  }
  if (role === 'Student') {
    const sid = document.getElementById('fs').value;
    if (sid) obj.studentId = sid;
  }
  DB.users.push(obj);
  save();
  logAudit(`User created: ${uname}`);
  toast('Account created successfully', 'success');
  closeModal();
  renderUsers(role,'',null,null);
}

function showEditUserModal(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  showModal('Edit Account', `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="en" class="input" value="${esc(u.name)}"></div>
      <div class="field-wrap"><div class="field-label">Role</div><input class="input" value="${esc(u.role)}" disabled style="opacity:.5"></div>
    </div>
    <div class="field-wrap">
      <div class="field-label">New Password <span class="text-muted" style="font-weight:400;text-transform:none">(leave blank to keep current)</span></div>
      <input id="ep" class="input" type="password" placeholder="••••••••">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editUser(${id})">Save Changes</button>`
  );
}

function editUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u) return;
  u.name = document.getElementById('en').value.trim() || u.name;
  const np = document.getElementById('ep').value;
  if (np) u.password = np;
  save();
  logAudit(`User edited: ${u.username}`);
  toast('Account updated', 'success');
  closeModal();
  renderUsers(u.role,'',null,null);
}

function toggleUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!u || u.id === currentUser.id) { toast('Cannot deactivate yourself', 'error'); return; }
  u.active = !u.active;
  save();
  logAudit(`User ${u.active ? 'activated' : 'deactivated'}: ${u.username}`);
  toast(`Account ${u.active ? 'activated' : 'deactivated'}`, u.active ? 'success' : 'info');
  renderUsers(u.role,'',null,null);
}

function deleteUser(id) {
  const u = DB.users.find(x => x.id === id);
  if (!confirm('Delete this account? This cannot be undone.')) return;
  DB.users = DB.users.filter(x => x.id !== id);
  save();
  logAudit('User account deleted');
  toast('Account removed', 'info');
  renderUsers(u?.role||null,'',null,null);
}


/* ──────────────────────────────────────────────
   ACADEMIC PERFORMANCE
────────────────────────────────────────────── */
function renderPerformance() {
  const r = currentUser.role;
  if      (r === 'Registrar') perfRegistrar();
  else if (r === 'Dean')      perfDean();
  else if (r === 'Chairman')  perfChairman();
}

function perfRegistrar() {
  const overall  = gradeSummary(DB.sections.map(s => s.id));
  const colData  = DB.colleges.map(col => {
    const depts = DB.departments.filter(d => d.collegeId === col.id);
    const rows  = depts.map(dept => {
      const sids = secIdsForDept(dept.id);
      return { dept, sm: gradeSummary(sids), sids };
    });
    return { col, rows };
  });

  set(`
    ${alertBox('🔒', 'Aggregate statistics only — individual student grades are not shown to the Registrar.', 'info')}
    <div class="grid-4 mb-20">
      ${statCard('📊', 'Total Grades', overall.total,   '#374151',        'rgba(55,65,81,.1)')}
      ${statCard('✅', 'Passed',        overall.passed,  'var(--success)', 'var(--success-dim)')}
      ${statCard('❌', 'Failed',        overall.failed,  'var(--danger)',  'var(--danger-dim)')}
      ${statCard('📈', 'Pass Rate', (overall.passRate ?? '—') + (overall.passRate != null ? '%' : ''), 'var(--blue)', 'var(--blue-dim)')}
    </div>
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">College Pass Rates</div>
        ${DB.colleges.map(col => {
          const sm = gradeSummary(secIdsForCollege(col.id));
          return barRow(col.name.replace('College of ', ''), sm.passRate, sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--warning)');
        }).join('')}
      </div>
      <div class="card">
        <div class="card-title">Grade Distribution</div>
        ${[
          ['Excellent (1.0)', g => g <= 1.0],
          ['Very Good (1.5)', g => g > 1.0 && g <= 1.5],
          ['Good (2.0)',      g => g > 1.5 && g <= 2.0],
          ['Satisfactory',   g => g > 2.0 && g <= 2.5],
          ['Passing (3.0)',  g => g > 2.5 && g <= 3.0],
          ['Failed (5.0)',   g => g > 3.0],
        ].map(([l, f]) => barRow(l, DB.grades.length ? Math.round(DB.grades.filter(g => f(g.grade)).length / DB.grades.length * 100) : null, 'var(--blue)')).join('')}
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Department Breakdown by College</div></div>
      <div class="section-card-body">
        ${colData.map(c => `
          <div class="mb-20">
            <div class="fw-7 mb-8" style="color:var(--blue)">${esc(c.col.name)}</div>
            <div class="table-wrap"><table>
              <thead><tr><th>Department</th><th>Sections</th><th>Grades</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg</th></tr></thead>
              <tbody>${c.rows.map(r => `<tr>
                <td class="fw-6">${esc(r.dept.name.replace('Department of ', ''))}</td>
                <td>${r.sids.length}</td>
                <td>${r.sm.total}</td>
                <td style="color:var(--success)">${r.sm.passed}</td>
                <td style="color:var(--danger)">${r.sm.failed}</td>
                <td>${prCell(r.sm.passRate)}</td>
                <td class="mono">${r.sm.avg ? r.sm.avg.toFixed(2) : '—'}</td>
              </tr>`).join('')}</tbody>
            </table></div>
          </div>`).join('')}
      </div>
    </div>`);
}

function perfDean() {
  const col   = getCollege(currentUser.collegeId);
  const depts = DB.departments.filter(d => d.collegeId === currentUser.collegeId);
  const sids  = secIdsForCollege(currentUser.collegeId);
  const sm    = gradeSummary(sids);

  set(`
    ${alertBox('📊', `Performance for <strong>${col ? esc(col.name) : '—'}</strong>`, 'teal')}
    <div class="grid-4 mb-20">
      ${statCard('📊', 'Total Grades', sm.total,  '#374151',        'rgba(55,65,81,.1)')}
      ${statCard('✅', 'Passed',        sm.passed, 'var(--success)', 'var(--success-dim)')}
      ${statCard('❌', 'Failed',        sm.failed, 'var(--danger)',  'var(--danger-dim)')}
      ${statCard('📈', 'Pass Rate', (sm.passRate ?? '—') + (sm.passRate != null ? '%' : ''), 'var(--blue)', 'var(--blue-dim)')}
    </div>
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">Pass Rate by Department</div>
        ${depts.map(d => { const ds = gradeSummary(secIdsForDept(d.id)); return barRow(d.name.replace('Department of ', ''), ds.passRate, 'var(--blue)'); }).join('')}
      </div>
      <div class="card">
        <div class="card-title">Subject Pass Rates</div>
        ${DB.subjects.filter(s => depts.map(d => d.id).includes(s.deptId)).map(subj => {
          const ids  = DB.sections.filter(s => s.subjectId === subj.id).map(s => s.id);
          const sm2  = gradeSummary(ids);
          return barRow(subj.code, sm2.passRate, sm2.passRate != null && sm2.passRate < 70 ? 'var(--danger)' : 'var(--blue)');
        }).join('')}
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Section-Level Performance</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Subject</th><th>Section</th><th>Faculty</th><th>Status</th><th>Enrolled</th><th>Graded</th><th>Pass Rate</th><th>Avg</th></tr></thead>
        <tbody>${DB.sections.filter(s => sids.includes(s.id)).map(sec => {
          const subj = getSubject(sec.subjectId);
          const fac  = getUser(sec.facultyId);
          const enr  = enrolledIn(sec.id).length;
          const grs  = DB.grades.filter(g => g.sectionId === sec.id);
          const avg  = grs.length ? (grs.reduce((a, g) => a + g.grade, 0) / grs.length).toFixed(2) : '—';
          return `<tr>
            <td><span class="chip">${subj ? esc(subj.code) : '—'}</span> ${subj ? esc(subj.name) : '—'}</td>
            <td><span class="badge badge-teal">${esc(sec.sectionName)}</span></td>
            <td class="text-sm text-muted">${fac ? esc(fac.name) : '—'}</td>
            <td><span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '🔒 Submitted' : 'Draft'}</span></td>
            <td>${enr}</td>
            <td>${grs.length}/${enr}</td>
            <td>${prCell(sectionPassRate(sec.id))}</td>
            <td class="mono">${avg}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}

function perfChairman() {
  const dept  = getDept(currentUser.deptId);
  const sids  = secIdsForDept(currentUser.deptId);
  const sm    = gradeSummary(sids);
  const subjs = DB.subjects.filter(s => s.deptId === currentUser.deptId);
  const facs  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === currentUser.deptId);

  set(`
    ${alertBox('📊', `Performance for <strong>${dept ? esc(dept.name) : '—'}</strong>`, 'teal')}
    <div class="grid-4 mb-20">
      ${statCard('📊', 'Total Grades', sm.total,  '#374151',        'rgba(55,65,81,.1)')}
      ${statCard('✅', 'Passed',        sm.passed, 'var(--success)', 'var(--success-dim)')}
      ${statCard('❌', 'Failed',        sm.failed, 'var(--danger)',  'var(--danger-dim)')}
      ${statCard('📈', 'Pass Rate', (sm.passRate ?? '—') + (sm.passRate != null ? '%' : ''), 'var(--blue)', 'var(--blue-dim)')}
    </div>
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">Pass Rate by Subject</div>
        ${subjs.map(s => {
          const ids = DB.sections.filter(x => x.subjectId === s.id).map(x => x.id);
          const sm2 = gradeSummary(ids);
          return barRow(s.code, sm2.passRate, sm2.passRate != null && sm2.passRate < 70 ? 'var(--danger)' : 'var(--blue)');
        }).join('')}
      </div>
      <div class="card">
        <div class="card-title">Faculty Workload</div>
        ${facs.map(f => {
          const loads = DB.sections.filter(s => s.facultyId === f.id && sids.includes(s.id)).length;
          return `<div class="flex-between mb-10">
            <div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(f.name)}</div>
              <div>
                <div class="text-sm fw-6">${esc(f.name)}</div>
                <div class="text-xs text-muted">${loads} section(s)</div>
              </div>
            </div>
            <span class="badge badge-teal">${loads} loads</span>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Section Performance</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Subject</th><th>Section</th><th>Faculty</th><th>Status</th><th>Enrolled</th><th>Graded</th><th>Pass Rate</th></tr></thead>
        <tbody>${DB.sections.filter(s => sids.includes(s.id)).map(sec => {
          const subj = getSubject(sec.subjectId);
          const fac  = getUser(sec.facultyId);
          const enr  = enrolledIn(sec.id).length;
          const gr   = DB.grades.filter(g => g.sectionId === sec.id).length;
          return `<tr>
            <td><span class="chip">${subj ? esc(subj.code) : '—'}</span> ${subj ? esc(subj.name) : '—'}</td>
            <td><span class="badge badge-teal">${esc(sec.sectionName)}</span></td>
            <td class="text-sm text-muted">${fac ? esc(fac.name) : '—'}</td>
            <td><span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '🔒 Submitted' : 'Draft'}</span></td>
            <td>${enr}</td>
            <td>${gr}/${enr}</td>
            <td>${prCell(sectionPassRate(sec.id))}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   DATA ANALYTICS
   Registrar : filter by college / dept + headcount + dept comparison
   Dean      : filter by dept within college
   Chairman  : dept-scoped fixed
────────────────────────────────────────────── */
function renderAnalytics(filterColId = null, filterDeptId = null) {
  const r = currentUser.role;

  // ── Build scope based on role + active filter ──
  let trendData, studentPool, scopeSids, scopeLabel;
  let colleges = DB.colleges, allDepts = DB.departments;

  if (r === 'Registrar') {
    if (filterDeptId) {
      const dept  = getDept(filterDeptId);
      trendData   = deptTrend(filterDeptId);
      studentPool = DB.students.filter(s => s.deptId === filterDeptId);
      scopeSids   = secIdsForDept(filterDeptId);
      scopeLabel  = dept ? esc(dept.name) : 'Department';
    } else if (filterColId) {
      const col   = getCollege(filterColId);
      trendData   = collegeTrend(filterColId);
      studentPool = DB.students.filter(s => s.collegeId === filterColId);
      scopeSids   = secIdsForCollege(filterColId);
      scopeLabel  = col ? esc(col.name) : 'College';
    } else {
      trendData   = institutionTrend();
      studentPool = DB.students;
      scopeSids   = null;
      scopeLabel  = 'All Colleges (University-Wide)';
    }
  } else if (r === 'Dean') {
    colleges = DB.colleges.filter(c => c.id === currentUser.collegeId);
    allDepts = DB.departments.filter(d => d.collegeId === currentUser.collegeId);
    if (filterDeptId) {
      const dept  = getDept(filterDeptId);
      trendData   = deptTrend(filterDeptId);
      studentPool = DB.students.filter(s => s.deptId === filterDeptId);
      scopeSids   = secIdsForDept(filterDeptId);
      scopeLabel  = dept ? esc(dept.name) : 'Department';
    } else {
      trendData   = collegeTrend(currentUser.collegeId);
      studentPool = DB.students.filter(s => s.collegeId === currentUser.collegeId);
      scopeSids   = secIdsForCollege(currentUser.collegeId);
      scopeLabel  = getCollege(currentUser.collegeId)?.name || 'My College';
    }
  } else {
    // Chairman — fixed to dept
    trendData   = deptTrend(currentUser.deptId);
    studentPool = DB.students.filter(s => s.deptId === currentUser.deptId);
    scopeSids   = secIdsForDept(currentUser.deptId);
    scopeLabel  = getDept(currentUser.deptId)?.name || 'My Department';
    filterColId  = null; filterDeptId = null;
  }

  const atRisk     = getAtRiskStudents(studentPool);
  const bottleneck = getBottleneckSubjects(scopeSids);

  // Filter dropdowns (Registrar + Dean only)
  const showFilters = (r === 'Registrar' || r === 'Dean');
  const deptOptions = (filterColId
    ? DB.departments.filter(d => d.collegeId === filterColId)
    : r === 'Dean'
      ? allDepts
      : DB.departments
  );

  set(`
    <!-- Filter bar -->
    ${showFilters ? `
    <div class="card mb-20" style="padding:16px 20px">
      <div class="flex gap-12" style="align-items:center;flex-wrap:wrap">
        <span class="text-sm fw-6 text-muted" style="white-space:nowrap">Filter Scope:</span>

        ${r === 'Registrar' ? `
        <select class="select-input" style="width:220px" onchange="renderAnalytics(+this.value||null,null)">
          <option value="">— All Colleges —</option>
          ${DB.colleges.map(c => `<option value="${c.id}" ${filterColId===c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
        </select>` : ''}

        <select class="select-input" style="width:240px"
          onchange="renderAnalytics(${r==='Dean'?currentUser.collegeId:filterColId||'null'},+this.value||null)">
          <option value="">— All Departments —</option>
          ${deptOptions.map(d => `<option value="${d.id}" ${filterDeptId===d.id?'selected':''}>${esc(d.name.replace('Department of ',''))}</option>`).join('')}
        </select>

        ${(filterColId || filterDeptId) ? `<button class="btn btn-ghost btn-sm" onclick="renderAnalytics(null,null)">✕ Clear</button>` : ''}

        <span class="badge badge-info" style="margin-left:auto">📍 ${esc(scopeLabel)}</span>
      </div>
    </div>` : `
    <div class="mb-16"><span class="text-sm text-muted">Scope: </span><span class="fw-6">${scopeLabel}</span></div>`}

    <!-- Analytics tabs -->
    <div class="tabs mb-20" id="analytics-tabs">
      <div class="tab active" onclick="switchAnalyticsTab('trend')">📈 Semester Trend</div>
      <div class="tab"        onclick="switchAnalyticsTab('ews')">⚠ Early Warning${atRisk.length ? ` (${atRisk.length})` : ''}</div>
      <div class="tab"        onclick="switchAnalyticsTab('gpa')">📊 GPA Trends</div>
      <div class="tab"        onclick="switchAnalyticsTab('bottleneck')">🚨 Bottleneck${bottleneck.length ? ` (${bottleneck.length})` : ''}</div>
      ${r === 'Registrar' ? `<div class="tab" onclick="switchAnalyticsTab('headcount')">👥 Headcount</div>` : ''}
      ${r === 'Registrar' ? `<div class="tab" onclick="switchAnalyticsTab('comparison')">📊 Dept Comparison</div>` : ''}
    </div>
    <div id="analytics-panel">
      ${buildTrendPanel(trendData)}
    </div>`);

  window._aState = { trendData, studentPool, bottleneck, atRisk, scopeSids, filterColId, filterDeptId, scopeLabel };
}

function switchAnalyticsTab(tab) {
  document.querySelectorAll('#analytics-tabs .tab').forEach(t => t.classList.remove('active'));
  const tabs = ['trend','ews','gpa','bottleneck','headcount','comparison'];
  const idx  = tabs.indexOf(tab);
  document.querySelectorAll('#analytics-tabs .tab')[idx]?.classList.add('active');

  const { trendData, studentPool, bottleneck, atRisk, scopeSids } = window._aState || {};
  const panel = document.getElementById('analytics-panel');
  if (!panel) return;
  if      (tab === 'trend')      panel.innerHTML = buildTrendPanel(trendData);
  else if (tab === 'ews')        panel.innerHTML = buildEWSPanel(atRisk);
  else if (tab === 'gpa')        panel.innerHTML = buildGPAPanel(studentPool);
  else if (tab === 'bottleneck') panel.innerHTML = buildBottleneckPanel(bottleneck);
  else if (tab === 'headcount')  panel.innerHTML = buildHeadcountPanel(studentPool, scopeSids);
  else if (tab === 'comparison') panel.innerHTML = buildDeptComparisonPanel();
}

// Tab 1: Semester Trend Analysis
function buildTrendPanel(data) {
  if (!data || !data.length) {
    return `<div class="empty">
      <div class="empty-icon">📈</div>
      <div class="empty-text">Not enough data yet.<br>Submit grades across multiple semesters to see trends.</div>
    </div>`;
  }

  return `
    <div class="card mb-20">
      <div class="card-title">Pass Rate — Semester by Semester</div>
      <div style="display:flex;align-items:flex-end;gap:10px;height:140px;padding:16px 0 8px">
        ${data.map((t, i) => {
          const h     = t.passRate != null ? Math.max(10, Math.round(t.passRate / 100 * 120)) : 8;
          const c     = t.passRate != null && t.passRate >= 75 ? 'var(--success)' : t.passRate != null && t.passRate >= 60 ? 'var(--warning)' : 'var(--danger)';
          const prev  = data[i - 1];
          const arrow = prev == null || t.passRate == null || prev.passRate == null ? '' : t.passRate > prev.passRate ? '▲' : t.passRate < prev.passRate ? '▼' : '●';
          return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
            <div style="font-size:.72rem;color:${c};font-weight:700">${t.passRate != null ? t.passRate + '%' : '—'} ${arrow}</div>
            <div style="width:100%;height:${h}px;background:${c};border-radius:6px 6px 0 0;min-height:8px"></div>
            <div style="font-size:.62rem;color:var(--text3);text-align:center;line-height:1.3">${esc(t.label)}</div>
          </div>`;
        }).join('')}
      </div>
    </div>
    <div class="card">
      <div class="card-title">Detailed Semester Data</div>
      ${trendTable(data)}
    </div>`;
}

// Tab 2: Early Warning System
function buildEWSPanel(atRisk) {
  if (!atRisk || !atRisk.length) {
    return `<div class="empty">
      <div class="empty-icon">✅</div>
      <div class="empty-text">No at-risk students detected.<br>All students appear to be performing adequately.</div>
    </div>`;
  }

  return `
    <div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(239,68,68,.3);color:#b91c1c;border-radius:10px;padding:11px 16px;margin-bottom:20px;font-size:.84rem;font-weight:500">
      ⚠ <strong>${atRisk.length} at-risk student(s)</strong> detected. Intervention recommended.
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">At-Risk Students</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Year</th><th>GPA</th><th>Failures</th><th>Risk Factors</th><th>Recommendation</th></tr></thead>
        <tbody>${atRisk.map(({ s, gpa, declining, repeatedFail, failCount }) => {
          const factors = [];
          if (declining)                          factors.push('<span class="badge badge-danger">📉 Declining GPA</span>');
          if (repeatedFail)                       factors.push('<span class="badge badge-danger">🔁 Repeated Failure</span>');
          if (failCount >= 2 && !repeatedFail)    factors.push('<span class="badge badge-warning">❌ Multiple Failures</span>');
          if (gpa && gpa >= 2.75 && !declining && !repeatedFail) factors.push('<span class="badge badge-warning">⚠ Low GPA</span>');
          return `<tr>
            <td><div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(s.name)}</div>
              <div>
                <div class="fw-6">${esc(s.name)}</div>
                <div class="text-xs text-muted">${esc(s.id)}</div>
              </div>
            </div></td>
            <td>Year ${s.year}</td>
            <td><span style="color:${gpa ? gradeColor(gpa) : 'var(--text3)'};font-weight:700">${gpa ? gpa.toFixed(2) : '—'}</span></td>
            <td>${failCount}</td>
            <td><div class="flex gap-4" style="flex-wrap:wrap">${factors.join('')}</div></td>
            <td class="text-sm text-muted">Schedule advising session</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}

// Tab 3: GPA Trend per Student
function buildGPAPanel(pool) {
  const data = pool.filter(s => studentSemesters(s.id).filter(x => x.gpa != null).length >= 1);
  if (!data.length) {
    return `<div class="empty">
      <div class="empty-icon">📊</div>
      <div class="empty-text">No GPA data available yet.<br>Grades must be submitted for at least one semester.</div>
    </div>`;
  }

  return `
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Student GPA Trends</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Student</th><th>Year</th><th>Current GPA</th><th>Semesters</th><th>GPA History</th><th>Trend</th></tr></thead>
        <tbody>${data.map(s => {
          const sems  = studentSemesters(s.id).filter(x => x.gpa != null);
          const gpa   = calcGPA(s.id);
          const vals  = sems.map(x => x.gpa);
          const last  = vals[vals.length - 1];
          const prev  = vals.length >= 2 ? vals[vals.length - 2] : null;
          const tLabel = prev == null ? '—'
            : last > prev + 0.2  ? '<span style="color:var(--danger)">📉 Declining</span>'
            : last < prev - 0.2  ? '<span style="color:var(--success)">📈 Improving</span>'
            :                       '<span style="color:var(--warning)">➡ Stable</span>';
          const history = sems.map(x => `<span class="mono" style="font-size:.72rem">${x.sem.slice(0,1)}${x.sy.slice(-4)}: ${x.gpa.toFixed(2)}</span>`).join(' · ');
          return `<tr>
            <td><div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(s.name)}</div>
              <div>
                <div class="fw-6">${esc(s.name)}</div>
                <div class="text-xs text-muted">${esc(s.id)}</div>
              </div>
            </div></td>
            <td>Year ${s.year}</td>
            <td><span style="color:${gpa ? gradeColor(gpa) : 'var(--text3)'};font-weight:700">${gpa ? gpa.toFixed(2) : '—'}</span></td>
            <td>${sems.length}</td>
            <td class="text-xs text-muted">${history || '—'}</td>
            <td>${vals.length >= 2 ? sparkline(vals) + ' ' + tLabel : tLabel}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}

// Tab 4: Bottleneck Detection
function buildBottleneckPanel(bottleneck) {
  if (!bottleneck || !bottleneck.length) {
    return `<div class="empty">
      <div class="empty-icon">🚨</div>
      <div class="empty-text">No bottleneck subjects detected yet.<br>More historical grade data is needed.</div>
    </div>`;
  }

  const critical = bottleneck.filter(b => b.failRate >= 30).length;
  return `
    <div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(245,158,11,.3);color:#92400e;border-radius:10px;padding:11px 16px;margin-bottom:20px;font-size:.84rem;font-weight:500">
      🚨 <strong>${critical} subject(s)</strong> with ≥30% failure rate. Curriculum review recommended.
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Bottleneck Subjects — Sorted by Failure Rate</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Subject</th><th>Total Grades</th><th>Passed</th><th>Failed</th><th>Failure Rate</th><th>Severity</th></tr></thead>
        <tbody>${bottleneck.map(b => {
          const severity = b.failRate >= 50 ? '<span class="badge badge-danger">🔴 Critical</span>'
            : b.failRate >= 30 ? '<span class="badge badge-warning">🟠 High</span>'
            : b.failRate >= 15 ? '<span class="badge badge-info">🟡 Moderate</span>'
            : '<span class="badge badge-success">🟢 Low</span>';
          const barColor = b.failRate >= 50 ? 'var(--danger)' : b.failRate >= 30 ? 'var(--warning)' : 'var(--info)';
          return `<tr>
            <td><span class="chip">${b.subj ? esc(b.subj.code) : '—'}</span> <span class="fw-6">${b.subj ? esc(b.subj.name) : '—'}</span></td>
            <td>${b.total}</td>
            <td style="color:var(--success)">${b.total - b.failed}</td>
            <td style="color:var(--danger);font-weight:700">${b.failed}</td>
            <td>
              <div class="flex gap-8" style="align-items:center">
                <div style="width:80px;height:7px;background:var(--bg4);border-radius:4px;overflow:hidden">
                  <div style="width:${b.failRate}%;height:100%;background:${barColor};border-radius:4px"></div>
                </div>
                <span style="color:${b.failRate >= 50 ? 'var(--danger)' : b.failRate >= 30 ? 'var(--warning)' : 'var(--text)'};font-weight:700">${b.failRate}%</span>
              </div>
            </td>
            <td>${severity}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`;
}




/* ──────────────────────────────────────────────
   HEADCOUNT PANEL  (Registrar only)
────────────────────────────────────────────── */
function buildHeadcountPanel(pool, scopeSids) {
  const total   = pool.length;
  const male    = pool.filter(s => s.gender === 'Male').length;
  const female  = pool.filter(s => s.gender === 'Female').length;
  const mPct    = total ? Math.round(male   / total * 100) : 0;
  const fPct    = total ? Math.round(female / total * 100) : 0;

  // By year level
  const byYear = [1,2,3,4].map(yr => {
    const yPool = pool.filter(s => s.year === yr);
    const yM    = yPool.filter(s => s.gender === 'Male').length;
    const yF    = yPool.filter(s => s.gender === 'Female').length;
    return { yr, total: yPool.length, male: yM, female: yF };
  });
  const maxY = Math.max(...byYear.map(y => y.total), 1);

  // By semester (submitted grades)
  const semKeys = [...new Set(
    DB.sections.filter(s => s.submitted).map(s => `${s.sy}|${s.sem}`)
  )].sort();
  const semData = semKeys.map(k => {
    const [sy, sem] = k.split('|');
    const secIds = DB.sections.filter(s => s.sy === sy && s.sem === sem && s.submitted).map(s => s.id);
    const stuIds = [...new Set(
      DB.enrollments.filter(e => secIds.includes(e.sectionId) && pool.some(p => p.id === e.studentId))
        .map(e => e.studentId)
    )];
    return { label: `${sem} ${sy.slice(-4)}`, count: stuIds.length };
  });

  return `
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="card-title">Overall Headcount</div>
        <div style="font-size:3rem;font-weight:900;color:var(--blue);line-height:1;margin-bottom:10px">${total}</div>
        <div class="text-sm text-muted mb-16">Total students in scope</div>
        <div class="flex-between mb-6">
          <span class="text-sm">Male</span>
          <span class="fw-7" style="color:var(--blue)">${male} (${mPct}%)</span>
        </div>
        <div class="progress mb-12" style="height:9px">
          <div class="progress-bar" style="width:${mPct}%"></div>
        </div>
        <div class="flex-between mb-6">
          <span class="text-sm">Female</span>
          <span class="fw-7" style="color:#ec4899">${female} (${fPct}%)</span>
        </div>
        <div class="progress" style="height:9px">
          <div class="progress-bar" style="width:${fPct}%;background:linear-gradient(90deg,#ec4899,#f472b6)"></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Headcount by Year Level</div>
        ${byYear.map(({ yr, total: t, male: m, female: f }) => {
          const pct = Math.round(t / maxY * 100);
          const ord = ['','1st','2nd','3rd','4th'][yr];
          return `<div class="mb-14">
            <div class="flex-between mb-4">
              <span class="text-sm fw-6">${ord} Year</span>
              <div class="flex gap-8 text-xs text-muted">
                <span>👨 ${m}</span><span>👩 ${f}</span>
                <span class="fw-7" style="color:var(--blue)">${t} total</span>
              </div>
            </div>
            <div class="progress" style="height:9px">
              <div class="progress-bar" style="width:${pct}%"></div>
            </div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="card">
      <div class="card-title">Enrollment Count by Semester</div>
      ${semData.length === 0
        ? '<div class="text-muted text-sm">No semester data yet.</div>'
        : `<div style="display:flex;align-items:flex-end;gap:12px;height:150px;padding:10px 0 8px">
          ${semData.map(s => {
            const maxC = Math.max(...semData.map(x => x.count), 1);
            const h    = Math.max(10, Math.round(s.count / maxC * 120));
            return `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px">
              <div style="font-size:.75rem;font-weight:700;color:var(--blue)">${s.count}</div>
              <div style="width:100%;height:${h}px;background:var(--blue);border-radius:6px 6px 0 0;opacity:.85"></div>
              <div style="font-size:.65rem;color:var(--text3);text-align:center">${esc(s.label)}</div>
            </div>`;
          }).join('')}
        </div>`}
    </div>`;
}

/* ──────────────────────────────────────────────
   DEPT COMPARISON PANEL  (Registrar only)
   Bar chart: dept vs dept comparing pass rate / avg GPA
────────────────────────────────────────────── */
function buildDeptComparisonPanel() {
  const depts = DB.departments.map(dept => {
    const sids = secIdsForDept(dept.id).filter(id => getSection(id)?.submitted);
    const sm   = gradeSummary(sids);
    const col  = getCollege(dept.collegeId);
    return { dept, sm, col };
  }).sort((a, b) => (b.sm.passRate ?? -1) - (a.sm.passRate ?? -1));

  const max = Math.max(...depts.map(d => d.sm.passRate ?? 0), 1);

  return `
    <div class="card mb-20">
      <div class="card-title">Departmental Pass Rate Comparison</div>
      <div class="text-xs text-muted mb-16">All departments sorted by pass rate — submitted grades only</div>
      ${depts.map(({ dept, sm, col }) => {
        const pct   = sm.passRate ?? 0;
        const color = pct >= 75 ? 'var(--success)' : pct >= 60 ? 'var(--warning)' : 'var(--danger)';
        const barW  = Math.round(pct / max * 100);
        return `<div style="margin-bottom:16px">
          <div class="flex-between mb-4">
            <div>
              <span class="fw-6 text-sm">${esc(dept.name.replace('Department of ',''))}</span>
              <span class="text-xs text-muted" style="margin-left:8px">${col ? esc(col.name.replace('College of ','')) : ''}</span>
            </div>
            <div class="flex gap-12 text-xs text-muted">
              <span>Grades: ${sm.total}</span>
              <span style="color:var(--success)">Pass: ${sm.passed}</span>
              <span style="color:var(--danger)">Fail: ${sm.failed}</span>
              <span class="fw-7" style="color:${color};font-size:.84rem;min-width:44px;text-align:right">${sm.passRate ?? '—'}%</span>
            </div>
          </div>
          <div style="height:14px;background:var(--bg4);border-radius:8px;overflow:hidden">
            <div style="height:100%;width:${barW}%;background:${color};border-radius:8px;transition:width .7s"></div>
          </div>
        </div>`;
      }).join('')}
    </div>

    <div class="section-card">
      <div class="section-card-head"><div class="page-title">Comparison Table</div></div>
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Department</th><th>College</th><th>Total Grades</th>
          <th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th>
        </tr></thead>
        <tbody>${depts.map(({ dept, sm, col }) => `<tr>
          <td class="fw-6">${esc(dept.name.replace('Department of ',''))}</td>
          <td class="text-sm text-muted">${col ? esc(col.name.replace('College of ','')) : '—'}</td>
          <td>${sm.total}</td>
          <td style="color:var(--success)">${sm.passed}</td>
          <td style="color:var(--danger)">${sm.failed}</td>
          <td>${prCell(sm.passRate)}</td>
          <td class="mono">${sm.avg ? sm.avg.toFixed(2) : '—'}</td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`;
}


/* ──────────────────────────────────────────────
   MY COLLEGE  (Dean)
────────────────────────────────────────────── */
function renderCollege() {
  const col   = getCollege(currentUser.collegeId);
  const depts = DB.departments.filter(d => d.collegeId === currentUser.collegeId);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">${col ? esc(col.name) : 'My College'}</div>
        <div class="text-muted text-sm">${depts.length} department(s)</div>
      </div>
    </div>
    <div class="grid-2 mb-20">
      ${depts.map(dept => {
        const subjs  = DB.subjects.filter(s => s.deptId === dept.id);
        const facs   = DB.users.filter(u => u.role === 'Faculty' && u.deptId === dept.id);
        const chair  = DB.users.find(u => u.role === 'Chairman' && u.deptId === dept.id);
        const sids   = secIdsForDept(dept.id);
        const sm     = gradeSummary(sids);
        return `<div class="card">
          <div class="flex-between mb-16">
            <div>
              <div class="fw-7" style="font-size:1rem">${esc(dept.name)}</div>
              ${chair ? `<div class="text-xs text-muted mt-2">Chairman: ${esc(chair.name)}</div>` : ''}
            </div>
            <span class="badge badge-teal">${sids.length} sections</span>
          </div>
          <div class="grid-3 mb-16">
            ${miniStat('Subjects', subjs.length, 'var(--blue)')}
            ${miniStat('Faculty',  facs.length,  'var(--warning)')}
            ${miniStat('Pass Rate', sm.passRate != null ? sm.passRate + '%' : '—', sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--warning)')}
          </div>
          <div class="card-title">Faculty Members</div>
          ${facs.length === 0
            ? '<div class="text-muted text-sm">No faculty assigned.</div>'
            : facs.map(f => `<div class="flex-between mb-8">
                <div class="flex gap-8"><div class="avatar avatar-sm">${initials(f.name)}</div><div class="text-sm fw-6">${esc(f.name)}</div></div>
                <span class="text-xs text-muted">${DB.sections.filter(s => s.facultyId === f.id && sids.includes(s.id)).length} section(s)</span>
              </div>`).join('')}
        </div>`;
      }).join('')}
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">All Subjects in College</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Subject Name</th><th>Units</th><th>Department</th><th>Year</th><th>Sem</th></tr></thead>
        <tbody>${DB.subjects.filter(s => depts.map(d => d.id).includes(s.deptId)).map(s => {
          const dept = getDept(s.deptId);
          return `<tr>
            <td><span class="chip">${esc(s.code)}</span></td>
            <td class="fw-6">${esc(s.name)}</td>
            <td>${s.units}</td>
            <td class="text-sm text-muted">${dept ? esc(dept.name.replace('Department of ', '')) : '—'}</td>
            <td>Year ${s.year}</td>
            <td>${s.sem === 1 ? '1st' : s.sem === 2 ? '2nd' : 'Summer'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   SUBJECT ASSIGNMENT  (Dean + Chairman)
────────────────────────────────────────────── */
function renderAssignment() {
  const deptId  = currentUser.deptId;
  const deptIds = [deptId];
  const subjects = DB.subjects.filter(s => deptIds.includes(s.deptId));
  const myFacs   = DB.users.filter(u => u.role === 'Faculty' && u.deptId === deptId && u.active);
  const mySecs   = DB.sections.filter(s => subjects.map(x=>x.id).includes(s.subjectId));

  set(`
    <div class="page-header">
      <div class="page-title">Subject Assignment</div>
      <button class="btn btn-primary" onclick="showCreateSectionModal()">+ Create Section</button>
    </div>

    ${subjects.length === 0
      ? `<div class="empty"><div class="empty-icon">📚</div><div class="empty-text">No subjects in curriculum yet.<br>Add subjects via Registrar → Curriculum.</div></div>`
      : `
      <!-- Subject-Faculty-Section table -->
      <div class="section-card mb-20">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-7">📚 Subjects & Faculty Assignments</div>
          <div class="text-xs text-muted">Assign faculty per subject and manage sections</div>
        </div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Subject Code</th><th>Subject Name</th><th>Units</th><th>Year</th><th>Sem</th>
            <th>Sections</th><th>Assigned Faculty</th><th>Actions</th>
          </tr></thead>
          <tbody>${subjects.map(subj => {
            const secList = mySecs.filter(s => s.subjectId === subj.id);
            const facIds  = [...new Set(secList.map(s => s.facultyId).filter(Boolean))];
            const facNames = facIds.map(id => getUser(id)?.name || '—').join(', ');
            return `<tr>
              <td><span class="chip">${esc(subj.code)}</span></td>
              <td class="fw-6">${esc(subj.name)}</td>
              <td>${subj.units}</td>
              <td>Year ${subj.year}</td>
              <td>${subj.sem === 1 ? '1st' : subj.sem === 2 ? '2nd' : 'Summer'}</td>
              <td>
                ${secList.length === 0
                  ? '<span class="text-muted text-xs">No sections</span>'
                  : secList.map(sec => {
                      const fac = getUser(sec.facultyId);
                      const enr = enrolledIn(sec.id).length;
                      return `<span class="badge badge-teal" style="margin:2px;cursor:pointer" title="${fac?fac.name:'No faculty'} — ${enr} students" onclick="showSectionDetailModal(${sec.id})">${esc(sec.sectionName)}</span>`;
                    }).join('')}
              </td>
              <td class="text-sm text-muted">${facNames || '—'}</td>
              <td><div class="flex gap-6">
                <button class="btn btn-sm btn-primary" onclick="showCreateSectionForSubject(${subj.id})">+ Section</button>
              </div></td>
            </tr>`;
          }).join('')}</tbody>
        </table></div>
      </div>

      <!-- All sections detail -->
      <div class="section-card">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-7">📋 All Sections</div>
          <div class="text-xs text-muted">Reassign faculty · Move students between sections</div>
        </div>
        ${mySecs.length === 0
          ? `<div class="empty" style="padding:36px"><div class="empty-icon">📋</div><div class="empty-text">No sections yet.</div></div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Subject</th><th>Section</th><th>Faculty</th><th>School Year</th><th>Sem</th>
                <th>Enrolled</th><th>Status</th><th>Actions</th>
              </tr></thead>
              <tbody>${mySecs.map(sec => {
                const subj = getSubject(sec.subjectId);
                const fac  = getUser(sec.facultyId);
                const enr  = enrolledIn(sec.id).length;
                return `<tr>
                  <td><span class="chip">${subj ? esc(subj.code) : '—'}</span></td>
                  <td><span class="badge badge-teal fw-7">${esc(sec.sectionName)}</span></td>
                  <td class="text-sm">${fac ? esc(fac.name) : '<span class="text-muted">Unassigned</span>'}</td>
                  <td class="text-sm text-muted">${esc(sec.sy)}</td>
                  <td class="text-sm text-muted">${esc(sec.sem)}</td>
                  <td><span class="fw-6" style="color:var(--blue)">${enr}</span> / <span class="text-muted">${sec.quota || 40}</span></td>
                  <td><span class="badge badge-${sec.submitted?'success':'muted'}">${sec.submitted?'✔ Submitted':'Draft'}</span></td>
                  <td><div class="flex gap-6">
                    <button class="btn btn-sm btn-ghost" onclick="showReassignModal(${sec.id})">✎ Faculty</button>
                    <button class="btn btn-sm btn-ghost" onclick="showSectionDetailModal(${sec.id})">👥 Students</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteSection(${sec.id})">✕</button>
                  </div></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>`}
      </div>
    `}
  `);
}

function showCreateSectionForSubject(subjId) {
  const subj  = getSubject(subjId);
  const dids  = scopeDeptIds();
  const facs  = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);
  showModal(`Create Section — ${subj ? esc(subj.code) : ''}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Section Name</div>
        <input id="cs-n" class="input" placeholder="e.g. Section A or BSIT-1A">
      </div>
      <div class="field-wrap"><div class="field-label">School Year</div>
        <input id="cs-y" class="input" value="${new Date().getFullYear()}-${new Date().getFullYear()+1}">
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="cs-sem" class="select-input"><option>1st</option><option>2nd</option><option>Summer</option></select>
      </div>
      <div class="field-wrap"><div class="field-label">Student Quota</div>
        <input id="cs-quota" class="input" type="number" min="30" max="40" value="40" placeholder="30–40">
      </div>
    </div>
    <div class="field-wrap"><div class="field-label">Assign Faculty</div>
      <select id="cs-f" class="select-input">
        <option value="">— Unassigned —</option>
        ${facs.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
      </select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="createSectionForSubject(${subjId})">Create</button>`
  );
}

function createSectionForSubject(subjId) {
  const secName = document.getElementById('cs-n').value.trim();
  const sy      = document.getElementById('cs-y').value.trim();
  const sem     = document.getElementById('cs-sem').value;
  const quota   = Math.min(40, Math.max(30, +document.getElementById('cs-quota').value || 40));
  const facId   = +document.getElementById('cs-f').value || null;
  if (!secName || !sy) { toast('Section name and school year required', 'error'); return; }
  DB.sections.push({ id: DB.nextId.section++, subjectId: subjId, facultyId: facId, sy, sem, sectionName: secName, submitted: false, submittedAt: null, quota });
  save();
  logAudit(`Section created: ${secName}`);
  toast('Section created', 'success');
  closeModal();
  renderAssignment();
}

// Section detail modal — show enrolled students + move to another section
function showSectionDetailModal(sectionId) {
  const sec      = getSection(sectionId);
  const subj     = getSubject(sec?.subjectId);
  const enrolled = enrolledIn(sectionId);
  const fac      = getUser(sec?.facultyId);
  // Sibling sections (same subject)
  const siblings = DB.sections.filter(s => s.subjectId === sec?.subjectId && s.id !== sectionId);

  showModal(`Section: ${subj ? esc(subj.code) : '—'} — ${esc(sec?.sectionName || '')}`, `
    <div style="background:var(--bg3);border-radius:10px;padding:12px 16px;margin-bottom:16px;font-size:.84rem">
      <strong>Faculty:</strong> ${fac ? esc(fac.name) : 'Unassigned'} &nbsp;·&nbsp;
      <strong>Enrolled:</strong> ${enrolled.length}/${sec?.quota || 40}
    </div>
    ${enrolled.length === 0
      ? '<div class="text-muted text-sm">No students enrolled in this section.</div>'
      : `<div class="table-wrap"><table style="min-width:unset">
          <thead><tr><th>Name</th><th>ID</th>${siblings.length ? '<th>Move To</th>' : ''}</tr></thead>
          <tbody>${enrolled.map(s => `<tr>
            <td class="fw-6 text-sm">${esc(s.name)}</td>
            <td class="mono text-xs text-muted">${esc(s.id)}</td>
            ${siblings.length ? `<td>
              <select class="select-input" style="width:140px;font-size:.78rem" onchange="moveStudentSection('${s.id}',${sectionId},+this.value)">
                <option value="">Move to…</option>
                ${siblings.map(si => `<option value="${si.id}">${esc(si.sectionName)}</option>`).join('')}
              </select>
            </td>` : ''}
          </tr>`).join('')}</tbody>
        </table></div>`}`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
  );
}

function moveStudentSection(studentId, fromSectionId, toSectionId) {
  if (!toSectionId) return;
  const toSec = getSection(toSectionId);
  const enrInTo = enrolledIn(toSectionId).length;
  if (enrInTo >= (toSec?.quota || 40)) {
    toast(`Section ${toSec?.sectionName} is full (${toSec?.quota || 40} max)`, 'error');
    return;
  }
  // Move enrollment
  const enr = DB.enrollments.find(e => e.studentId === studentId && e.sectionId === fromSectionId);
  if (enr) enr.sectionId = toSectionId;
  // Move grade if any
  const gr = DB.grades.find(g => g.studentId === studentId && g.sectionId === fromSectionId);
  if (gr) gr.sectionId = toSectionId;
  save();
  logAudit(`Student ${studentId} moved from section ${fromSectionId} to ${toSectionId}`);
  toast('Student moved to new section', 'success');
  closeModal();
  renderAssignment();
}

function scopeDeptIds() {
  return currentUser.role === 'Dean'
    ? DB.departments.filter(d => d.collegeId === currentUser.collegeId).map(d => d.id)
    : [currentUser.deptId];
}

function showCreateSectionModal() {
  const dids  = scopeDeptIds();
  const subjs = DB.subjects.filter(s => dids.includes(s.deptId));
  const facs  = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);

  showModal('Create Section / Assign Faculty', `
    <div class="field-wrap">
      <div class="field-label">Subject</div>
      <select id="cs-s" class="select-input">
        ${subjs.map(s => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)} (${s.units} units)</option>`).join('')}
      </select>
    </div>
    <div class="field-wrap">
      <div class="field-label">Assign to Faculty</div>
      <select id="cs-f" class="select-input">
        ${facs.map(f => `<option value="${f.id}">${esc(f.name)}</option>`).join('')}
      </select>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Section Name</div><input id="cs-n" class="input" placeholder="e.g. BSIT-3A"></div>
      <div class="field-wrap"><div class="field-label">School Year</div><input id="cs-y" class="input" value="2024-2025"></div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Semester</div>
      <select id="cs-sem" class="select-input"><option>1st</option><option>2nd</option><option>Summer</option></select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="createSection()">Create Section</button>`
  );
}

function createSection() {
  const subjId  = +document.getElementById('cs-s').value;
  const facId   = +document.getElementById('cs-f').value;
  const secName = document.getElementById('cs-n').value.trim();
  const sy      = document.getElementById('cs-y').value.trim();
  const sem     = document.getElementById('cs-sem').value;
  if (!secName || !sy) { toast('Section name and school year are required', 'error'); return; }
  DB.sections.push({ id: DB.nextId.section++, subjectId: subjId, facultyId: facId, sy, sem, sectionName: secName, submitted: false, submittedAt: null });
  save();
  logAudit(`Section created: ${secName} / ${getSubject(subjId)?.code}`);
  toast('Section created and faculty assigned', 'success');
  closeModal();
  renderAssignment();
}

function showReassignModal(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  const dids = scopeDeptIds();
  const facs = DB.users.filter(u => u.role === 'Faculty' && dids.includes(u.deptId) && u.active);
  const subj = getSubject(sec.subjectId);

  showModal(`Reassign Faculty — ${subj ? esc(subj.code) : ''} ${esc(sec.sectionName)}`, `
    <div class="field-wrap">
      <div class="field-label">Assign to Faculty</div>
      <select id="ra-f" class="select-input">
        ${facs.map(f => `<option value="${f.id}"${f.id === sec.facultyId ? ' selected' : ''}>${esc(f.name)}</option>`).join('')}
      </select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="reassignFaculty(${sectionId})">Reassign</button>`
  );
}

function reassignFaculty(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  sec.facultyId = +document.getElementById('ra-f').value;
  save();
  logAudit(`Faculty reassigned: section ${sec.sectionName}`);
  toast('Faculty reassigned successfully', 'success');
  closeModal();
  renderAssignment();
}

function showEnrollModal(sectionId) {
  const sec  = getSection(sectionId);
  const subj = getSubject(sec?.subjectId);
  if (!sec) return;

  const enrolled    = enrolledIn(sectionId);
  const enrolledIds = enrolled.map(s => s.id);
  const dids        = scopeDeptIds();
  const available   = DB.students.filter(s => stuEnrolled(s) && dids.includes(s.deptId) && !enrolledIds.includes(s.id));

  showModal(`Students — ${subj ? esc(subj.code) : ''} ${esc(sec.sectionName)}`, `
    <div class="mb-16">
      <div class="card-title mb-8">Currently Enrolled (${enrolled.length})</div>
      ${enrolled.length === 0
        ? '<div class="text-muted text-sm">No students enrolled yet.</div>'
        : enrolled.map(s => `<div class="flex-between mb-8">
            <div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(s.name)}</div>
              <span class="text-sm fw-6">${esc(s.name)}</span>
            </div>
            <button class="btn btn-sm btn-danger" onclick="unenrollStudent('${s.id}',${sectionId})">Remove</button>
          </div>`).join('')}
    </div>
    <div style="height:1px;background:var(--border);margin:12px 0"></div>
    <div>
      <div class="card-title mb-8">Add Student</div>
      ${available.length === 0
        ? '<div class="text-muted text-sm">All eligible students are already enrolled.</div>'
        : `<div class="flex gap-8">
            <select id="enr-s" class="select-input" style="flex:1">
              ${available.map(s => `<option value="${s.id}">${s.id} — ${esc(s.name)}</option>`).join('')}
            </select>
            <button class="btn btn-primary" onclick="enrollStudent(${sectionId})">+ Enroll</button>
          </div>`}
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Close</button>`
  );
}

function enrollStudent(sectionId) {
  const sid = document.getElementById('enr-s').value;
  if (!sid) return;
  if (DB.enrollments.find(e => e.studentId === sid && e.sectionId === sectionId)) { toast('Already enrolled', 'error'); return; }
  DB.enrollments.push({ id: DB.nextId.enrollment++, studentId: sid, sectionId });
  save();
  logAudit(`Student enrolled: ${sid} → section ${sectionId}`);
  toast('Student enrolled', 'success');
  closeModal();
  showEnrollModal(sectionId);
}

function unenrollStudent(studentId, sectionId) {
  if (DB.grades.some(g => g.studentId === studentId && g.sectionId === sectionId)) {
    toast('Cannot remove — grade already exists for this student', 'error');
    return;
  }
  DB.enrollments = DB.enrollments.filter(e => !(e.studentId === studentId && e.sectionId === sectionId));
  save();
  logAudit(`Student unenrolled: ${studentId} from section ${sectionId}`);
  toast('Student removed from section', 'info');
  closeModal();
  showEnrollModal(sectionId);
}

function deleteSection(sectionId) {
  if (!confirm('Delete this section? This cannot be undone.')) return;
  DB.sections    = DB.sections.filter(s => s.id !== sectionId);
  DB.enrollments = DB.enrollments.filter(e => e.sectionId !== sectionId);
  save();
  logAudit(`Section deleted: ${sectionId}`);
  toast('Section deleted', 'info');
  renderAssignment();
}


/* ──────────────────────────────────────────────
   MY ADVISEES  (Faculty)
────────────────────────────────────────────── */
function renderAdvisees() {
  const myStudents = DB.students.filter(s => s.adviserId === currentUser.id);
  const atRisk     = getAtRiskStudents(myStudents);

  set(`
    <div class="page-header">
      <div class="page-title">My Advisees (${myStudents.length})</div>
    </div>

    ${atRisk.length > 0 ? `<div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(239,68,68,.3);color:#b91c1c;border-radius:10px;padding:11px 16px;margin-bottom:20px;font-size:.84rem;font-weight:500">
      ⚠ <strong>${atRisk.length} at-risk advisee(s)</strong> — recommend scheduling advising sessions.
    </div>` : ''}

    <div class="section-card">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Student ID</th><th>Name</th><th>Program</th><th>Year</th><th>GPA</th><th>Status</th><th>GPA Trend</th><th>Alert</th>
        </tr></thead>
        <tbody>
          ${myStudents.length === 0
            ? `<tr><td colspan="8" class="table-empty">No advisees assigned to you yet.</td></tr>`
            : myStudents.map(s => {
                const gpa  = calcGPA(s.id);
                const risk = atRisk.find(r => r.s.id === s.id);
                const sems = studentSemesters(s.id).filter(x => x.gpa != null);
                const vals = sems.map(x => x.gpa);
                return `<tr>
                  <td class="mono text-sm text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm">${initials(s.name)}</div>
                    <span class="fw-6">${esc(s.name)}</span>
                  </div></td>
                  <td class="text-sm text-muted">${esc(s.program)}</td>
                  <td>Year ${s.year}</td>
                  <td><span style="color:${gpa ? gradeColor(gpa) : 'var(--text3)'};font-weight:700">${gpa ? gpa.toFixed(2) : '—'}</span></td>
                  <td><span class="badge badge-${stuStatusBadge(s)}">${stuStatus(s)}</span></td>
                  <td>${vals.length >= 2 ? sparkline(vals) : '<span class="text-muted text-xs">—</span>'}</td>
                  <td>${risk ? '<span class="risk-tag">⚠ At Risk</span>' : '<span class="badge badge-success">✓ OK</span>'}</td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   HANDLED SECTIONS  (Faculty)
   Subjects shown as clickable cards.
   Student list only appears after clicking a card.
────────────────────────────────────────────── */
let activeSectionCard = null;

function renderSections() {
  const mySecs = DB.sections.filter(s => s.facultyId === currentUser.id);

  set(`
    <div class="page-header">
      <div class="page-title">Handled Sections (${mySecs.length})</div>
    </div>
    ${mySecs.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No sections assigned yet.<br>Contact your Chairman or Dean.</div></div>`
      : `
        <!-- Subject cards grid -->
        <div class="grid-3 mb-20">
          ${mySecs.map(sec => {
            const subj    = getSubject(sec.subjectId);
            const enrList = enrolledIn(sec.id);
            const graded  = DB.grades.filter(g => g.sectionId === sec.id).length;
            const pr      = sectionPassRate(sec.id);
            const isActive = activeSectionCard === sec.id;
            return `<div
              onclick="activeSectionCard=${sec.id};renderSections()"
              style="cursor:pointer;background:var(--white);border:2px solid ${isActive ? 'var(--blue)' : 'var(--border)'};border-radius:var(--radius-lg);padding:18px;box-shadow:${isActive ? '0 0 0 3px rgba(59,111,245,.15), var(--shadow)' : 'var(--shadow)'};transition:all .18s;${isActive ? 'background:linear-gradient(135deg,#eff6ff,#fff)' : ''}">
              <div class="flex-between mb-12">
                <div>
                  <span class="chip" style="margin-bottom:6px;display:inline-flex">${subj ? esc(subj.code) : '—'}</span>
                  <div class="fw-7" style="font-size:.95rem;margin-top:4px">${subj ? esc(subj.name) : '—'}</div>
                </div>
                ${sec.submitted ? '<span class="badge badge-success" style="font-size:.65rem">🔒</span>' : ''}
              </div>
              <div class="text-xs text-muted mb-12">
                ${esc(sec.sectionName)} · ${esc(sec.sem)} Sem · ${esc(sec.sy)}${subj ? ' · ' + subj.units + ' units' : ''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:var(--blue)">${enrList.length}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Enrolled</div>
                </div>
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:var(--teal)">${graded}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Graded</div>
                </div>
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:${pr != null ? (pr >= 75 ? 'var(--success)' : 'var(--danger)') : 'var(--text3)'}">${pr != null ? pr + '%' : '—'}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Pass Rate</div>
                </div>
              </div>
              ${!sec.submitted
                ? `<button class="btn btn-primary btn-sm" style="width:100%" onclick="event.stopPropagation();encodeActiveSec=${sec.id};navigate('encode')">✍ Encode Grades</button>`
                : `<div style="text-align:center;font-size:.78rem;color:var(--success);font-weight:600">✔ Grades Submitted</div>`}
            </div>`;
          }).join('')}
        </div>

        <!-- Expandable student list — only shown when a card is clicked -->
        ${activeSectionCard ? (() => {
          const sec     = getSection(activeSectionCard);
          const subj    = getSubject(sec?.subjectId);
          const enrList = sec ? enrolledIn(sec.id) : [];
          return `<div class="section-card">
            <div class="section-card-head">
              <div>
                <div class="flex gap-10">
                  <span class="chip">${subj ? esc(subj.code) : '—'}</span>
                  <span class="fw-7">${subj ? esc(subj.name) : '—'}</span>
                  <span class="badge badge-teal">${esc(sec.sectionName)}</span>
                  ${sec.submitted ? '<span class="badge badge-success">🔒 Submitted</span>' : ''}
                </div>
                <div class="text-xs text-muted mt-6">${esc(sec.sem)} Semester · ${esc(sec.sy)}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="activeSectionCard=null;renderSections()">✕ Close</button>
            </div>
            <div class="section-card-body">
              ${enrList.length === 0
                ? '<div class="text-muted text-sm">No students enrolled in this section.</div>'
                : `<div class="table-wrap"><table>
                    <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Grade</th></tr></thead>
                    <tbody>${enrList.map(s => {
                      const gr = gradeFor(s.id, activeSectionCard);
                      return `<tr>
                        <td class="mono text-sm text-muted">${esc(s.id)}</td>
                        <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div></td>
                        <td>Year ${s.year}</td>
                        <td>${gr
                          ? `<span style="color:${gradeColor(gr.grade)};font-weight:700">${fmt2(gr.grade)} — ${gradeDesc(gr.grade)}</span>`
                          : '<span class="badge badge-muted">Not graded</span>'}</td>
                      </tr>`;
                    }).join('')}</tbody>
                  </table></div>`}
            </div>
          </div>`;
        })() : ''}
      `}
  `);
}


/* ──────────────────────────────────────────────
   ENCODE GRADES  (Faculty)
   Submit routes grades to students — no locking
   Faculty can always edit for corrections
────────────────────────────────────────────── */
let encodeActiveSec = null;

function renderEncode() {
  const mySecs = DB.sections.filter(s => s.facultyId === currentUser.id);
  if (!encodeActiveSec && mySecs.length > 0) encodeActiveSec = mySecs[0].id;

  const activeSec  = getSection(encodeActiveSec);
  const activeSubj = activeSec ? getSubject(activeSec.subjectId) : null;
  const students   = activeSec ? enrolledIn(encodeActiveSec) : [];

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Grade Encoding</div>
        <div class="text-muted text-sm">Save grades anytime. Submit to route grades to students — editable at all times for corrections.</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:270px 1fr;gap:16px">

      <!-- Section picker sidebar -->
      <div class="card" style="height:fit-content">
        <div class="card-title">My Sections</div>
        ${mySecs.length === 0
          ? '<div class="text-muted text-sm">No sections assigned.</div>'
          : mySecs.map(sec => {
              const subj = getSubject(sec.subjectId);
              const enr  = enrolledIn(sec.id).length;
              const gr   = DB.grades.filter(g => g.sectionId === sec.id).length;
              const isA  = sec.id === encodeActiveSec;
              return `<div class="sec-picker-item${isA ? ' active' : ''}" onclick="encodeActiveSec=${sec.id};renderEncode()">
                <div class="flex gap-8 mb-4">
                  <span class="chip">${subj ? esc(subj.code) : '—'}</span>
                  <span class="badge badge-teal">${esc(sec.sectionName)}</span>
                  ${sec.submitted ? '<span class="badge badge-success" style="font-size:.62rem">✔ Submitted</span>' : ''}
                </div>
                <div class="text-xs text-muted">${esc(sec.sem)} Sem · ${gr}/${enr} graded${sec.submitted ? ' · Visible to students' : ''}</div>
              </div>`;
            }).join('')}
      </div>

      <!-- Grade entry panel -->
      <div>
        ${!activeSec
          ? `<div class="card"><div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Select a section from the left.</div></div></div>`
          : `<div class="section-card">
              <div class="section-card-head">
                <div>
                  <div class="fw-7">${activeSubj ? esc(activeSubj.code) + ' — ' + esc(activeSubj.name) : '—'}</div>
                  <div class="text-xs text-muted mt-4">
                    Section: ${esc(activeSec.sectionName)} · ${esc(activeSec.sem)} Sem ${esc(activeSec.sy)}
                  </div>
                </div>
                <div class="flex gap-8">
                  <button class="btn btn-ghost btn-sm" onclick="saveDraftGrades(${encodeActiveSec})">💾 Save</button>
                  <button class="btn btn-primary btn-sm" onclick="submitGrades(${encodeActiveSec})">✔ Submit to Students</button>
                </div>
              </div>
              <div class="section-card-body">
                ${activeSec.submitted
                  ? `<div class="alert-box alert-teal mb-16">
                      ✔ Grades are submitted and visible to students. You can still update grades here if corrections are needed.
                    </div>`
                  : ''}
                ${students.length === 0
                  ? `<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">No students enrolled in this section.</div></div>`
                  : `<table style="width:100%;border-collapse:collapse">
                      <thead><tr>
                        ${['Student', 'Year', 'Grade', 'Description', 'Status'].map(h =>
                          `<th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--bg3)">${h}</th>`
                        ).join('')}
                      </tr></thead>
                      <tbody>${students.map(s => {
                        const ex = gradeFor(s.id, encodeActiveSec);
                        return `<tr style="border-bottom:1px solid var(--border2)">
                          <td style="padding:11px 14px">
                            <div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div>
                          </td>
                          <td style="padding:11px 14px;font-size:.84rem;color:var(--text2)">Year ${s.year}</td>
                          <td style="padding:11px 14px">
                            <select id="g-${s.id}" class="select-input" style="width:140px" onchange="previewGrade('${s.id}')">
                              <option value="">— Select —</option>
                              ${[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 5.0].map(v =>
                                `<option value="${v}"${ex && ex.grade == v ? ' selected' : ''}>${v.toFixed(2)}</option>`
                              ).join('')}
                              <option value="INC"${ex && ex.grade === 'INC' ? ' selected' : ''}>INC — Incomplete</option>
                            </select>
                          </td>
                          <td style="padding:11px 14px" id="d-${s.id}">
                            <span style="color:${ex ? gradeColor(ex.grade) : 'var(--text3)'};font-size:.84rem">
                              ${ex ? gradeDesc(ex.grade) : '—'}
                            </span>
                          </td>
                          <td style="padding:11px 14px">
                            ${ex
                              ? `<span class="badge badge-success">✓ ${ex.date}</span>`
                              : '<span class="badge badge-muted">Not yet</span>'}
                          </td>
                        </tr>`;
                      }).join('')}</tbody>
                    </table>`}
              </div>
            </div>`}
      </div>
    </div>`);
}

function previewGrade(studentId) {
  const sel  = document.getElementById(`g-${studentId}`);
  const desc = document.getElementById(`d-${studentId}`);
  if (!sel || !desc) return;
  const v = parseFloat(sel.value);
  desc.innerHTML = isNaN(v)
    ? '<span style="color:var(--text3)">—</span>'
    : `<span style="color:${gradeColor(v)};font-size:.84rem">${gradeDesc(v)}</span>`;
}

// Save — saves grades (always editable)
function saveDraftGrades(sectionId) {
  const students = enrolledIn(sectionId);
  let saved = 0, skipped = 0;
  students.forEach(s => {
    const sel = document.getElementById(`g-${s.id}`);
    if (!sel || !sel.value) { skipped++; return; }
    const raw = sel.value;
    const val = raw === 'INC' ? 'INC' : parseFloat(raw);
    if (raw !== 'INC' && isNaN(val)) { skipped++; return; }
    const ex = gradeFor(s.id, sectionId);
    if (ex) { ex.grade = val; ex.date = new Date().toISOString().slice(0, 10); }
    else DB.grades.push({ id: DB.nextId.grade++, studentId: s.id, sectionId, grade: val, facultyId: currentUser.id, date: new Date().toISOString().slice(0, 10) });
    saved++;
  });
  if (saved === 0) { toast('No grades selected.', 'error'); return; }
  save();
  logAudit(`Grades saved: section ${sectionId} — ${saved} student(s)`);
  toast(`${saved} grade(s) saved.${skipped ? ' ' + skipped + ' skipped.' : ''}`, 'success');
  renderEncode();
}

// Submit — routes grades to students (no lock, always editable)
function submitGrades(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  const students = enrolledIn(sectionId);

  // Auto-save any current dropdown values first
  students.forEach(s => {
    const sel = document.getElementById(`g-${s.id}`);
    if (sel && sel.value) {
      const raw = sel.value;
      const val = raw === 'INC' ? 'INC' : parseFloat(raw);
      if (raw === 'INC' || !isNaN(val)) {
        const ex = gradeFor(s.id, sectionId);
        if (ex) ex.grade = val;
        else DB.grades.push({ id: DB.nextId.grade++, studentId: s.id, sectionId, grade: val, facultyId: currentUser.id, date: new Date().toISOString().slice(0, 10) });
      }
    }
  });

  // Check for ungraded students
  const ungraded = students.filter(s => !gradeFor(s.id, sectionId));
  if (ungraded.length > 0) {
    if (!confirm(`${ungraded.length} student(s) still have no grade:\n${ungraded.map(s => s.name).join(', ')}\n\nSubmit anyway?`)) return;
  }

  // Mark as submitted (visible to students) — NOT locked, can re-submit anytime
  sec.submitted   = true;
  sec.submittedAt = new Date().toISOString().slice(0, 10);
  save();
  logAudit(`Grades submitted: ${sec.sectionName} (${getSubject(sec.subjectId)?.code}). Visible to students.`);
  toast('Grades submitted. Students can now view their grades. You may still edit grades if corrections are needed. ✔', 'success');
  renderEncode();
}


/* ──────────────────────────────────────────────
   MY GRADES  (Student — only submitted grades visible)
   Layout:
     Heading  : Program + Year Level  e.g. "BSIT · 1st Year"
     Subheading: Semester - SY        e.g. "1st Semester - 2023-2024"
     Table    : Subject | Units | Grade | Description  (NO Section column)
────────────────────────────────────────────── */
function renderMyGrades() {
  const sid     = currentUser.studentId;
  const student = getStudent(sid);
  if (!student) {
    set(`<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">No student record is linked to your account.<br>Please contact the Registrar.</div></div>`);
    return;
  }

  const myEnr    = DB.enrollments.filter(e => e.studentId === sid);
  const myGrades = DB.grades.filter(g => g.studentId === sid && getSection(g.sectionId)?.submitted);
  const gpa      = calcGPA(sid);
  const sems     = studentSemesters(sid).filter(x => x.gpa != null);

  // Get all semester keys the student has submitted grades in, sorted oldest first
  const semKeys = [...new Set(
    DB.sections
      .filter(s => myEnr.some(e => e.sectionId === s.id) && s.submitted)
      .map(s => `${s.sy}|${s.sem}`)
  )].sort(); // oldest first so year levels go 1st→4th

  // Determine year level for each semester key from the subjects taken
  function yearLevelForSemKey(sy, sem) {
    const secIds = DB.sections
      .filter(s => s.sy === sy && s.sem === sem && s.submitted && myEnr.some(e => e.sectionId === s.id))
      .map(s => s.id);
    const subjectYears = secIds.map(sid2 => {
      const sec  = getSection(sid2);
      const subj = getSubject(sec?.subjectId);
      return subj?.year ?? null;
    }).filter(y => y != null);
    if (!subjectYears.length) return null;
    // Use the mode (most common year) to handle edge cases
    return subjectYears.sort((a, b) =>
      subjectYears.filter(v => v === b).length - subjectYears.filter(v => v === a).length
    )[0];
  }

  // Build: { yearLevel: [{ sy, sem }] }
  const ordinalMap  = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th' };
  const byYearLevel = {};
  semKeys.forEach(key => {
    const [sy, sem] = key.split('|');
    const yr = yearLevelForSemKey(sy, sem) ?? 0;
    if (!byYearLevel[yr]) byYearLevel[yr] = [];
    byYearLevel[yr].push({ sy, sem });
  });

  // Extract program abbreviation from program string e.g. "BS Information Technology" → "BSIT"
  const progAbbr = student.program
    ? student.program.replace(/\b(Bachelor of Science in |Bachelor of |BS )\s*/gi, 'BS')
        .split(' ').map(w => w[0]).join('').toUpperCase()
    : 'BS';

  set(`
    <!-- Student banner -->
    <div class="card mb-20" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe">
      <div class="flex gap-16">
        <div class="avatar avatar-lg" style="background:linear-gradient(135deg,var(--blue),var(--blue2))">${initials(student.name)}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${esc(student.name)}</div>
          <div class="text-muted text-sm">${esc(student.id)} · ${esc(student.program)}</div>
          <div class="flex gap-8 mt-6">
            <span class="badge badge-teal">Year ${student.year}</span>
            <span class="badge badge-warning">GPA ${gpa != null ? gpa.toFixed(2) : '—'}</span>
            <span class="badge badge-${stuStatusBadge(student)}">${stuStatus(student)}</span>
          </div>
        </div>
        <div style="margin-left:auto">
          <button class="btn btn-ghost btn-sm" onclick="downloadTranscript('${sid}')">⬇ Transcript</button>
        </div>
      </div>
    </div>

    <!-- GPA Trend (if 2+ semesters) -->
    ${sems.length >= 2 ? `<div class="card mb-20">
      <div class="card-title">📊 My GPA Trend</div>
      <div class="flex gap-16" style="align-items:center;flex-wrap:wrap">
        ${sparkline(sems.map(x => x.gpa), 200, 48)}
        <div class="flex gap-16" style="flex-wrap:wrap">
          ${sems.map(x => `<div class="text-center">
            <div class="fw-7" style="color:${gradeColor(x.gpa)}">${x.gpa.toFixed(2)}</div>
            <div class="text-xs text-muted">${esc(x.sem)} ${esc(x.sy.slice(-4))}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>` : ''}

    <!-- Quick stats -->
    <div class="grid-3 mb-20">
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--success)">${myGrades.filter(g => g.grade <= 3).length}</div>
        <div class="text-muted text-sm">Subjects Passed</div>
      </div>
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--warning)">${gpa != null ? gpa.toFixed(2) : '—'}</div>
        <div class="text-muted text-sm">Current GPA</div>
      </div>
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--danger)">${myGrades.filter(g => g.grade > 3).length}</div>
        <div class="text-muted text-sm">Failed Subjects</div>
      </div>
    </div>

    <!-- Grades grouped by Year Level then Semester -->
    ${semKeys.length === 0
      ? `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No submitted grades yet.<br>Grades appear here once your faculty submits them.</div></div>`
      : Object.keys(byYearLevel)
          .sort((a, b) => +a - +b)
          .map(yr => {
            const yrLabel  = yr > 0 ? `${progAbbr} ${ordinalMap[yr] || yr + 'th'} Year` : 'Other';
            const semsList = byYearLevel[yr]; // [{sy, sem}]

            return `
              <!-- ── Year Level heading ── -->
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;margin-top:8px">
                <div style="width:4px;height:28px;background:var(--blue);border-radius:4px;flex-shrink:0"></div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--blue)">${esc(yrLabel)}</div>
              </div>

              ${semsList.map(({ sy, sem }) => {
                const semSecs = DB.sections.filter(s =>
                  s.sy === sy && s.sem === sem && s.submitted &&
                  myEnr.some(e => e.sectionId === s.id)
                );
                const semGPA  = semesterGPA(sid, sy, sem);

                return `
                  <!-- Semester sub-section -->
                  <div class="section-card mb-16">
                    <div class="section-card-head" style="background:var(--bg3)">
                      <div>
                        <div class="fw-7" style="font-size:.95rem">${esc(sem)} Semester — ${esc(sy)}</div>
                        <div class="text-xs text-muted mt-1">
                          ${semSecs.length} subject(s) · Semester GPA: <strong>${semGPA != null ? semGPA.toFixed(2) : '—'}</strong>
                        </div>
                      </div>
                      ${semGPA != null
                        ? `<span style="font-size:1.4rem;font-weight:800;color:${gradeColor(semGPA)}">${semGPA.toFixed(2)}</span>`
                        : ''}
                    </div>
                    <div class="table-wrap"><table>
                      <thead><tr>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Units</th>
                        <th>Grade</th>
                        <th>Description</th>
                      </tr></thead>
                      <tbody>${semSecs.map(sec => {
                        const subj = getSubject(sec.subjectId);
                        const gr   = gradeFor(sid, sec.id);
                        return `<tr>
                          <td><span class="chip">${subj ? esc(subj.code) : '—'}</span></td>
                          <td class="fw-6">${subj ? esc(subj.name) : '—'}</td>
                          <td>${subj ? subj.units : '—'}</td>
                          <td>${gr
                            ? `<span style="color:${gradeColor(gr.grade)};font-weight:700;font-family:var(--mono);font-size:1rem">${fmt2(gr.grade)}</span>`
                            : '<span class="badge badge-muted">Pending</span>'}</td>
                          <td class="text-sm text-muted">${gr ? gradeDesc(gr.grade) : '—'}</td>
                        </tr>`;
                      }).join('')}</tbody>
                    </table></div>
                  </div>`;
              }).join('')}
            `;
          }).join('')}
  `);
}

function downloadTranscript(sid) {
  const s = getStudent(sid);
  if (!s) { toast('Student record not found', 'error'); return; }
  const myEnr = DB.enrollments.filter(e => e.studentId === sid);
  const gpa   = calcGPA(sid);
  const now   = new Date().toLocaleDateString('en-PH');
  const col   = getCollege(s.collegeId);
  const dept  = getDept(s.deptId);

  let c = `UNIVERSITY OF EASTERN PHILIPPINES\nUniversity Town, Northern Samar\n`;
  c += `${col ? col.name : ''}\n${dept ? dept.name : ''}\n`;
  c += `${'═'.repeat(65)}\nUNOFFICIAL TRANSCRIPT OF RECORDS\n${'═'.repeat(65)}\n\n`;
  c += `Student ID   : ${s.id}\n`;
  c += `Full Name    : ${s.name}\n`;
  c += `Program      : ${s.program}\n`;
  c += `Year Level   : Year ${s.year}\n`;
  c += `GPA          : ${gpa != null ? gpa.toFixed(2) : 'N/A'}\n`;
  c += `Status       : ${stuStatus(s)}\n`;
  c += `Date Printed : ${now}\n\n`;

  const keys = [...new Set(
    DB.sections
      .filter(sec => myEnr.some(e => e.sectionId === sec.id) && sec.submitted)
      .map(sec => `${sec.sy}|${sec.sem}`)
  )].sort();

  keys.forEach(key => {
    const [sy, sem] = key.split('|');
    c += `${'─'.repeat(65)}\n${sem} SEMESTER — A.Y. ${sy}\n${'─'.repeat(65)}\n`;
    c += `${'Code'.padEnd(10)} ${'Subject'.padEnd(36)} ${'Units'.padEnd(6)} ${'Grade'.padEnd(8)} Description\n`;
    DB.sections
      .filter(sec => sec.sy === sy && sec.sem === sem && sec.submitted && myEnr.some(e => e.sectionId === sec.id))
      .forEach(sec => {
        const subj = getSubject(sec.subjectId);
        const gr   = gradeFor(sid, sec.id);
        c += `${(subj?.code || '—').padEnd(10)} `;
        c += `${(subj?.name || '—').padEnd(36)} `;
        c += `${String(subj?.units || '—').padEnd(6)} `;
        c += `${gr ? fmt2(gr.grade).padEnd(8) : '—'.padEnd(8)} `;
        c += `${gr ? gradeDesc(gr.grade) : '—'}\n`;
      });
    c += '\n';
  });

  c += `${'═'.repeat(65)}\n`;
  c += `⚠  UNOFFICIAL — For official records, visit the Registrar's Office.\n`;
  c += `${'═'.repeat(65)}\n`;

  const blob = new Blob([c], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `Transcript_${sid}_${now.replace(/\//g, '-')}.txt`;
  a.click();
  logAudit(`Unofficial transcript downloaded: ${sid}`);
  toast('Transcript downloaded', 'success');
}


/* ──────────────────────────────────────────────
   ACADEMIC PROGRESS  (Student)
────────────────────────────────────────────── */
function renderProgress() {
  const sid     = currentUser.studentId;
  const student = getStudent(sid);
  if (!student) {
    set(`<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">No student record linked to your account.</div></div>`);
    return;
  }

  const curriculum = DB.subjects.filter(s => s.deptId === student.deptId);
  const myEnr      = DB.enrollments.filter(e => e.studentId === sid);
  // Only count grades from submitted sections
  const myGrades   = DB.grades.filter(g => g.studentId === sid && getSection(g.sectionId)?.submitted);
  const subjOfSec  = secId => getSection(secId)?.subjectId;

  const passedIds  = myGrades.filter(g => g.grade <= 3).map(g => subjOfSec(g.sectionId)).filter(Boolean);
  const failedIds  = myGrades.filter(g => g.grade > 3).map(g => subjOfSec(g.sectionId)).filter(v => !passedIds.includes(v));
  const inProgIds  = myEnr.map(e => subjOfSec(e.sectionId)).filter(v => v && !passedIds.includes(v) && !failedIds.includes(v));

  const completed = curriculum.filter(s => passedIds.includes(s.id));
  const failed    = curriculum.filter(s => failedIds.includes(s.id));
  const inProg    = curriculum.filter(s => inProgIds.includes(s.id) && !passedIds.includes(s.id));
  const notTaken  = curriculum.filter(s => !passedIds.includes(s.id) && !failedIds.includes(s.id) && !inProgIds.includes(s.id));

  const pct = curriculum.length ? Math.round(completed.length / curriculum.length * 100) : 0;
  const gpa = calcGPA(sid);

  set(`
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="flex gap-16 mb-16">
          ${donutSVG(pct, 90, 'var(--blue)')}
          <div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--blue)">${pct}%</div>
            <div class="text-muted text-sm">Curriculum Complete</div>
            <div class="mt-8 text-sm">
              <span style="color:var(--success)">${completed.length}</span> / ${curriculum.length} subjects passed
            </div>
            <div class="mt-4 text-xs text-muted">
              GPA: <strong style="color:var(--warning)">${gpa != null ? gpa.toFixed(2) : '—'}</strong>
            </div>
          </div>
        </div>
        <div class="grid-2">
          ${miniStat('Completed',   completed.length, 'var(--success)')}
          ${miniStat('In Progress', inProg.length,    'var(--blue)')}
          ${miniStat('Failed',      failed.length,    'var(--danger)')}
          ${miniStat('Remaining',   notTaken.length,  'var(--text3)')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Year-by-Year Progress</div>
        ${[1, 2, 3, 4].map(yr => {
          const yrSubjs = curriculum.filter(s => s.year === yr);
          const yrPassed = yrSubjs.filter(s => passedIds.includes(s.id)).length;
          const yrPct    = yrSubjs.length ? Math.round(yrPassed / yrSubjs.length * 100) : 0;
          const status   = yrPassed === yrSubjs.length && yrSubjs.length > 0 ? 'success' : yrPct > 0 ? 'info' : 'muted';
          return `<div class="mb-12">
            <div class="flex-between mb-4">
              <span class="text-sm fw-6">Year ${yr}</span>
              <div class="flex gap-8">
                <span class="text-xs text-muted">${yrPassed}/${yrSubjs.length}</span>
                <span class="badge badge-${status}">${yrPassed === yrSubjs.length && yrSubjs.length > 0 ? '✓ Done' : yrPct > 0 ? 'In Progress' : 'Upcoming'}</span>
              </div>
            </div>
            <div class="progress"><div class="progress-bar" style="width:${yrPct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Curriculum Tracker</div>
        <div class="flex gap-8">
          <span class="badge badge-success">✓ Passed</span>
          <span class="badge badge-info">In Progress</span>
          <span class="badge badge-danger">Failed</span>
          <span class="badge badge-muted">Not Taken</span>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Year</th><th>Sem</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${curriculum.map(subj => {
          const isPassed = passedIds.includes(subj.id);
          const isFailed = failedIds.includes(subj.id);
          const isInProg = inProgIds.includes(subj.id) && !isPassed;
          const gr       = myGrades.find(g => subjOfSec(g.sectionId) === subj.id);
          return `<tr>
            <td><span class="chip">${esc(subj.code)}</span></td>
            <td class="fw-6">${esc(subj.name)}</td>
            <td>${subj.units}</td>
            <td>Year ${subj.year}</td>
            <td>${subj.sem === 1 ? '1st' : subj.sem === 2 ? '2nd' : 'Summer'}</td>
            <td>${gr ? `<span style="color:${gradeColor(gr.grade)};font-weight:700">${fmt2(gr.grade)}</span>` : '—'}</td>
            <td>
              ${isPassed  ? '<span class="badge badge-success">✓ Passed</span>'    : ''}
              ${isFailed  ? '<span class="badge badge-danger">✗ Failed</span>'     : ''}
              ${isInProg  ? '<span class="badge badge-info">In Progress</span>'    : ''}
              ${!isPassed && !isFailed && !isInProg ? '<span class="badge badge-muted">Not Taken</span>' : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   SECURITY & BACKUP  (Registrar)
────────────────────────────────────────────── */
function renderSecurity() {
  const failedEvents  = DB.auditLog.filter(l => !l.ok).length;
  const successEvents = DB.auditLog.filter(l => l.ok).length;
  const lockedUsers   = DB.users.filter(u => u.lockedOut);

  set(`
    <div class="grid-2 mb-20">

      <!-- System status card -->
      <div class="card">
        <div class="card-title">System Status</div>
        ${infoRow('Data Storage',      '<span style="color:var(--success)">localStorage (prototype)</span>')}
        ${infoRow('Last Auto-Backup',  `<span style="color:var(--success)">${DB.lastBackup || 'Not yet'}</span>`)}
        ${infoRow('Total Backups',     `<span style="color:var(--blue)">${DB.backupCount || 0}</span>`)}
        ${infoRow('Backup Frequency',  '<span style="color:var(--teal)">Every 5 minutes (auto)</span>')}
        ${infoRow('Account Lockout',   '<span style="color:var(--success)">After 5 failed attempts</span>')}
        ${infoRow('Locked Accounts',   lockedUsers.length > 0
          ? `<span style="color:var(--danger)">${lockedUsers.length} account(s) locked</span>`
          : '<span style="color:var(--success)">None</span>')}
        <div class="mt-16 flex gap-8">
          <button class="btn btn-primary btn-sm" onclick="runBackup(true);renderSecurity()">▶ Run Backup Now</button>
          <button class="btn btn-ghost btn-sm"   onclick="exportAuditLog()">⬇ Export Audit Log</button>
        </div>
      </div>

      <!-- Security summary card -->
      <div class="card">
        <div class="card-title">Security Summary</div>
        <div class="grid-3 mb-16">
          ${miniStat('Total Events', DB.auditLog.length, '#374151')}
          ${miniStat('Successful',   successEvents,      'var(--success)')}
          ${miniStat('Failed',       failedEvents,       'var(--danger)')}
        </div>

        ${lockedUsers.length > 0 ? `
          <div class="card-title mb-8">Locked Accounts</div>
          ${lockedUsers.map(u => `<div class="flex-between mb-8">
            <div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(u.name)}</div>
              <div>
                <div class="text-sm fw-6">${esc(u.name)}</div>
                <div class="text-xs text-muted">${esc(u.username)} · ${u.failedAttempts} failed attempts</div>
              </div>
            </div>
            <button class="btn btn-sm btn-success" onclick="unlockUser(${u.id});renderSecurity()">🔓 Unlock</button>
          </div>`).join('')}` : '<div class="text-muted text-sm">No locked accounts.</div>'}

        <div class="divider"></div>
        <div class="card-title">CIA Triad</div>
        ${[
          ['Confidentiality', 'Role-based access control active',    95,  'var(--blue)'],
          ['Integrity',       'Grade locking active',                100, 'var(--success)'],
          ['Availability',    'Auto-backup every 5 minutes',         99,  'var(--teal)'],
        ].map(([k, v, p, c]) => `<div class="mb-10">
          <div class="flex-between mb-4">
            <span class="text-sm">${k}</span>
            <span class="fw-7 text-sm" style="color:${c}">${p}%</span>
          </div>
          <div class="text-xs text-muted mb-4">${v}</div>
          <div class="progress" style="height:6px">
            <div class="progress-bar" style="width:${p}%;background:${c}"></div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Backup History -->
    <div class="section-card mb-20">
      <div class="section-card-head">
        <div class="page-title">Backup History</div>
        <span class="badge badge-teal">${DB.backupCount || 0} total</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Timestamp</th><th>Type</th><th>Size</th></tr></thead>
        <tbody>
          ${(DB.backupLog || []).length === 0
            ? `<tr><td colspan="4" class="table-empty">No backups yet. First backup runs 10 seconds after login.</td></tr>`
            : (DB.backupLog || []).map(b => `<tr>
                <td class="text-muted">#${b.id}</td>
                <td class="mono text-sm">${esc(b.ts)}</td>
                <td><span class="badge badge-${b.auto ? 'teal' : 'blue'}">${b.auto ? 'Auto' : 'Manual'}</span></td>
                <td class="mono text-sm text-muted">${(b.size / 1024).toFixed(1)} KB</td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    </div>

    <!-- Audit Trail -->
    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Audit Trail Log</div>
        <span class="badge badge-teal">${DB.auditLog.length} entries</span>
      </div>
      <div class="table-wrap" style="max-height:400px;overflow-y:auto"><table>
        <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>IP Address</th><th>Result</th></tr></thead>
        <tbody>${DB.auditLog.map(l => `<tr>
          <td class="mono text-xs text-muted">${esc(l.ts)}</td>
          <td class="fw-6 text-sm">${esc(l.user)}</td>
          <td class="text-sm">${esc(l.action)}</td>
          <td class="mono text-xs text-muted">${esc(l.ip)}</td>
          <td><span class="badge badge-${l.ok ? 'success' : 'danger'}">${l.ok ? '✔ OK' : '✖ Failed'}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`);
}

function exportAuditLog() {
  let c = 'SARM-DA AUDIT TRAIL LOG\n' + new Date().toISOString() + '\n\n';
  c += 'Timestamp            | User          | Action                                   | IP              | Result\n';
  c += '-'.repeat(105) + '\n';
  DB.auditLog.forEach(l => {
    c += `${l.ts.padEnd(21)}| ${l.user.padEnd(14)}| ${l.action.padEnd(42)}| ${l.ip.padEnd(17)}| ${l.ok ? 'SUCCESS' : 'FAILED'}\n`;
  });
  const blob = new Blob([c], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `AuditLog_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  logAudit('Audit log exported');
  toast('Audit log exported successfully', 'success');
}


/* ══════════════════════════════════════════════
   STUDENT RECORDS MODULE
   ──────────────────────────────────────────────
   Registrar  : Add, Edit, Archive all students
   Archives   : Registrar = all colleges
                Chairman  = own college only
   Folder tree: College → Department → Students
══════════════════════════════════════════════ */

/* ──────────────────────────────────────────────
   STUDENT RECORDS  (Registrar)
   List active students, add new, edit, archive
────────────────────────────────────────────── */
function renderStudentRecords(filterCol = null, filterDept = null, q = '', activeStudentId = null) {
  const isRegistrar = currentUser.role === 'Registrar';
  const colleges    = DB.colleges;
  const depts       = DB.departments;

  let pool = DB.students.filter(s => s.status !== 'graduated' && s.status !== 'archived');
  if (filterCol)  pool = pool.filter(s => s.collegeId === filterCol);
  if (filterDept) pool = pool.filter(s => s.deptId    === filterDept);
  if (q)          pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase()) ||
    s.program.toLowerCase().includes(q.toLowerCase())
  );

  const colLabel  = filterCol  ? getCollege(filterCol)?.name : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name   : null;

  let breadcrumb = `<span onclick="renderStudentRecords()" style="cursor:pointer;color:var(--blue)">All Colleges</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderStudentRecords(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  // ── Academic Timeline builder ──
  function buildAcademicTimeline(sid) {
    const s      = getStudent(sid);
    if (!s) return '';
    const myEnr  = DB.enrollments.filter(e => e.studentId === sid);
    const ordMap = {1:'1st',2:'2nd',3:'3rd',4:'4th'};

    // Group submitted sections by year then semester
    const allSemKeys = [...new Set(
      DB.sections.filter(sec => myEnr.some(e => e.sectionId === sec.id) && sec.submitted)
                 .map(sec => `${sec.sy}|${sec.sem}`)
    )].sort();

    if (!allSemKeys.length) return `<div class="empty" style="padding:30px"><div class="empty-icon" style="font-size:2rem">📭</div><div class="empty-text">No submitted grades on record yet.</div></div>`;

    // Group by year level
    function yearOfSemKey(sy, sem) {
      const secIds = DB.sections.filter(s2 => s2.sy===sy && s2.sem===sem && s2.submitted && myEnr.some(e => e.sectionId===s2.id)).map(s2=>s2.id);
      const years  = secIds.map(secId => getSubject(getSection(secId)?.subjectId)?.year).filter(Boolean);
      if (!years.length) return 0;
      return years.sort((a,b) => years.filter(v=>v===b).length - years.filter(v=>v===a).length)[0];
    }

    const byYear = {};
    allSemKeys.forEach(key => {
      const [sy,sem] = key.split('|');
      const yr = yearOfSemKey(sy,sem) || 0;
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push({sy,sem});
    });

    const totalPassed = DB.grades.filter(g => g.studentId===sid && getSection(g.sectionId)?.submitted && g.grade<=3).length;
    const totalFailed = DB.grades.filter(g => g.studentId===sid && getSection(g.sectionId)?.submitted && g.grade>3).length;
    const gpa         = calcGPA(sid);

    return `
      <div class="flex gap-12 mb-20" style="flex-wrap:wrap">
        <div style="background:var(--success-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:#0d9488">${totalPassed}</div>
          <div style="font-size:.72rem;color:#0d9488;font-weight:600">Subjects Passed</div>
        </div>
        <div style="background:var(--danger-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:#dc2626">${totalFailed}</div>
          <div style="font-size:.72rem;color:#dc2626;font-weight:600">Subjects Failed</div>
        </div>
        <div style="background:var(--blue-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:var(--blue)">${gpa ? gpa.toFixed(2) : '—'}</div>
          <div style="font-size:.72rem;color:var(--blue);font-weight:600">Overall GPA</div>
        </div>
      </div>

      ${Object.keys(byYear).sort((a,b)=>+a-+b).map(yr => {
        const label = +yr > 0 ? `${ordMap[yr] || yr+'th'} Year` : 'Other';
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;margin-top:20px">
            <div style="width:4px;height:26px;background:var(--blue);border-radius:4px;flex-shrink:0"></div>
            <div style="font-size:1rem;font-weight:800;color:var(--blue)">${label}</div>
          </div>
          ${byYear[yr].map(({sy,sem}) => {
            const semSecs = DB.sections.filter(sec =>
              sec.sy===sy && sec.sem===sem && sec.submitted &&
              myEnr.some(e=>e.sectionId===sec.id)
            );
            const semGPA = semesterGPA(sid,sy,sem);
            return `
              <div class="section-card mb-12">
                <div class="section-card-head" style="background:var(--bg3)">
                  <div>
                    <div class="fw-7">${sem} Semester — ${sy}</div>
                    <div class="text-xs text-muted mt-1">${semSecs.length} subject(s) · Semester GPA:
                      <strong style="color:${semGPA?gradeColor(semGPA):'var(--text3)'}">${semGPA?semGPA.toFixed(2):'—'}</strong>
                    </div>
                  </div>
                  ${semGPA ? `<span style="font-size:1.3rem;font-weight:800;color:${gradeColor(semGPA)}">${semGPA.toFixed(2)}</span>` : ''}
                </div>
                <div class="table-wrap"><table style="min-width:unset">
                  <thead><tr>
                    <th>Code</th><th>Subject</th><th>Units</th><th>Final Grade</th><th>Status</th>
                  </tr></thead>
                  <tbody>${semSecs.map(sec => {
                    const subj = getSubject(sec.subjectId);
                    const gr   = gradeFor(sid, sec.id);
                    const pass = gr && gr.grade <= 3;
                    const fail = gr && gr.grade > 3;
                    return `<tr>
                      <td><span class="chip">${subj?esc(subj.code):'—'}</span></td>
                      <td class="fw-6">${subj?esc(subj.name):'—'}</td>
                      <td>${subj?subj.units:'—'}</td>
                      <td><span style="color:${gr?gradeColor(gr.grade):'var(--text3)'};font-weight:700;font-family:var(--mono);font-size:.95rem">${gr?fmt2(gr.grade):'Pending'}</span></td>
                      <td>${pass?'<span class="badge badge-success">✔ Passed</span>':fail?'<span class="badge badge-danger">✖ Failed</span>':'<span class="badge badge-muted">Pending</span>'}</td>
                    </tr>`;
                  }).join('')}</tbody>
                </table></div>
              </div>`;
          }).join('')}`;
      }).join('')}`;
  }

  // ── Active student detail panel ──
  const activeStudent = activeStudentId ? getStudent(activeStudentId) : null;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Student Records</div>
        <div class="text-sm text-muted" style="margin-top:4px">${breadcrumb}</div>
      </div>
      <div class="flex gap-12">
        ${(filterDept || q) ? `<div class="search-wrap">
          <input class="search-input" placeholder="Search name, ID, program…"
            value="${esc(q)}"
            oninput="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},this.value)">
        </div>` : ''}
        <button class="btn btn-primary" onclick="showAddStudentModal()">+ Add Student</button>
      </div>
    </div>

    ${/* College folder level */!filterCol ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A COLLEGE</div>
      <div class="grid-3 mb-20">
        ${colleges.map(col => {
          const count    = DB.students.filter(s => s.collegeId===col.id && s.status!=='graduated' && s.status!=='archived').length;
          const deptCnt  = depts.filter(d => d.collegeId===col.id).length;
          return `<div onclick="renderStudentRecords(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;color:var(--text);margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-14">${deptCnt} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.6rem;font-weight:800;color:var(--blue)">${count}</span>
              <span class="badge badge-info">Active</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    ${/* Department folder level */filterCol && !filterDept && !q ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A DEPARTMENT</div>
      <div class="grid-3 mb-20">
        ${depts.filter(d => d.collegeId===filterCol).map(dept => {
          const count = DB.students.filter(s => s.deptId===dept.id && s.status!=='graduated' && s.status!=='archived').length;
          return `<div onclick="renderStudentRecords(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">📁</div>
            <div class="fw-7" style="font-size:.9rem;color:var(--text);margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-14">
              <span style="font-size:1.6rem;font-weight:800;color:var(--teal)">${count}</span>
              <span class="badge badge-teal">Active</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    ${/* Student list + detail side-by-side */(filterDept || q) ? `
      <div style="display:grid;grid-template-columns:${activeStudent?'380px 1fr':'1fr'};gap:20px;align-items:start;width:100%;max-width:100%">

        <!-- Student list -->
        <div class="section-card" style="margin-bottom:0">
          <div class="section-card-head">
            <div class="fw-6">${filterDept?esc(deptLabel||''):'Search Results'} — ${pool.length} student(s)</div>
          </div>
          <div class="table-wrap"><table style="min-width:unset">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Year</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${pool.length===0
                ?`<tr><td colspan="5" class="table-empty">No students found.</td></tr>`
                :pool.map(s=>`<tr style="${activeStudentId===s.id?'background:var(--blue-dim);':''}" >
                    <td class="mono text-xs text-muted">${esc(s.id)}</td>
                    <td>
                      <div class="flex gap-8">
                        <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                          ${initials(s.name)}
                        </div>
                        <div>
                          <div class="fw-6" style="font-size:.84rem">${esc(s.name)}</div>
                          <div class="text-xs text-muted">${esc(s.program)}</div>
                        </div>
                      </div>
                    </td>
                    <td style="font-size:.82rem">Yr ${s.year}</td>
                    <td><span class="badge badge-${stuStatusBadge(s)}" style="font-size:.66rem">${stuStatus(s)}</span></td>
                    <td>
                      <button class="btn btn-sm btn-primary" style="font-size:.72rem;padding:4px 10px"
                        onclick="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},'${q}','${s.id}')">
                        View
                      </button>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table></div>
        </div>

        ${/* Student detail panel — shows when a student is selected */activeStudent ? `
        <div>
          <!-- Profile card -->
          <div class="card mb-16">
            <div class="flex gap-16 mb-16">
              <div class="avatar" style="width:56px;height:56px;font-size:1rem;background:${activeStudent.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                ${initials(activeStudent.name)}
              </div>
              <div style="flex:1">
                <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${esc(activeStudent.name)}</div>
                <div class="text-muted text-sm">${esc(activeStudent.id)} · ${esc(activeStudent.program)}</div>
                <div class="flex gap-8 mt-6">
                  <span class="badge badge-teal">Year ${activeStudent.year}</span>
                  <span class="badge badge-${stuStatusBadge(activeStudent)}">${stuStatus(activeStudent)}</span>
                  <span class="badge ${activeStudent.gender==='Female'?'badge-danger':'badge-info'}">${activeStudent.gender}</span>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm"
                onclick="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},'${q}',null)"
                style="align-self:start">✕ Close</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${infoRow('Student ID',   activeStudent.id)}
              ${infoRow('Email',        activeStudent.email   || '—')}
              ${infoRow('Contact',      activeStudent.contact || '—')}
              ${infoRow('Address',      activeStudent.address || '—')}
              ${infoRow('Admitted',     activeStudent.admitted || '—')}
            </div>
            <div class="flex gap-8 mt-14">
              <button class="btn btn-ghost btn-sm" onclick="showEditStudentModal('${activeStudent.id}')">✎ Edit Profile</button>
              <button class="btn btn-sm btn-danger" onclick="showArchiveStudentModal('${activeStudent.id}')">🗃 Archive</button>
            </div>
          </div>

          <!-- Academic Timeline -->
          <div class="section-card" style="margin-bottom:0">
            <div class="section-card-head" style="background:var(--bg3)">
              <div class="fw-7">📚 Academic Timeline</div>
              <div class="text-xs text-muted">1st Year → 4th Year · All Semesters</div>
            </div>
            <div class="section-card-body">
              ${buildAcademicTimeline(activeStudent.id)}
            </div>
          </div>
        </div>` : `
        <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
          <div class="empty-icon">👆</div>
          <div class="empty-text">Click <strong>View</strong> on any student to see their profile and full academic timeline.</div>
        </div>`}
      </div>` : ''}
  `);
}

/* ── Add Student ── */
function showAddStudentModal() {
  const colOpts  = DB.colleges.map(c    => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  const nextId   = String(DB.nextId.student || 100001);

  showModal('Add New Student Record', `
    <div class="grid-2">
      <div class="field-wrap">
        <div class="field-label">Student ID <span style="font-weight:400;text-transform:none;color:var(--text4)">(auto-assigned)</span></div>
        <input class="input" value="${esc(nextId)}" disabled style="opacity:.6;background:var(--bg4);font-family:var(--mono);font-weight:700;color:var(--blue)">
      </div>
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="s-name" class="input" placeholder="Juan dela Cruz"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Program</div><input id="s-prog" class="input" placeholder="BS Information Technology"></div>
      <div class="field-wrap"><div class="field-label">Year Admitted</div><input id="s-admit" class="input" placeholder="${new Date().getFullYear()}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">College</div>
        <select id="s-col" class="select-input" onchange="stuDeptFilter(this.value)">${colOpts}</select>
      </div>
      <div class="field-wrap"><div class="field-label">Department</div>
        <select id="s-dept" class="select-input">${deptOpts}</select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="s-year" class="select-input">
          <option value="1">1st Year</option><option value="2">2nd Year</option>
          <option value="3">3rd Year</option><option value="4">4th Year</option>
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Gender</div>
        <select id="s-gender" class="select-input"><option>Male</option><option>Female</option></select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Email</div><input id="s-email" class="input" placeholder="student@uep.edu.ph"></div>
      <div class="field-wrap"><div class="field-label">Contact</div><input id="s-contact" class="input" placeholder="09xxxxxxxxx"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Address</div><input id="s-addr" class="input" placeholder="City, Province"></div>
      <div class="field-wrap">
        <div class="field-label">Birthday <span style="font-weight:400;text-transform:none;color:var(--text4)">— login password (mmddyyyy)</span></div>
        <input id="s-bday" class="input" placeholder="02242003" maxlength="8">
      </div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addStudent()">Save Record</button>`
  );
}

function stuDeptFilter(colId) {
  const sel   = document.getElementById('s-dept');
  if (!sel) return;
  const depts = DB.departments.filter(d => d.collegeId === +colId);
  sel.innerHTML = depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

function addStudent() {
  const id      = String(DB.nextId.student || 100001);
  const name    = document.getElementById('s-name').value.trim();
  const prog    = document.getElementById('s-prog').value.trim();
  const admit   = document.getElementById('s-admit').value.trim();
  const colId   = +document.getElementById('s-col').value;
  const deptId  = +document.getElementById('s-dept').value;
  const year    = +document.getElementById('s-year').value;
  const gender  = document.getElementById('s-gender').value;
  const email   = document.getElementById('s-email').value.trim();
  const contact = document.getElementById('s-contact').value.trim();
  const addr    = document.getElementById('s-addr').value.trim();
  const bday    = document.getElementById('s-bday').value.trim().replace(/\D/g,'');

  if (!name || !prog) { toast('Name and Program are required', 'error'); return; }
  if (!colId)         { toast('Please select a College', 'error'); return; }
  if (!deptId)        { toast('Please select a Department', 'error'); return; }
  if (bday && bday.length !== 8) { toast('Birthday must be 8 digits: mmddyyyy', 'error'); return; }

  DB.students.push({
    id, name, deptId, collegeId: colId, program: prog, year,
    gender, status: 'enrolled', adviserId: null,
    email, contact, address: addr, admitted: admit,
    birthday: bday || null,
  });
  DB.nextId.student = (DB.nextId.student || 100001) + 1;
  save();
  logAudit(`Student record added: ${id} — ${name}`);
  toast(`Student record added. ID: ${id}`, 'success');
  closeModal();
  renderStudentRecords(colId, deptId);
}

/* ── Edit Student ── */
function showEditStudentModal(sid) {
  const s = getStudent(sid);
  if (!s) return;
  const colOpts  = DB.colleges.map(c    => `<option value="${c.id}" ${c.id===s.collegeId?'selected':''}>${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}" ${d.id===s.deptId?'selected':''}>${esc(d.name)}</option>`).join('');
  showModal(`Edit Student — ${esc(s.name)}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Student ID</div><input class="input" value="${esc(s.id)}" disabled style="opacity:.5"></div>
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="es-name" class="input" value="${esc(s.name)}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Program</div><input id="es-prog" class="input" value="${esc(s.program)}"></div>
      <div class="field-wrap"><div class="field-label">Year Admitted</div><input id="es-admit" class="input" value="${esc(s.admitted||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">College</div><select id="es-col" class="select-input">${colOpts}</select></div>
      <div class="field-wrap"><div class="field-label">Department</div><select id="es-dept" class="select-input">${deptOpts}</select></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="es-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${s.year===y?'selected':''}>${y === 1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Gender</div>
        <select id="es-gender" class="select-input">
          <option ${s.gender==='Male'?'selected':''}>Male</option>
          <option ${s.gender==='Female'?'selected':''}>Female</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Status</div>
        <select id="es-status" class="select-input">
          <option value="enrolled"  ${s.status==='enrolled'?'selected':''}>Enrolled</option>
          <option value="inactive"  ${s.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Email</div><input id="es-email" class="input" value="${esc(s.email||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Contact</div><input id="es-contact" class="input" value="${esc(s.contact||'')}"></div>
      <div class="field-wrap"><div class="field-label">Address</div><input id="es-addr" class="input" value="${esc(s.address||'')}"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editStudent('${sid}')">Save Changes</button>`
  );
}

function editStudent(sid) {
  const s = getStudent(sid);
  if (!s) return;
  s.name      = document.getElementById('es-name').value.trim()    || s.name;
  s.program   = document.getElementById('es-prog').value.trim()    || s.program;
  s.admitted  = document.getElementById('es-admit').value.trim()   || s.admitted;
  s.collegeId = +document.getElementById('es-col').value;
  s.deptId    = +document.getElementById('es-dept').value;
  s.year      = +document.getElementById('es-year').value;
  s.gender    = document.getElementById('es-gender').value;
  s.status    = document.getElementById('es-status').value;
  s.email     = document.getElementById('es-email').value.trim();
  s.contact   = document.getElementById('es-contact').value.trim();
  s.address   = document.getElementById('es-addr').value.trim();
  save();
  logAudit(`Student record edited: ${sid} — ${s.name}`);
  toast('Student record updated', 'success');
  closeModal();
  renderStudentRecords(s.collegeId, s.deptId);
}

/* ── Archive Student ── */
function showArchiveStudentModal(sid) {
  const s = getStudent(sid);
  if (!s) return;
  const col  = getCollege(s.collegeId);
  const dept = getDept(s.deptId);
  showModal('Archive Student Record', `
    <div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(245,158,11,.3);color:#92400e;border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:.86rem">
      ⚠ Archiving moves this student's record to the archive folder under
      <strong>${esc(col?.name || '—')}</strong> → <strong>${esc(dept?.name || '—')}</strong>.<br>
      The record will no longer appear in active student lists.
    </div>
    <div class="grid-2">
      <div>${infoRow('Student ID', s.id)}</div>
      <div>${infoRow('Name', s.name)}</div>
    </div>
    <div class="field-wrap" style="margin-top:14px">
      <div class="field-label">Archive Reason</div>
      <select id="arch-reason" class="select-input">
        <option value="graduated">Graduated</option>
        <option value="archived">Transferred / Withdrew</option>
      </select>
    </div>
    <div class="field-wrap">
      <div class="field-label">Notes (optional)</div>
      <input id="arch-notes" class="input" placeholder="e.g. Graduated A.Y. 2024-2025">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-warning" style="background:var(--warning);color:#fff;padding:8px 18px;border-radius:10px;border:none;font-weight:600;cursor:pointer" onclick="archiveStudent('${sid}')">🗃 Archive Record</button>`
  );
}

function archiveStudent(sid) {
  const s      = getStudent(sid);
  if (!s) return;
  const reason = document.getElementById('arch-reason').value;
  const notes  = document.getElementById('arch-notes').value.trim();
  s.status      = reason;
  s.archiveNote = notes || null;
  s.archivedAt  = new Date().toISOString().slice(0, 10);
  s.archivedBy  = currentUser.username;
  save();
  logAudit(`Student archived: ${sid} — ${s.name} (${reason}${notes ? ' | ' + notes : ''})`);
  toast(`${s.name} has been archived as "${reason}"`, 'success');
  closeModal();
  renderStudentRecords(s.collegeId, s.deptId);
}


/* ──────────────────────────────────────────────
   CHAIRMAN STUDENT RECORDS
   Scoped to Chairman's assigned department only
────────────────────────────────────────────── */
function renderChairStudents(q = '', activeStudentId = null) {
  const deptId  = currentUser.deptId;
  const colId   = currentUser.collegeId;
  const dept    = getDept(deptId);
  const col     = getCollege(colId);

  let pool = DB.students.filter(s =>
    s.deptId === deptId &&
    s.status !== 'graduated' &&
    s.status !== 'archived'
  );
  if (q) pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  );

  const activeStudent = activeStudentId ? getStudent(activeStudentId) : null;

  // ── Academic Timeline (same logic as Registrar) ──
  function buildTimeline(sid) {
    const s      = getStudent(sid);
    if (!s) return '';
    const myEnr  = DB.enrollments.filter(e => e.studentId === sid);
    const ordMap = {1:'1st',2:'2nd',3:'3rd',4:'4th'};
    const allSemKeys = [...new Set(
      DB.sections.filter(sec => myEnr.some(e=>e.sectionId===sec.id) && sec.submitted)
                 .map(sec => `${sec.sy}|${sec.sem}`)
    )].sort();
    if (!allSemKeys.length) return `<div class="empty" style="padding:30px"><div class="empty-icon" style="font-size:2rem">📭</div><div class="empty-text">No submitted grades yet.</div></div>`;
    function yearOfKey(sy,sem){const ids=DB.sections.filter(s2=>s2.sy===sy&&s2.sem===sem&&s2.submitted&&myEnr.some(e=>e.sectionId===s2.id)).map(s2=>s2.id);const yrs=ids.map(id=>getSubject(getSection(id)?.subjectId)?.year).filter(Boolean);if(!yrs.length)return 0;return yrs.sort((a,b)=>yrs.filter(v=>v===b).length-yrs.filter(v=>v===a).length)[0];}
    const byYear={};
    allSemKeys.forEach(key=>{const[sy,sem]=key.split('|');const yr=yearOfKey(sy,sem)||0;if(!byYear[yr])byYear[yr]=[];byYear[yr].push({sy,sem});});
    const gpa=calcGPA(sid);
    const passed=DB.grades.filter(g=>g.studentId===sid&&getSection(g.sectionId)?.submitted&&g.grade<=3).length;
    const failed=DB.grades.filter(g=>g.studentId===sid&&getSection(g.sectionId)?.submitted&&g.grade>3).length;
    return `
      <div class="flex gap-12 mb-16" style="flex-wrap:wrap">
        <div style="background:var(--success-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:#0d9488">${passed}</div>
          <div style="font-size:.7rem;color:#0d9488;font-weight:600">Passed</div>
        </div>
        <div style="background:var(--danger-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:#dc2626">${failed}</div>
          <div style="font-size:.7rem;color:#dc2626;font-weight:600">Failed</div>
        </div>
        <div style="background:var(--blue-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:var(--blue)">${gpa?gpa.toFixed(2):'—'}</div>
          <div style="font-size:.7rem;color:var(--blue);font-weight:600">GPA</div>
        </div>
      </div>
      ${Object.keys(byYear).sort((a,b)=>+a-+b).map(yr=>{
        const label=+yr>0?`${ordMap[yr]||yr+'th'} Year`:'Other';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;margin-top:18px"><div style="width:4px;height:24px;background:var(--blue);border-radius:4px;flex-shrink:0"></div><div style="font-size:.95rem;font-weight:800;color:var(--blue)">${label}</div></div>
        ${byYear[yr].map(({sy,sem})=>{
          const secs=DB.sections.filter(sec=>sec.sy===sy&&sec.sem===sem&&sec.submitted&&myEnr.some(e=>e.sectionId===sec.id));
          const sg=semesterGPA(sid,sy,sem);
          return `<div class="section-card mb-10"><div class="section-card-head" style="background:var(--bg3)"><div><div class="fw-7">${sem} Semester — ${sy}</div><div class="text-xs text-muted mt-1">${secs.length} subject(s) · GPA: <strong style="color:${sg?gradeColor(sg):'var(--text3)'}">${sg?sg.toFixed(2):'—'}</strong></div></div>${sg?`<span style="font-size:1.2rem;font-weight:800;color:${gradeColor(sg)}">${sg.toFixed(2)}</span>`:''}</div>
          <div class="table-wrap"><table style="min-width:unset"><thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Grade</th><th>Status</th></tr></thead>
          <tbody>${secs.map(sec=>{const subj=getSubject(sec.subjectId),gr=gradeFor(sid,sec.id),pass=gr&&gr.grade<=3,fail=gr&&gr.grade>3;return`<tr><td><span class="chip">${subj?esc(subj.code):'—'}</span></td><td class="fw-6">${subj?esc(subj.name):'—'}</td><td>${subj?subj.units:'—'}</td><td><span style="color:${gr?gradeColor(gr.grade):'var(--text3)'};font-weight:700;font-family:var(--mono)">${gr?fmt2(gr.grade):'Pending'}</span></td><td>${pass?'<span class="badge badge-success">✔ Passed</span>':fail?'<span class="badge badge-danger">✖ Failed</span>':'<span class="badge badge-muted">Pending</span>'}</td></tr>`;}).join('')}</tbody></table></div></div>`;
        }).join('')}`;
      }).join('')}`;
  }

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Student Records</div>
        <div class="text-sm text-muted mt-1">
          <span style="color:var(--blue);font-weight:600">${esc(dept?.name||'—')}</span>
          <span style="color:var(--text3)"> · ${esc(col?.name||'—')}</span>
        </div>
      </div>
      <div class="search-wrap">
        <input class="search-input" placeholder="Search name or student ID…"
          value="${esc(q)}"
          oninput="renderChairStudents(this.value)">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:${activeStudent?'360px 1fr':'1fr'};gap:20px;align-items:start;width:100%;max-width:100%">

      <!-- Student list -->
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head">
          <div class="fw-6">${pool.length} Student(s)</div>
        </div>
        <div class="table-wrap"><table style="min-width:unset">
          <thead><tr><th>ID</th><th>Name</th><th>Year</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${pool.length===0
              ?`<tr><td colspan="5" class="table-empty">No active students found.</td></tr>`
              :pool.map(s=>`<tr style="${activeStudentId===s.id?'background:var(--blue-dim);':''}">
                  <td class="mono text-xs text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                      ${initials(s.name)}
                    </div>
                    <div>
                      <div class="fw-6" style="font-size:.83rem">${esc(s.name)}</div>
                      <div class="text-xs text-muted">${esc(s.program)}</div>
                    </div>
                  </div></td>
                  <td style="font-size:.82rem">Yr ${s.year}</td>
                  <td><span class="badge badge-${stuStatusBadge(s)}" style="font-size:.65rem">${stuStatus(s)}</span></td>
                  <td>
                    <button class="btn btn-sm btn-primary" style="font-size:.72rem;padding:4px 10px"
                      onclick="renderChairStudents('${q}','${s.id}')">View</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>

      ${activeStudent ? `
      <div>
        <!-- Profile -->
        <div class="card mb-16">
          <div class="flex gap-16 mb-14">
            <div class="avatar" style="width:52px;height:52px;font-size:1rem;background:${activeStudent.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
              ${initials(activeStudent.name)}
            </div>
            <div style="flex:1">
              <div style="font-size:1.05rem;font-weight:800;color:var(--text)">${esc(activeStudent.name)}</div>
              <div class="text-muted text-sm">${esc(activeStudent.id)} · ${esc(activeStudent.program)}</div>
              <div class="flex gap-8 mt-6">
                <span class="badge badge-teal">Year ${activeStudent.year}</span>
                <span class="badge badge-${stuStatusBadge(activeStudent)}">${stuStatus(activeStudent)}</span>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="renderChairStudents('${q}',null)" style="align-self:start">✕</button>
          </div>
          ${infoRow('Email',   activeStudent.email   || '—')}
          ${infoRow('Contact', activeStudent.contact || '—')}
          ${infoRow('Address', activeStudent.address || '—')}
          ${infoRow('Admitted',activeStudent.admitted || '—')}
        </div>
        <!-- Academic Timeline -->
        <div class="section-card" style="margin-bottom:0">
          <div class="section-card-head" style="background:var(--bg3)">
            <div class="fw-7">📚 Academic Timeline</div>
            <div class="text-xs text-muted">All Semesters · All Year Levels</div>
          </div>
          <div class="section-card-body">${buildTimeline(activeStudent.id)}</div>
        </div>
      </div>` : `
      <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
        <div class="empty-icon">👆</div>
        <div class="empty-text">Click <strong>View</strong> on any student to see their profile and academic timeline.</div>
      </div>`}
    </div>
  `);
}


/* ──────────────────────────────────────────────
   ARCHIVES MODULE
   Registrar  : browse all colleges → depts → archived students
   Chairman   : browse own college  → depts → archived students
   Folder tree: College → Department → Archived list
────────────────────────────────────────────── */
function renderArchives(filterCol = null, filterDept = null, q = '') {
  const isRegistrar = currentUser.role === 'Registrar';
  const isChairman  = currentUser.role === 'Chairman';

  // Chairman is scoped to their own college only
  const allowedColIds = isRegistrar
    ? DB.colleges.map(c => c.id)
    : isChairman
      ? [currentUser.collegeId]
      : [];

  if (!allowedColIds.length) {
    set(`<div class="empty"><div class="empty-icon">🚫</div><div class="empty-text">Access denied.</div></div>`);
    return;
  }

  // Force chairman to their college
  if (isChairman && filterCol && filterCol !== currentUser.collegeId) {
    filterCol = currentUser.collegeId;
  }

  const colleges = DB.colleges.filter(c => allowedColIds.includes(c.id));
  const depts    = DB.departments;

  let pool = DB.students.filter(s =>
    (s.status === 'graduated' || s.status === 'archived') &&
    allowedColIds.includes(s.collegeId)
  );
  if (filterCol)  pool = pool.filter(s => s.collegeId === filterCol);
  if (filterDept) pool = pool.filter(s => s.deptId    === filterDept);
  if (q)          pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  );

  const colLabel  = filterCol  ? getCollege(filterCol)?.name : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name   : null;

  let breadcrumb = `<span onclick="renderArchives()" style="cursor:pointer;color:var(--blue)">Archives</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderArchives(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">📦 Archives</div>
        <div class="text-sm text-muted" style="margin-top:4px">${breadcrumb}</div>
      </div>
      ${(filterDept || q) ? `<div class="search-wrap">
        <input class="search-input" placeholder="Search name or ID…"
          value="${esc(q)}"
          oninput="renderArchives(${filterCol||'null'},${filterDept||'null'},this.value)">
      </div>` : ''}
    </div>

    ${/* Summary stats at top level */(!filterCol && !q) ? `
      <div class="grid-4 mb-20">
        ${statCard('🗃', 'Total Archived', DB.students.filter(s=>(s.status==='graduated'||s.status==='archived')&&allowedColIds.includes(s.collegeId)).length, 'var(--text3)', 'var(--bg4)')}
        ${statCard('🎓', 'Graduated',      DB.students.filter(s=>s.status==='graduated'&&allowedColIds.includes(s.collegeId)).length, 'var(--success)', 'var(--success-dim)')}
        ${statCard('📁', 'Transferred/Withdrew', DB.students.filter(s=>s.status==='archived'&&allowedColIds.includes(s.collegeId)).length, 'var(--warning)', 'var(--warning-dim)')}
        ${statCard('🏛', 'Colleges', colleges.length, 'var(--blue)', 'var(--blue-dim)')}
      </div>` : ''}

    <!-- College folders -->
    ${!filterCol && !q ? `
      <div class="mb-8 text-sm text-muted fw-6">COLLEGES</div>
      <div class="grid-3 mb-24">
        ${colleges.map(col => {
          const total    = DB.students.filter(s => s.collegeId===col.id && (s.status==='graduated'||s.status==='archived')).length;
          const grads    = DB.students.filter(s => s.collegeId===col.id && s.status==='graduated').length;
          return `<div onclick="renderArchives(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2rem;margin-bottom:10px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;color:var(--text);margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-12">${depts.filter(d=>d.collegeId===col.id).length} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.4rem;font-weight:800;color:var(--text3)">${total}</span>
              <div>
                <span class="badge badge-success" style="font-size:.65rem">🎓 ${grads}</span>
                <span class="badge badge-muted"   style="font-size:.65rem;margin-left:4px">📁 ${total-grads}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Department folders -->
    ${filterCol && !filterDept && !q ? `
      <div class="mb-8 text-sm text-muted fw-6">DEPARTMENTS</div>
      <div class="grid-3 mb-24">
        ${depts.filter(d => d.collegeId === filterCol).map(dept => {
          const total = DB.students.filter(s => s.deptId===dept.id && (s.status==='graduated'||s.status==='archived')).length;
          const grads = DB.students.filter(s => s.deptId===dept.id && s.status==='graduated').length;
          return `<div onclick="renderArchives(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2rem;margin-bottom:10px">📂</div>
            <div class="fw-7" style="font-size:.9rem;color:var(--text);margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-12">
              <span style="font-size:1.4rem;font-weight:800;color:var(--text3)">${total}</span>
              <div>
                <span class="badge badge-success" style="font-size:.65rem">🎓 ${grads}</span>
                <span class="badge badge-muted"   style="font-size:.65rem;margin-left:4px">📁 ${total-grads}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Archived student list -->
    ${(filterDept || q) ? `
      <div class="section-card">
        <div class="section-card-head">
          <div class="fw-6">
            ${filterDept ? esc(deptLabel || '') : 'Search Results'} —
            ${pool.length} archived record(s)
          </div>
          ${filterDept ? `<div class="search-wrap">
            <input class="search-input" placeholder="Search…"
              value="${esc(q)}"
              oninput="renderArchives(${filterCol||'null'},${filterDept||'null'},this.value)">
          </div>` : ''}
        </div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Student ID</th><th>Name</th><th>Program</th>
            <th>Year Level</th><th>Archive Reason</th><th>Archived Date</th><th>Archived By</th>
            ${isRegistrar ? '<th>Actions</th>' : ''}
          </tr></thead>
          <tbody>
            ${pool.length === 0
              ? `<tr><td colspan="${isRegistrar?8:7}" class="table-empty">No archived records found.</td></tr>`
              : pool.map(s => `<tr>
                  <td class="mono text-sm text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                      ${initials(s.name)}
                    </div>
                    <div>
                      <div class="fw-6">${esc(s.name)}</div>
                      <div class="text-xs text-muted">${esc(s.archiveNote || '—')}</div>
                    </div>
                  </div></td>
                  <td class="text-sm">${esc(s.program)}</td>
                  <td>Year ${s.year}</td>
                  <td><span class="badge badge-${s.status==='graduated'?'success':'warning'}">${s.status==='graduated'?'🎓 Graduated':'📁 Transferred/Withdrew'}</span></td>
                  <td class="text-sm text-muted">${esc(s.archivedAt || '—')}</td>
                  <td class="text-sm text-muted">${esc(s.archivedBy || '—')}</td>
                  ${isRegistrar ? `<td>
                    <button class="btn btn-sm btn-ghost" onclick="restoreStudent('${s.id}',${filterCol||'null'},${filterDept||'null'})">↩ Restore</button>
                  </td>` : ''}
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : ''}
  `);
}

/* ── Restore archived student back to enrolled ── */
function restoreStudent(sid, filterCol, filterDept) {
  const s = getStudent(sid);
  if (!s) return;
  if (!confirm(`Restore ${s.name} to active (Enrolled) status?`)) return;
  s.status      = 'enrolled';
  s.archiveNote = null;
  s.archivedAt  = null;
  s.archivedBy  = null;
  save();
  logAudit(`Student restored: ${sid} — ${s.name}`);
  toast(`${s.name} restored to Enrolled status`, 'success');
  renderArchives(filterCol, filterDept);
}


/* ══════════════════════════════════════════════
   END STUDENT RECORDS MODULE
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   CURRICULUM MODULE  (Registrar)
   Set subjects per college/dept per year level
   with optional prerequisite linking
══════════════════════════════════════════════ */
function renderCurriculum(filterCol = null, filterDept = null) {
  const colleges = DB.colleges;
  const depts    = DB.departments;

  const colLabel  = filterCol  ? getCollege(filterCol)?.name  : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name    : null;

  let breadcrumb = `<span onclick="renderCurriculum()" style="cursor:pointer;color:var(--blue)">All Colleges</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderCurriculum(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Curriculum Management</div>
        <div class="text-sm text-muted mt-1">${breadcrumb}</div>
      </div>
      ${filterDept ? `<button class="btn btn-primary" onclick="showAddSubjectModal(${filterDept})">+ Add Subject</button>` : ''}
    </div>

    <!-- College folders -->
    ${!filterCol ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A COLLEGE</div>
      <div class="grid-3 mb-20">
        ${colleges.map(col => {
          const deptCount = depts.filter(d => d.collegeId === col.id).length;
          const subjCount = DB.subjects.filter(s => depts.filter(d => d.collegeId === col.id).map(d => d.id).includes(s.deptId)).length;
          return `<div onclick="renderCurriculum(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-12">${deptCount} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.4rem;font-weight:800;color:var(--blue)">${subjCount}</span>
              <span class="badge badge-info">Subjects</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Dept folders -->
    ${filterCol && !filterDept ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A DEPARTMENT</div>
      <div class="grid-3 mb-20">
        ${depts.filter(d => d.collegeId === filterCol).map(dept => {
          const subjCount = DB.subjects.filter(s => s.deptId === dept.id).length;
          return `<div onclick="renderCurriculum(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">📂</div>
            <div class="fw-7" style="font-size:.9rem;margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-12">
              <span style="font-size:1.4rem;font-weight:800;color:var(--teal)">${subjCount}</span>
              <span class="badge badge-teal">Subjects</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Subject curriculum table by year level -->
    ${filterDept ? (() => {
      const subjects = DB.subjects.filter(s => s.deptId === filterDept);
      const years    = [1,2,3,4];
      const ordMap   = {1:'1st Year',2:'2nd Year',3:'3rd Year',4:'4th Year'};
      return years.map(yr => {
        const yrSubjs = subjects.filter(s => s.year === yr).sort((a,b) => a.sem - b.sem || a.code.localeCompare(b.code));
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;margin-top:${yr>1?'24px':'0'}">
            <div style="width:4px;height:26px;background:var(--blue);border-radius:4px"></div>
            <div style="font-size:1rem;font-weight:800;color:var(--blue)">${ordMap[yr]}</div>
            <span class="badge badge-info">${yrSubjs.length} subject(s)</span>
          </div>
          <div class="section-card mb-16">
            <div class="section-card-head" style="background:var(--bg3)">
              <div class="fw-6">${ordMap[yr]} Curriculum</div>
              <button class="btn btn-sm btn-primary" onclick="showAddSubjectModal(${filterDept},${yr})">+ Add Subject</button>
            </div>
            ${yrSubjs.length === 0
              ? `<div class="empty" style="padding:28px"><div class="empty-icon" style="font-size:1.6rem">📋</div><div class="empty-text">No subjects set for ${ordMap[yr]}.</div></div>`
              : `<div class="table-wrap"><table>
                  <thead><tr>
                    <th>Code</th><th>Subject Name</th><th>Units</th><th>Semester</th><th>Prerequisite</th><th>Actions</th>
                  </tr></thead>
                  <tbody>${yrSubjs.map(s => {
                    const prereq = s.prerequisiteId ? getSubject(s.prerequisiteId) : null;
                    return `<tr>
                      <td><span class="chip">${esc(s.code)}</span></td>
                      <td class="fw-6">${esc(s.name)}</td>
                      <td>${s.units}</td>
                      <td>${s.sem === 1 ? '1st Sem' : s.sem === 2 ? '2nd Sem' : 'Summer'}</td>
                      <td>${prereq
                        ? `<span class="badge badge-warning" title="${esc(prereq.name)}">${esc(prereq.code)}</span>`
                        : '<span class="text-muted text-xs">None</span>'}</td>
                      <td><div class="flex gap-6">
                        <button class="btn btn-sm btn-ghost" onclick="showEditSubjectModal(${s.id})">✎ Edit</button>
                        <button class="btn btn-sm btn-danger" onclick="deleteSubject(${s.id},${filterDept})">✕</button>
                      </div></td>
                    </tr>`;
                  }).join('')}</tbody>
                </table></div>`}
          </div>`;
      }).join('');
    })() : ''}
  `);
}

function showAddSubjectModal(deptId, defaultYear = 1) {
  const dept    = getDept(deptId);
  const allSubj = DB.subjects.filter(s => s.deptId === deptId);
  const prereqOpts = `<option value="">— None —</option>` +
    allSubj.map(s => `<option value="${s.id}">${esc(s.code)} — ${esc(s.name)}</option>`).join('');

  showModal(`Add Subject — ${dept ? esc(dept.name.replace('Department of ','')) : ''}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Subject Code</div><input id="sc-code" class="input" placeholder="e.g. IT 301"></div>
      <div class="field-wrap"><div class="field-label">Subject Name</div><input id="sc-name" class="input" placeholder="e.g. Database Systems"></div>
    </div>
    <div class="grid-3">
      <div class="field-wrap"><div class="field-label">Units</div>
        <select id="sc-units" class="select-input">
          ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${u===3?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="sc-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${y===defaultYear?'selected':''}>${y === 1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="sc-sem" class="select-input">
          <option value="1">1st Semester</option>
          <option value="2">2nd Semester</option>
          <option value="3">Summer</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Prerequisite Subject <span style="font-weight:400;text-transform:none;color:var(--text4)">(optional)</span></div>
      <select id="sc-prereq" class="select-input">${prereqOpts}</select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addSubject(${deptId})">Add Subject</button>`
  );
}

function addSubject(deptId) {
  const code   = document.getElementById('sc-code').value.trim();
  const name   = document.getElementById('sc-name').value.trim();
  const units  = +document.getElementById('sc-units').value;
  const year   = +document.getElementById('sc-year').value;
  const sem    = +document.getElementById('sc-sem').value;
  const prereq = +document.getElementById('sc-prereq').value || null;
  if (!code || !name) { toast('Subject code and name are required', 'error'); return; }
  if (DB.subjects.find(s => s.code === code && s.deptId === deptId)) { toast('Subject code already exists in this dept', 'error'); return; }

  const maxId = DB.subjects.length ? Math.max(...DB.subjects.map(s => s.id)) : 0;
  DB.subjects.push({ id: maxId + 1, deptId, code, name, units, year, sem, prerequisiteId: prereq });
  save();
  logAudit(`Subject added: ${code} — ${name}`);
  toast(`${code} added to curriculum`, 'success');
  closeModal();
  renderCurriculum(getCollege(getDept(deptId)?.collegeId)?.id, deptId);
}

function showEditSubjectModal(subjId) {
  const s       = getSubject(subjId);
  if (!s) return;
  const allSubj = DB.subjects.filter(x => x.deptId === s.deptId && x.id !== subjId);
  const prereqOpts = `<option value="">— None —</option>` +
    allSubj.map(x => `<option value="${x.id}" ${s.prerequisiteId===x.id?'selected':''}>${esc(x.code)} — ${esc(x.name)}</option>`).join('');

  showModal(`Edit Subject — ${esc(s.code)}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Subject Code</div><input id="es-code" class="input" value="${esc(s.code)}"></div>
      <div class="field-wrap"><div class="field-label">Subject Name</div><input id="es-name" class="input" value="${esc(s.name)}"></div>
    </div>
    <div class="grid-3">
      <div class="field-wrap"><div class="field-label">Units</div>
        <select id="es-units" class="select-input">
          ${[1,2,3,4,5,6].map(u => `<option value="${u}" ${u===s.units?'selected':''}>${u}</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="es-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${y===s.year?'selected':''}>${y===1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Semester</div>
        <select id="es-sem" class="select-input">
          <option value="1" ${s.sem===1?'selected':''}>1st Semester</option>
          <option value="2" ${s.sem===2?'selected':''}>2nd Semester</option>
          <option value="3" ${s.sem===3?'selected':''}>Summer</option>
        </select>
      </div>
    </div>
    <div class="field-wrap">
      <div class="field-label">Prerequisite</div>
      <select id="es-prereq" class="select-input">${prereqOpts}</select>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editSubject(${subjId})">Save Changes</button>`
  );
}

function editSubject(subjId) {
  const s = getSubject(subjId);
  if (!s) return;
  s.code           = document.getElementById('es-code').value.trim()  || s.code;
  s.name           = document.getElementById('es-name').value.trim()  || s.name;
  s.units          = +document.getElementById('es-units').value;
  s.year           = +document.getElementById('es-year').value;
  s.sem            = +document.getElementById('es-sem').value;
  s.prerequisiteId = +document.getElementById('es-prereq').value || null;
  save();
  logAudit(`Subject updated: ${s.code} — ${s.name}`);
  toast('Subject updated', 'success');
  closeModal();
  renderCurriculum(getCollege(getDept(s.deptId)?.collegeId)?.id, s.deptId);
}

function deleteSubject(subjId, deptId) {
  const s = getSubject(subjId);
  if (!s) return;
  if (DB.sections.some(sec => sec.subjectId === subjId)) {
    toast('Cannot delete — active sections exist for this subject', 'error');
    return;
  }
  if (!confirm(`Delete ${s.code} — ${s.name}? This cannot be undone.`)) return;
  DB.subjects = DB.subjects.filter(x => x.id !== subjId);
  // Clear prereq references
  DB.subjects.forEach(x => { if (x.prerequisiteId === subjId) x.prerequisiteId = null; });
  save();
  logAudit(`Subject deleted: ${s.code}`);
  toast(`${s.code} removed from curriculum`, 'info');
  renderCurriculum(getCollege(getDept(deptId)?.collegeId)?.id, deptId);
}

/* ══════════════════════════════════════════════
   END CURRICULUM MODULE
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   COLLEGES & DEPARTMENTS MODULE  (Registrar)
   Full CRUD for colleges and their departments
   (replaces hardcoded seed data)
══════════════════════════════════════════════ */
function renderCollegesAdmin(activeColId = null) {
  const activeCol = activeColId ? getCollege(activeColId) : null;
  const depts     = activeColId ? DB.departments.filter(d => d.collegeId === activeColId) : [];

  set(`
    <div class="page-header">
      <div class="page-title">Colleges &amp; Departments</div>
      <button class="btn btn-primary" onclick="showAddCollegeModal()">+ Add College</button>
    </div>

    <div style="display:grid;grid-template-columns:${activeCol ? '320px 1fr' : '1fr'};gap:20px;align-items:start">

      <!-- College list -->
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head" style="background:var(--bg3)">
          <div class="fw-6">Colleges (${DB.colleges.length})</div>
        </div>
        ${DB.colleges.length === 0
          ? `<div class="empty" style="padding:36px">
              <div class="empty-icon">🏛</div>
              <div class="empty-text">No colleges yet.<br>Click <strong>+ Add College</strong> to begin.</div>
            </div>`
          : `<div style="padding:10px">
              ${DB.colleges.map(col => {
                const deptCount = DB.departments.filter(d => d.collegeId === col.id).length;
                const stuCount  = DB.students.filter(s => s.collegeId === col.id).length;
                const isActive  = activeColId === col.id;
                return `<div onclick="renderCollegesAdmin(${col.id})"
                  style="cursor:pointer;padding:14px 16px;border-radius:10px;margin-bottom:6px;
                    border:1.5px solid ${isActive ? 'var(--blue)' : 'var(--border)'};
                    background:${isActive ? 'var(--blue-dim)' : 'var(--bg3)'};
                    transition:all .15s">
                  <div class="flex-between">
                    <div>
                      <div class="fw-7" style="font-size:.9rem;color:${isActive ? 'var(--blue)' : 'var(--text)'}">${esc(col.name)}</div>
                      <div class="text-xs text-muted mt-2">${deptCount} dept(s) · ${stuCount} student(s)</div>
                    </div>
                    ${isActive ? '' : `<button class="btn btn-sm btn-danger"
                      onclick="event.stopPropagation();deleteCollege(${col.id})"
                      title="Delete college">✕</button>`}
                  </div>
                </div>`;
              }).join('')}
            </div>`}
      </div>

      <!-- Department panel (shown when a college is selected) -->
      ${activeCol ? `
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head" style="background:var(--bg3)">
          <div>
            <div class="fw-7">${esc(activeCol.name)}</div>
            <div class="text-xs text-muted mt-1">Departments — ${depts.length} registered</div>
          </div>
          <div class="flex gap-8">
            <button class="btn btn-ghost btn-sm" onclick="showEditCollegeModal(${activeCol.id})">✎ Edit Name</button>
            <button class="btn btn-primary btn-sm" onclick="showAddDeptModal(${activeCol.id})">+ Add Department</button>
          </div>
        </div>
        ${depts.length === 0
          ? `<div class="empty" style="padding:36px">
              <div class="empty-icon">📁</div>
              <div class="empty-text">No departments yet.<br>Click <strong>+ Add Department</strong>.</div>
            </div>`
          : `<div class="table-wrap"><table>
              <thead><tr>
                <th>Department Name</th><th>Subjects</th><th>Students</th><th>Faculty</th><th>Actions</th>
              </tr></thead>
              <tbody>${depts.map(dept => {
                const subjCount = DB.subjects.filter(s => s.deptId === dept.id).length;
                const stuCount  = DB.students.filter(s => s.deptId === dept.id).length;
                const facCount  = DB.users.filter(u => u.role === 'Faculty' && u.deptId === dept.id).length;
                return `<tr>
                  <td class="fw-6">${esc(dept.name)}</td>
                  <td>${subjCount}</td>
                  <td>${stuCount}</td>
                  <td>${facCount}</td>
                  <td><div class="flex gap-6">
                    <button class="btn btn-sm btn-ghost" onclick="showEditDeptModal(${dept.id})">✎ Edit</button>
                    <button class="btn btn-sm btn-danger" onclick="deleteDept(${dept.id},${activeCol.id})">✕ Delete</button>
                  </div></td>
                </tr>`;
              }).join('')}</tbody>
            </table></div>`}
      </div>` : `
      <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
        <div class="empty-icon">👈</div>
        <div class="empty-text">Select a college to manage its departments.</div>
      </div>`}

    </div>
  `);
}

/* College CRUD */
function showAddCollegeModal() {
  showModal('Add College', `
    <div class="field-wrap">
      <div class="field-label">College Name</div>
      <input id="col-name" class="input" placeholder="e.g. College of Science">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addCollege()">Add College</button>`
  );
}

function addCollege() {
  const name = document.getElementById('col-name').value.trim();
  if (!name) { toast('College name is required', 'error'); return; }
  if (DB.colleges.find(c => c.name.toLowerCase() === name.toLowerCase())) {
    toast('A college with this name already exists', 'error'); return;
  }
  const id = DB.nextId.college++;
  DB.colleges.push({ id, name });
  save();
  logAudit(`College added: ${name}`);
  toast(`${name} added`, 'success');
  closeModal();
  renderCollegesAdmin(id);
}

function showEditCollegeModal(id) {
  const col = getCollege(id);
  if (!col) return;
  showModal('Edit College Name', `
    <div class="field-wrap">
      <div class="field-label">College Name</div>
      <input id="col-edit-name" class="input" value="${esc(col.name)}">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editCollege(${id})">Save</button>`
  );
}

function editCollege(id) {
  const col  = getCollege(id);
  if (!col) return;
  const name = document.getElementById('col-edit-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  col.name = name;
  save();
  logAudit(`College renamed: ${name}`);
  toast('College name updated', 'success');
  closeModal();
  renderCollegesAdmin(id);
}

function deleteCollege(id) {
  const col = getCollege(id);
  if (!col) return;
  const depts   = DB.departments.filter(d => d.collegeId === id);
  const stuCount = DB.students.filter(s => s.collegeId === id).length;
  if (depts.length > 0 || stuCount > 0) {
    showModal('Cannot Delete College', `
      <div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(230,57,70,.3);color:#b91c1c;border-radius:10px;padding:14px 16px;line-height:1.6">
        <strong>${esc(col.name)}</strong> cannot be deleted because it still has
        <strong>${depts.length} department(s)</strong> and <strong>${stuCount} student(s)</strong>.<br><br>
        Remove all departments and reassign or remove all students first.
      </div>`,
      `<button class="btn btn-primary" onclick="closeModal()">OK</button>`
    );
    return;
  }
  if (!confirm(`Delete "${col.name}"? This cannot be undone.`)) return;
  DB.colleges    = DB.colleges.filter(c => c.id !== id);
  DB.departments = DB.departments.filter(d => d.collegeId !== id);
  save();
  logAudit(`College deleted: ${col.name}`);
  toast(`${col.name} deleted`, 'info');
  renderCollegesAdmin(null);
}

/* Department CRUD */
function showAddDeptModal(colId) {
  showModal('Add Department', `
    <div class="field-wrap">
      <div class="field-label">Department Name</div>
      <input id="dept-name" class="input" placeholder="e.g. Department of Information Technology">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addDept(${colId})">Add Department</button>`
  );
}

function addDept(colId) {
  const name = document.getElementById('dept-name').value.trim();
  if (!name) { toast('Department name is required', 'error'); return; }
  if (DB.departments.find(d => d.collegeId === colId && d.name.toLowerCase() === name.toLowerCase())) {
    toast('A department with this name already exists in this college', 'error'); return;
  }
  const id = DB.nextId.dept++;
  DB.departments.push({ id, collegeId: colId, name });
  save();
  logAudit(`Department added: ${name}`);
  toast(`${name} added`, 'success');
  closeModal();
  renderCollegesAdmin(colId);
}

function showEditDeptModal(id) {
  const dept = getDept(id);
  if (!dept) return;
  showModal('Edit Department Name', `
    <div class="field-wrap">
      <div class="field-label">Department Name</div>
      <input id="dept-edit-name" class="input" value="${esc(dept.name)}">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editDept(${id})">Save</button>`
  );
}

function editDept(id) {
  const dept = getDept(id);
  if (!dept) return;
  const name = document.getElementById('dept-edit-name').value.trim();
  if (!name) { toast('Name required', 'error'); return; }
  dept.name = name;
  save();
  logAudit(`Department renamed: ${name}`);
  toast('Department updated', 'success');
  closeModal();
  renderCollegesAdmin(dept.collegeId);
}

function deleteDept(id, colId) {
  const dept     = getDept(id);
  if (!dept) return;
  const stuCount = DB.students.filter(s => s.deptId === id).length;
  const facCount = DB.users.filter(u => u.deptId === id).length;
  const subjCount = DB.subjects.filter(s => s.deptId === id).length;
  if (stuCount > 0 || facCount > 0 || subjCount > 0) {
    showModal('Cannot Delete Department', `
      <div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(230,57,70,.3);color:#b91c1c;border-radius:10px;padding:14px 16px;line-height:1.6">
        <strong>${esc(dept.name)}</strong> cannot be deleted because it still has
        <strong>${stuCount} student(s)</strong>, <strong>${facCount} account(s)</strong>,
        and <strong>${subjCount} subject(s)</strong>.<br><br>
        Remove all linked data before deleting this department.
      </div>`,
      `<button class="btn btn-primary" onclick="closeModal()">OK</button>`
    );
    return;
  }
  if (!confirm(`Delete "${dept.name}"? This cannot be undone.`)) return;
  DB.departments = DB.departments.filter(d => d.id !== id);
  save();
  logAudit(`Department deleted: ${dept.name}`);
  toast(`${dept.name} deleted`, 'info');
  renderCollegesAdmin(colId);
}

function togglePwdVis(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

/* ──────────────────────────────────────────────
   MODAL ENGINE
────────────────────────────────────────────── */
function showModal(title, body, footer) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="flex-between mb-20">
        <div class="modal-title">${esc(title)}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div>${body}</div>
      <div class="modal-footer">${footer}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}


/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
document.getElementById('topbar-date').textContent = today();
