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
