'use strict';

/* ══════════════════════════════════════════
   AUTH — Login / Logout / Dashboard
══════════════════════════════════════════ */

/* ── Login ───────────────────────────── */
function doLogin() {
  const errEl = document.getElementById('login-error');
  errEl.className = 'alert alert-danger hidden';

  const username = (document.getElementById('inp-user').value || '').trim();
  const password = (document.getElementById('inp-pass').value || '').trim();

  if (!username || !password) {
    errEl.textContent = 'Please enter your username and password.';
    errEl.classList.remove('hidden');
    return;
  }

  // Check staff accounts (Registrar, Dean, Chairman, Faculty)
  const user = DB.users.find(u => u.username === username && u.password === password && u.active);
  if (user) {
    currentUser = user;
    launchApp();
    return;
  }

  // Check student accounts (ID + birthday)
  // Student login: username = student ID, password = birthday mmddyyyy
  const student = DB.students.find(s => s.id === username && s.birthday === password);
  if (student) {
    currentUser = {
      id:        null,
      name:      student.name,
      role:      'Student',
      studentId: student.id,
      active:    true,
    };
    launchApp();
    return;
  }

  errEl.textContent = 'Invalid username or password.';
  errEl.classList.remove('hidden');
}

/* ── Launch app after login ──────────── */
function launchApp() {
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');

  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-role').textContent = currentUser.role;

  buildNav();

  // Default page
  const defaults = {
    Registrar: 'dashboard',
    Dean:      'dashboard',
    Chairman:  'dashboard',
    Faculty:   'dashboard',
    Student:   'stu-grades',
  };
  navigate(defaults[currentUser.role] || 'dashboard');
}

/* ── Logout ──────────────────────────── */
function doLogout() {
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

/* ══════════════════════════════════════════
   DASHBOARD (shared by staff roles)
══════════════════════════════════════════ */
registerPage('dashboard', renderDashboard);

function renderDashboard() {
  const role = currentUser.role;

  if (role === 'Registrar') dashRegistrar();
  else if (role === 'Dean') dashDean();
  else if (role === 'Chairman') dashChairman();
  else if (role === 'Faculty') dashFaculty();
}

/* ── Registrar Dashboard ─────────────── */
function dashRegistrar() {
  const allSecIds = DB.sections.filter(s => s.submitted).map(s => s.id);
  const sm        = gradeSummary(allSecIds);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Registrar Dashboard</div>
        <div class="page-sub">Institution-wide overview</div>
      </div>
    </div>

    <div class="grid-4 mb-20">
      ${statCard('👤', 'Total Users',     DB.users.filter(u => u.active).length,     'var(--blue)',    '#dbeafe')}
      ${statCard('🎓', 'Total Students',  DB.students.length,                        'var(--teal)',    '#ccfbf1')}
      ${statCard('✅', 'Grades Submitted',allSecIds.length + ' sections',             'var(--success)', '#dcfce7')}
      ${statCard('📈', 'Overall Pass Rate',sm.passRate != null ? sm.passRate+'%':'—', 'var(--warning)', '#fef3c7')}
    </div>

    <div class="grid-2">
      <div class="card">
        <div class="card-title">Pass Rate by College</div>
        ${DB.colleges.map(col => {
          const sm = gradeSummary(secIdsForCollege(col.id));
          return barRow(col.name.replace('College of ',''), sm.passRate, sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--warning)');
        }).join('') || '<div class="text-muted text-sm">No data yet.</div>'}
      </div>
      <div class="card">
        <div class="card-title">Accounts by Role</div>
        ${['Dean','Chairman','Faculty'].map(role => {
          const count = DB.users.filter(u => u.role === role && u.active).length;
          return barRow(role, null, 'var(--blue)') + `<!-- ${count} -->`;
        }).join('')}
        <table style="margin-top:8px">
          ${['Dean','Chairman','Faculty'].map(role => {
            const count = DB.users.filter(u => u.role === role && u.active).length;
            return `<tr><td class="text-sm">${role}</td><td class="text-sm fw-7" style="text-align:right">${count}</td></tr>`;
          }).join('')}
        </table>
      </div>
    </div>
  `);
}

/* ── Dean Dashboard ──────────────────── */
function dashDean() {
  const col    = getCollege(currentUser.collegeId);
  const secIds = secIdsForCollege(currentUser.collegeId).filter(sid => getSection(sid)?.submitted);
  const sm     = gradeSummary(secIds);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Dean Dashboard</div>
        <div class="page-sub">${col ? esc(col.name) : '—'}</div>
      </div>
    </div>

    <div class="grid-4 mb-20">
      ${statCard('📊','Total Grades', sm.total,  '#374151', '#f3f4f6')}
      ${statCard('✅','Passed',       sm.passed, 'var(--success)', '#dcfce7')}
      ${statCard('❌','Failed',       sm.failed, 'var(--danger)',  '#fee2e2')}
      ${statCard('📈','Pass Rate', sm.passRate != null ? sm.passRate+'%':'—', 'var(--blue)', '#dbeafe')}
    </div>

    <div class="card">
      <div class="card-title">Performance by Department</div>
      ${DB.departments.filter(d => d.collegeId === currentUser.collegeId).map(dept => {
        const sm = gradeSummary(secIdsForDept(dept.id));
        return barRow(dept.name.replace('Department of ',''), sm.passRate, sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--warning)');
      }).join('') || '<div class="text-muted text-sm">No departments found.</div>'}
    </div>
  `);
}

