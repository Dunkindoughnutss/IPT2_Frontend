'use strict';

/* ══════════════════════════════════════════
   DATA ANALYTICS (API)
   Registrar, Dean, Chairman
══════════════════════════════════════════ */

registerPage('reg-analytics',   () => renderAnalytics());
registerPage('dean-analytics',  () => renderAnalytics());
registerPage('chair-analytics', () => renderAnalytics());

let _aFilter = { college_id: '', dept_id: '', sy: '', sem: '' };

function renderAnalytics() {
  _aFilter = { college_id: '', dept_id: '', sy: '', sem: '' };
  _drawAnalytics();
}

async function _drawAnalytics() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading analytics…</div></div>`);
  try {
    const params = {};
    if (_aFilter.college_id) params.college_id = _aFilter.college_id;
    if (_aFilter.dept_id)    params.dept_id    = _aFilter.dept_id;
    if (_aFilter.sy)         params.sy         = _aFilter.sy;
    if (_aFilter.sem)        params.sem        = _aFilter.sem;

    const data = await api.getAnalytics(params);
    const { semester_trend: trend, dept_comparison: depts, grade_distribution: dist, student_pass_rate: studentPassRateRaw } = data;
    const studentPassRate = toNum(studentPassRateRaw);
    
    // Display student-level pass rate from backend calculation
    // Overall student pass rate = (students with no failing grades / total students) * 100
    const studentPassRateLabel = percentLabel(studentPassRate);

    const role = currentUser.role;

    // Build filter bar
    let filtersHtml = '';
    const semesters = [...new Map(trend.map(t => [`${t.sy}||${t.sem}`, { sy: t.sy, sem: t.sem, label: t.label }]))].map(([_, v]) => v);
    const semesterSelect = `
      <div class="field-wrap" style="margin:0;min-width:220px">
        <label class="field-label">Semester</label>
        <select class="field-select" onchange="setAnFilter('semester',this.value)">
          <option value="">All Semesters</option>
          ${semesters.map(s => `<option value="${s.sy}||${s.sem}" ${_aFilter.sy===s.sy && _aFilter.sem===s.sem ? 'selected' : ''}>${esc(s.label)}</option>`).join('')}
        </select>
      </div>`;

    if (role === 'Registrar') {
      const meta = await api.getColleges().catch(() => ({ colleges: [], departments: [] }));
      const colleges = meta.colleges || [];
      const depSet = {};
      (meta.departments || []).forEach(d => {
        if (!depSet[d.college_id]) depSet[d.college_id] = [];
        depSet[d.college_id].push({ id: d.id, name: d.name });
      });
      const filtDepts = _aFilter.college_id
        ? (depSet[parseInt(_aFilter.college_id)] || [])
        : Object.values(depSet).flat();

      filtersHtml = `
        <div class="flex gap-12 flex-wrap mb-20" style="align-items:flex-end">
          ${semesterSelect}
          <div class="field-wrap" style="margin:0;min-width:180px">
            <label class="field-label">College</label>
            <select class="field-select" onchange="setAnFilter('college_id',this.value)">
              <option value="">All Colleges</option>
              ${colleges.map(c => `<option value="${c.id}" ${_aFilter.college_id==c.id?'selected':''}>${esc(c.name)}</option>`).join('')}
            </select>
          </div>
          <div class="field-wrap" style="margin:0;min-width:200px">
            <label class="field-label">Department</label>
            <select class="field-select" onchange="setAnFilter('dept_id',this.value)">
              <option value="">All Departments</option>
              ${filtDepts.map(d => `<option value="${d.id}" ${_aFilter.dept_id==d.id?'selected':''}>${esc(d.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="clearAnFilter()">✕ Clear</button>
        </div>`;
    } else if (role === 'Dean') {
      const meta = await api.getColleges().catch(() => ({ departments: [] }));
      const deptList = (meta.departments || [])
        .filter(d => d.college_id === currentUser.college_id)
        .map(d => ({ id: d.id, name: d.name }));
      filtersHtml = `
        <div class="flex gap-12 flex-wrap mb-20" style="align-items:flex-end">
          ${semesterSelect}
          <div class="field-wrap" style="margin:0;min-width:200px">
            <label class="field-label">Department</label>
            <select class="field-select" onchange="setAnFilter('dept_id',this.value)">
              <option value="">All Departments</option>
              ${deptList.map(d => `<option value="${d.id}" ${_aFilter.dept_id==d.id?'selected':''}>${esc(d.name)}</option>`).join('')}
            </select>
          </div>
          <button class="btn btn-ghost btn-sm" onclick="clearAnFilter()">✕ Clear</button>
        </div>`;
    }

    if (!filtersHtml) {
      filtersHtml = `
        <div class="flex gap-12 flex-wrap mb-20" style="align-items:flex-end">
          ${semesterSelect}
          <button class="btn btn-ghost btn-sm" onclick="clearAnFilter()">✕ Clear</button>
        </div>`;
    }

    // Build headcount trend from semester_trend
    const hcTrend = trend.map(t => ({ label: t.label, count: t.headcount }));

    set(`
      <div class="page-header">
        <div><div class="page-title">Data Analytics</div></div>
      </div>

      ${filtersHtml}

      <!-- KPIs -->
      <div class="grid-4 mb-20">
        ${statCard('📊','Total Grades',    dist.grand_total,  '#374151','#f3f4f6')}
        ${statCard('✅','Total Passed',     dist.passed  ?? 0, 'var(--success)','#dcfce7')}
        ${statCard('❌','Total Failed',      dist.failed  ?? 0, 'var(--danger)','#fee2e2')}
        ${statCard('🎓','Student Pass Rate', studentPassRateLabel, 'var(--blue)','#dbeafe')}
      </div>

      <!-- Row 1: Semester trend + Headcount -->
      <div class="grid-2 mb-20">
        <div class="section-card">
          <div class="section-card-head">
            <div class="fw-7">📉 Semester Pass Rate Trend</div>
            <span class="badge badge-blue">Pass Rate %</span>
          </div>
          <div class="section-card-body">
            ${trend.length < 2
              ? `<div class="empty" style="padding:24px"><div class="empty-icon" style="font-size:1.5rem">📊</div><div class="empty-text">Need at least 2 semesters of data.</div></div>`
              : trendChart(trend.map(t => ({ ...t, passRate: t.pass_rate })), 'passRate', '#2563eb', '%')}
            ${trend.length ? `
            <div class="table-wrap" style="margin-top:14px">
              <table>
                <thead><tr><th>Semester</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg</th></tr></thead>
                <tbody>
                  ${trend.map(t => `<tr>
                    <td class="fw-6 text-sm">${esc(t.label)}</td>
                    <td>${t.total}</td>
                    <td style="color:var(--success)">${t.passed}</td>
                    <td style="color:var(--danger)">${t.failed}</td>
                    <td>${prCell(t.pass_rate)}</td>
                    <td class="mono text-sm">${avgLabel(t.avg_grade)}</td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : ''}
          </div>
        </div>

        <div class="section-card">
          <div class="section-card-head">
            <div class="fw-7">👥 Headcount per Semester</div>
            <span class="badge badge-muted">Unique Students</span>
          </div>
          <div class="section-card-body">
            ${hcTrend.length < 2
              ? `<div class="empty" style="padding:24px"><div class="empty-icon" style="font-size:1.5rem">👥</div><div class="empty-text">Need at least 2 semesters of data.</div></div>`
              : trendChart(hcTrend, 'count', '#0d9488', '')}
            ${hcTrend.length ? `
            <div class="table-wrap" style="margin-top:14px">
              <table>
                <thead><tr><th>Semester</th><th>Students Enrolled</th></tr></thead>
                <tbody>
                  ${hcTrend.map(t => `<tr>
                    <td class="fw-6 text-sm">${esc(t.label)}</td>
                    <td><span class="fw-7" style="color:var(--teal)">${t.count}</span></td>
                  </tr>`).join('')}
                </tbody>
              </table>
            </div>` : ''}
          </div>
        </div>
      </div>

      <!-- Row 2: Department Comparison -->
      <div class="section-card mb-20">
        <div class="section-card-head">
          <div class="fw-7">🏫 Department Comparison</div>
          <span class="badge badge-blue">Pass Rate & Headcount</span>
        </div>
        <div class="section-card-body">
          ${depts.length === 0
            ? `<div class="text-muted text-sm">No department data.</div>`
            : `<div class="grid-2">
                <div>
                  <div class="fw-7 text-sm mb-12" style="color:var(--text2)">Pass Rate by Department</div>
                  ${depts.map(d => {
                    const w = d.pass_rate ?? 0;
                    return `<div class="bar-row">
                      <div class="bar-label" style="width:180px;font-size:.78rem">${esc(d.dept_name)}</div>
                      <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${w}%;background:${w>=75?'var(--success)':'var(--warning)'}"></div></div>
                      <div class="bar-val" style="color:${w>=75?'var(--success)':'var(--warning)'};width:52px;text-align:right">${d.pass_rate??'—'}%</div>
                    </div>`;
                  }).join('')}
                </div>
                <div>
                  <div class="fw-7 text-sm mb-12" style="color:var(--text2)">Headcount by Department</div>
                  ${(() => {
                    const maxHc = Math.max(...depts.map(d => d.headcount), 1);
                    return depts.map(d => {
                      const w = Math.round(d.headcount / maxHc * 100);
                      return `<div class="bar-row">
                        <div class="bar-label" style="width:180px;font-size:.78rem">${esc(d.dept_name)}</div>
                        <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${w}%;background:var(--teal)"></div></div>
                        <div class="bar-val" style="color:var(--teal);width:52px;text-align:right">${d.headcount}</div>
                      </div>`;
                    }).join('');
                  })()}
                </div>
              </div>
              <div class="table-wrap" style="margin-top:18px">
                <table>
                  <thead><tr><th>Department</th><th>Students</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th></tr></thead>
                  <tbody>
                    ${depts.map(d => `<tr>
                      <td class="fw-6">${esc(d.dept_name)}</td>
                      <td class="fw-7" style="color:var(--teal)">${d.headcount}</td>
                      <td>${d.total}</td>
                      <td style="color:var(--success)">${d.passed}</td>
                      <td style="color:var(--danger)">${d.failed}</td>
                      <td>${prCell(d.pass_rate)}</td>
                      <td class="mono text-sm">${avgLabel(d.avg_grade)}</td>
                    </tr>`).join('')}
                  </tbody>
                </table>
              </div>`}
        </div>
      </div>

      <!-- Row 3: Grade Distribution -->
      <div class="section-card">
        <div class="section-card-head">
          <div class="fw-7">📐 Grade Distribution</div>
          <span class="badge badge-muted">All submitted grades</span>
        </div>
        <div class="section-card-body">
          ${_gradeDistributionHtml(dist)}
        </div>
      </div>
    `);
  } catch (err) { apiErr(err); }
}

function _gradeDistributionHtml(dist) {
  const total = dist.grand_total || 0;
  if (!total) return '<div class="text-muted text-sm">No grade data yet.</div>';

  const buckets = [
    { label:'1.0 – 1.5 (Excellent / Very Good)', count: dist.excellent,    color:'#16a34a' },
    { label:'1.75 – 2.0 (Good)',                  count: dist.good,         color:'#2563eb' },
    { label:'2.25 – 2.5 (Satisfactory)',          count: dist.satisfactory, color:'#7c3aed' },
    { label:'2.75 – 3.0 (Passing)',               count: dist.passing,      color:'#d97706' },
    { label:'5.0 (Failed)',                        count: dist.failed,       color:'#dc2626' },
    { label:'INC (Incomplete)',                    count: dist.incomplete,   color:'#6b7280' },
  ];

  return buckets.map(b => {
    const pct = total ? Math.round(b.count / total * 100) : 0;
    return `<div class="bar-row">
      <div class="bar-label" style="width:240px;font-size:.78rem">${b.label}</div>
      <div class="bar-track" style="flex:1"><div class="bar-fill" style="width:${pct}%;background:${b.color}"></div></div>
      <div style="display:flex;gap:8px;align-items:center;min-width:80px;justify-content:flex-end">
        <span class="text-sm fw-7" style="color:${b.color}">${b.count}</span>
        <span class="text-xs text-muted">(${pct}%)</span>
      </div>
    </div>`;
  }).join('');
}

function setAnFilter(key, val) {
  if (key === 'college_id') {
    _aFilter.college_id = val;
    _aFilter.dept_id = '';
  } else if (key === 'semester') {
    if (val) {
      const [sy, sem] = val.split('||');
      _aFilter.sy = sy || '';
      _aFilter.sem = sem || '';
    } else {
      _aFilter.sy = '';
      _aFilter.sem = '';
    }
  } else {
    _aFilter[key] = val;
  }
  _drawAnalytics();
}
function clearAnFilter() {
  _aFilter = { college_id: '', dept_id: '', sy: '', sem: '' };
  _drawAnalytics();
}