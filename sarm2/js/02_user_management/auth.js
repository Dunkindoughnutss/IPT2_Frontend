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