/* ── Chairman Dashboard ──────────────── */
function dashChairman() {
  const dept   = getDept(currentUser.deptId);
  const secIds = secIdsForDept(currentUser.deptId).filter(sid => getSection(sid)?.submitted);
  const sm     = gradeSummary(secIds);
  const failing = getFailingStudents(secIds);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Chairman Dashboard</div>
        <div class="page-sub">${dept ? esc(dept.name) : '—'}</div>
      </div>
    </div>

    <div class="grid-4 mb-20">
      ${statCard('📊','Total Grades', sm.total,  '#374151', '#f3f4f6')}
      ${statCard('✅','Passed',       sm.passed, 'var(--success)', '#dcfce7')}
      ${statCard('❌','Failed',       sm.failed, 'var(--danger)',  '#fee2e2')}
      ${statCard('📈','Pass Rate', sm.passRate != null ? sm.passRate+'%':'—', 'var(--blue)', '#dbeafe')}
    </div>

    ${failing.length > 0 ? `
    <div class="section-card">
      <div class="section-card-head">
        <div class="fw-7">⚠ Failing Students (${failing.length})</div>
      </div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Failed Subjects</th></tr></thead>
          <tbody>
            ${failing.map(f => `
              <tr class="row-fail">
                <td class="mono text-sm">${esc(f.student.id)}</td>
                <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(f.student.name)}</div>${esc(f.student.name)}</div></td>
                <td>Year ${f.student.year}</td>
                <td><span class="badge badge-danger">${f.failCount} subject${f.failCount > 1 ? 's' : ''}</span></td>
              </tr>`).join('')}
          </tbody>
        </table>
      </div>
    </div>` : `<div class="card"><div class="text-center" style="padding:24px;color:var(--success)">✅ No failing students in your department.</div></div>`}
  `);
}

/* ── Faculty Dashboard ───────────────── */
function dashFaculty() {
  const mySecs  = DB.sections.filter(s => s.facultyId === currentUser.id);
  const pending = mySecs.filter(s => !s.submitted);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Faculty Dashboard</div>
        <div class="page-sub">${esc(currentUser.name)}</div>
      </div>
    </div>

    <div class="grid-3 mb-20">
      ${statCard('📚','My Sections',  mySecs.length, 'var(--blue)',    '#dbeafe')}
      ${statCard('✅','Submitted',    mySecs.filter(s => s.submitted).length, 'var(--success)', '#dcfce7')}
      ${statCard('⏳','Pending',      pending.length, pending.length > 0 ? 'var(--warning)' : 'var(--success)', pending.length > 0 ? '#fef3c7' : '#dcfce7')}
    </div>

    ${pending.length > 0 ? `
    <div class="alert alert-warning mb-16">⚠ You have ${pending.length} section(s) with unsubmitted grades. Go to <strong>Encode Grades</strong> to complete them.</div>` : ''}

    <div class="section-card">
      <div class="section-card-head"><div class="fw-7">My Sections</div></div>
      <div class="table-wrap">
        <table>
          <thead><tr><th>Subject</th><th>Section</th><th>School Year</th><th>Sem</th><th>Status</th></tr></thead>
          <tbody>
            ${mySecs.length === 0
              ? `<tr><td colspan="5" class="table-empty">No sections assigned yet.</td></tr>`
              : mySecs.map(sec => {
                  const subj = getSubject(sec.subjectId);
                  return `<tr>
                    <td><span class="chip">${subj ? esc(subj.code) : '—'}</span> ${subj ? esc(subj.name) : '—'}</td>
                    <td class="fw-6">${esc(sec.sectionName)}</td>
                    <td class="text-muted text-sm">${esc(sec.sy)}</td>
                    <td class="text-muted text-sm">${esc(sec.sem)} Sem</td>
                    <td><span class="badge badge-${sec.submitted ? 'success' : 'warning'}">${sec.submitted ? '✔ Submitted' : 'Pending'}</span></td>
                  </tr>`;
                }).join('')}
          </tbody>
        </table>
      </div>
    </div>
  `);
}
