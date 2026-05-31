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
