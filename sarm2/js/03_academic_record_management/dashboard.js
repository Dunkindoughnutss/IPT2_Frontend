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
