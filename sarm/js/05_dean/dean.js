'use strict';

/* ══════════════════════════════════════════
   DEAN — Academic Performance Monitoring
══════════════════════════════════════════ */

registerPage('dean-perf', renderDeanPerf);

function renderDeanPerf() {
  const col     = getCollege(currentUser.collegeId);
  const depts   = DB.departments.filter(d => d.collegeId === currentUser.collegeId);
  const allSecIds = secIdsForCollege(currentUser.collegeId).filter(sid => getSection(sid)?.submitted);
  const sm      = gradeSummary(allSecIds);
  const yearData = perfByYear(allSecIds);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Academic Performance</div>
        <div class="page-sub">${col ? esc(col.name) : '—'} · Submitted grades only</div>
      </div>
    </div>

    <!-- Summary stats -->
    <div class="grid-4 mb-20">
      ${statCard('📊','Total Grades', sm.total,  '#374151', '#f3f4f6')}
      ${statCard('✅','Passed',       sm.passed, 'var(--success)', '#dcfce7')}
      ${statCard('❌','Failed',       sm.failed, 'var(--danger)',  '#fee2e2')}
      ${statCard('📈','Pass Rate', sm.passRate != null ? sm.passRate+'%':'—', 'var(--blue)', '#dbeafe')}
    </div>

    <!-- Performance by Year Level -->
    <div class="section-card mb-20">
      <div class="section-card-head">
        <div class="fw-7">Performance by Year Level</div>
        <div class="text-xs text-muted">Based on submitted grades</div>
      </div>
      <div class="section-card-body">
        ${yearData.length === 0
          ? `<div class="text-muted text-sm">No submitted grades yet.</div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Year Level</th><th>Total Grades</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Average</th><th>Visual</th></tr></thead>
                <tbody>
                  ${yearData.map(r => `
                    <tr>
                      <td class="fw-7">Year ${r.year}</td>
                      <td>${r.total}</td>
                      <td style="color:var(--success);font-weight:700">${r.passed}</td>
                      <td style="color:var(--danger);font-weight:700">${r.failed}</td>
                      <td>${prCell(r.passRate)}</td>
                      <td class="mono text-sm">${r.avg ? fmt2(r.avg) : '—'}</td>
                      <td style="min-width:140px">
                        <div class="bar-track"><div class="bar-fill" style="width:${r.passRate||0}%;background:${r.passRate!=null&&r.passRate>=75?'var(--success)':'var(--warning)'}"></div></div>
                      </td>
                    </tr>`).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    </div>

    <!-- Performance by Department -->
    <div class="section-card mb-20">
      <div class="section-card-head"><div class="fw-7">Performance by Department</div></div>
      <div class="section-card-body">
        ${depts.length === 0
          ? `<div class="text-muted text-sm">No departments found.</div>`
          : `<div class="table-wrap">
              <table>
                <thead><tr><th>Department</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Average</th></tr></thead>
                <tbody>
                  ${depts.map(dept => {
                    const sids = secIdsForDept(dept.id).filter(sid => getSection(sid)?.submitted);
                    const sm   = gradeSummary(sids);
                    return `<tr>
                      <td class="fw-6">${esc(dept.name)}</td>
                      <td>${sm.total}</td>
                      <td style="color:var(--success)">${sm.passed}</td>
                      <td style="color:var(--danger)">${sm.failed}</td>
                      <td>${prCell(sm.passRate)}</td>
                      <td class="mono text-sm">${sm.avg ? fmt2(sm.avg) : '—'}</td>
                    </tr>`;
                  }).join('')}
                </tbody>
              </table>
            </div>`}
      </div>
    </div>

    <!-- Pass Rate by Year — Bar Chart -->
    <div class="card">
      <div class="card-title">Pass Rate by Year Level</div>
      ${yearData.length === 0
        ? `<div class="text-muted text-sm">No data yet.</div>`
        : yearData.map(r => barRow(`Year ${r.year}`, r.passRate, r.passRate != null && r.passRate >= 75 ? 'var(--success)' : 'var(--warning)')).join('')}
    </div>
  `);
}
