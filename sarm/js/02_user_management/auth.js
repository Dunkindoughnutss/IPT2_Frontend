'use strict';

/* ══════════════════════════════════════════
   AUTH — Login / Logout / Dashboards
   Uses REST API instead of localStorage
══════════════════════════════════════════ */

async function doLogin() {
  const errEl    = document.getElementById('login-error');
  const btn      = document.querySelector('#login-screen .btn-primary');
  errEl.className = 'alert alert-danger hidden';

  const username = (document.getElementById('inp-user').value || '').trim();
  const password = (document.getElementById('inp-pass').value || '').trim();

  if (!username || !password) {
    errEl.textContent = 'Please enter your username and password.';
    errEl.classList.remove('hidden');
    return;
  }

  setLoading(btn, true);
  try {
    const user = await api.login(username, password);
    currentUser = user;
    launchApp();
  } catch (err) {
    errEl.textContent = err.message || 'Invalid username or password.';
    errEl.classList.remove('hidden');
  } finally {
    setLoading(btn, false);
  }
}

// Allow Enter key on login fields
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('inp-pass')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
  document.getElementById('inp-user')?.addEventListener('keydown', e => {
    if (e.key === 'Enter') doLogin();
  });
});

// Restore session AFTER all scripts have loaded and registered their pages
window.addEventListener('load', () => {
  api.me().then(user => {
    currentUser = user;
    launchApp();
  }).catch(() => { /* not logged in, stay on login screen */ });
});

function launchApp() {
  if (!currentUser || !currentUser.role) return;
  document.getElementById('login-screen').classList.add('hidden');
  document.getElementById('app').classList.remove('hidden');
  document.getElementById('sidebar-user-name').textContent = currentUser.name;
  document.getElementById('sidebar-user-role').textContent = currentUser.role;
  buildNav();
  const defaults = {
    Registrar: 'dashboard', Dean: 'dashboard',
    Chairman:  'dashboard', Faculty: 'dashboard', Student: 'stu-grades',
  };
  navigate(defaults[currentUser.role] || 'dashboard');
}

async function doLogout() {
  try { await api.logout(); } catch {}
  currentUser = null;
  document.getElementById('app').classList.add('hidden');
  document.getElementById('login-screen').classList.remove('hidden');
  document.getElementById('inp-user').value = '';
  document.getElementById('inp-pass').value = '';
  document.getElementById('login-error').classList.add('hidden');
}

/* ══════════════════════════════════════════
   DASHBOARDS
══════════════════════════════════════════ */
registerPage('dashboard', renderDashboard);

function renderDashboard() {
  set(`<div class="empty"><div class="empty-icon" style="font-size:2rem">⏳</div><div class="empty-text">Loading dashboard…</div></div>`);
  const role = currentUser.role;
  if      (role === 'Registrar') dashRegistrar();
  else if (role === 'Dean')      dashDean();
  else if (role === 'Chairman')  dashChairman();
  else if (role === 'Faculty')   dashFaculty();
}

/* ── Registrar Dashboard ─────────────── */
async function dashRegistrar() {
  try {
    const [analytics, users, students] = await Promise.all([
      api.getAnalytics(),
      api.getUsers(),
      api.getStudents(),
    ]);

    const trend    = analytics.semester_trend;
    const latest   = trend[trend.length - 1];
    const dist     = analytics.grade_distribution;
    const passRate = latest?.pass_rate ?? null;

    set(`
      <div class="page-header">
        <div><div class="page-title">Registrar Dashboard</div>
        <div class="page-sub">Institution-wide overview</div></div>
      </div>
      <div class="grid-4 mb-20">
        ${statCard('👤','Total Staff',    users.length,                                        'var(--blue)',    '#dbeafe')}
        ${statCard('🎓','Total Students', students.length,                                     'var(--teal)',    '#ccfbf1')}
        ${statCard('✅','Overall Passed', dist.passed ?? 0,                                    'var(--success)', '#dcfce7')}
        ${statCard('📈','Latest Pass Rate', passRate !== null ? passRate+'%' : '—',            'var(--warning)', '#fef3c7')}
      </div>
      <div class="grid-2">
        <div class="card">
          <div class="card-title">Pass Rate by Department</div>
          ${analytics.dept_comparison.map(d =>
            barRow(d.dept_name, d.pass_rate, d.pass_rate != null && d.pass_rate >= 75 ? 'var(--success)' : 'var(--warning)')
          ).join('') || '<div class="text-muted text-sm">No data yet.</div>'}
        </div>
        <div class="card">
          <div class="card-title">Staff by Role</div>
          ${['Dean','Chairman','Faculty'].map(role => {
            const count = users.filter(u => u.role === role).length;
            return `<div class="flex-between mb-8 text-sm">
              <span>${role}</span><span class="fw-7">${count}</span>
            </div>`;
          }).join('')}
        </div>
      </div>`);
  } catch (err) { apiErr(err); }
}

/* ── Dean Dashboard ──────────────────── */
async function dashDean() {
  try {
    const analytics = await api.getAnalytics();
    const trend     = analytics.semester_trend;
    const latest    = trend[trend.length - 1];
    const dist      = analytics.grade_distribution;

    set(`
      <div class="page-header">
        <div><div class="page-title">Dean Dashboard</div></div>
      </div>
      <div class="grid-4 mb-20">
        ${statCard('📊','Total Grades',    dist.grand_total,                                              '#374151','#f3f4f6')}
        ${statCard('✅','Passed',           dist.passed ?? 0,                                             'var(--success)','#dcfce7')}
        ${statCard('❌','Failed',           dist.failed ?? 0,                                             'var(--danger)','#fee2e2')}
        ${statCard('📈','Latest Pass Rate', latest?.pass_rate != null ? latest.pass_rate+'%' : '—',       'var(--blue)','#dbeafe')}
      </div>
      <div class="card">
        <div class="card-title">Performance by Department</div>
        ${analytics.dept_comparison.map(d =>
          barRow(d.dept_name, d.pass_rate, d.pass_rate != null && d.pass_rate >= 75 ? 'var(--success)' : 'var(--warning)')
        ).join('') || '<div class="text-muted text-sm">No data yet.</div>'}
      </div>`);
  } catch (err) { apiErr(err); }
}

/* ── Chairman Dashboard ──────────────── */
async function dashChairman() {
  try {
    const [analytics, sections] = await Promise.all([
      api.getAnalytics(),
      api.getSections({ submitted: 1 }),
    ]);
    const dist    = analytics.grade_distribution;
    const deptComp = analytics.dept_comparison[0];

    // Build failing students list from analytics dept data
    // We need grades — do a targeted fetch
    const grades = await api.getGrades({ section_id: sections.filter(s=>s.submitted).map(s=>s.id).join(',') || 0 }).catch(() => []);

    // Find failing students
    const failMap = {};
    grades.filter(g => g.grade !== 'INC' && parseFloat(g.grade) > 3).forEach(g => {
      if (!failMap[g.student_id]) failMap[g.student_id] = { name: g.student_name, count: 0 };
      failMap[g.student_id].count++;
    });
    const failing = Object.entries(failMap).map(([id, v]) => ({ id, ...v }));

    set(`
      <div class="page-header">
        <div><div class="page-title">Chairman Dashboard</div></div>
      </div>
      <div class="grid-4 mb-20">
        ${statCard('📊','Total Grades', dist.grand_total,                                               '#374151','#f3f4f6')}
        ${statCard('✅','Passed',        dist.passed ?? 0,                                              'var(--success)','#dcfce7')}
        ${statCard('❌','Failed',         dist.failed ?? 0,                                             'var(--danger)','#fee2e2')}
        ${statCard('📈','Pass Rate', deptComp?.pass_rate != null ? deptComp.pass_rate+'%' : '—',        'var(--blue)','#dbeafe')}
      </div>
      ${failing.length > 0 ? `
      <div class="section-card">
        <div class="section-card-head"><div class="fw-7">⚠ Failing Students (${failing.length})</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Student ID</th><th>Name</th><th>Failed Subjects</th></tr></thead>
          <tbody>
            ${failing.map(f => `<tr class="row-fail">
              <td class="mono text-sm">${esc(f.id)}</td>
              <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(f.name)}</div>${esc(f.name)}</div></td>
              <td><span class="badge badge-danger">${f.count} subject${f.count > 1 ? 's' : ''}</span></td>
            </tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : `<div class="card"><div class="text-center" style="padding:24px;color:var(--success)">✅ No failing students in your department.</div></div>`}
    `);
  } catch (err) { apiErr(err); }
}

/* ── Faculty Dashboard ───────────────── */
async function dashFaculty() {
  try {
    const sections = await api.getSections();
    const pending  = sections.filter(s => !s.submitted);

    set(`
      <div class="page-header">
        <div><div class="page-title">Faculty Dashboard</div>
        <div class="page-sub">${esc(currentUser.name)}</div></div>
      </div>
      <div class="grid-3 mb-20">
        ${statCard('📚','My Sections',  sections.length,                           'var(--blue)',    '#dbeafe')}
        ${statCard('✅','Submitted',     sections.filter(s=>s.submitted).length,    'var(--success)', '#dcfce7')}
        ${statCard('⏳','Pending',       pending.length,                            pending.length > 0 ? 'var(--warning)' : 'var(--success)', pending.length > 0 ? '#fef3c7' : '#dcfce7')}
      </div>
      ${pending.length > 0 ? `<div class="alert alert-warning mb-16">⚠ You have ${pending.length} section(s) with unsubmitted grades.</div>` : ''}
      <div class="section-card">
        <div class="section-card-head"><div class="fw-7">My Sections</div></div>
        <div class="table-wrap"><table>
          <thead><tr><th>Subject</th><th>Section</th><th>School Year</th><th>Sem</th><th>Status</th></tr></thead>
          <tbody>
            ${sections.length === 0
              ? `<tr><td colspan="5" class="table-empty">No sections assigned.</td></tr>`
              : sections.map(s => `<tr>
                  <td><span class="chip">${esc(s.subject_code)}</span> ${esc(s.subject_name)}</td>
                  <td class="fw-6">${esc(s.section_name)}</td>
                  <td class="text-muted text-sm">${esc(s.sy)}</td>
                  <td class="text-muted text-sm">${esc(s.sem)} Sem</td>
                  <td><span class="badge badge-${s.submitted ? 'success' : 'warning'}">${s.submitted ? '✔ Submitted' : 'Pending'}</span></td>
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>`);
  } catch (err) { apiErr(err); }
}