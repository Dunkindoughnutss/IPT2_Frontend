'use strict';

/* ══════════════════════════════════════════
   DEAN — Academic Performance (API)
══════════════════════════════════════════ */

registerPage('dean-perf', renderDeanPerf);

async function renderDeanPerf() {
  set(`<div class="empty"><div class="empty-icon">⏳</div><div class="empty-text">Loading…</div></div>`);
  try {
    const analytics = await api.getAnalytics();
    const trend     = analytics.semester_trend;
    const dist      = analytics.grade_distribution;
    const depts     = analytics.dept_comparison;
    const averageGpa = avgLabel(_overallAverageGpa(trend));

    // Performance by year: derive from semester trend data
    const yearData = _perfByYearFromTrend(trend);

    set(`
      <div class="page-header">
        <div><div class="page-title">Academic Performance</div>
        <div class="page-sub">Submitted grades only</div></div>
      </div>

      <div class="grid-4 mb-20">
        ${statCard('📊','Total Grades', dist.grand_total,  '#374151','#f3f4f6')}
        ${statCard('✅','Passed',        dist.passed ?? 0,  'var(--success)','#dcfce7')}
        ${statCard('❌','Failed',         dist.failed ?? 0,  'var(--danger)','#fee2e2')}
        ${statCard('📈','Average GPA', averageGpa,  'var(--blue)','#dbeafe')}
      </div>

      <div class="section-card mb-20">
        <div class="section-card-head"><div class="fw-7">Performance by Department</div></div>
        <div class="section-card-body">
          <div class="table-wrap"><table>
            <thead><tr><th>Department</th><th>Total</th><th>Passed</th><th>Failed</th><th>Pass Rate</th><th>Avg Grade</th></tr></thead>
            <tbody>
              ${depts.length === 0
                ? `<tr><td colspan="6" class="table-empty">No data yet.</td></tr>`
                : depts.map(d => `<tr>
                    <td class="fw-6">${esc(d.dept_name)}</td>
                    <td>${d.total}</td>
                    <td style="color:var(--success)">${d.passed}</td>
                    <td style="color:var(--danger)">${d.failed}</td>
                    <td>${prCell(d.pass_rate)}</td>
                    <td class="mono text-sm">${avgLabel(d.avg_grade)}</td>
                  </tr>`).join('')}
            </tbody>
          </table></div>
        </div>
      </div>

      <div class="card">
        <div class="card-title">Pass Rate by Department</div>
        ${depts.map(d => barRow(d.dept_name, d.pass_rate, d.pass_rate != null && d.pass_rate >= 75 ? 'var(--success)' : 'var(--warning)')).join('')
          || '<div class="text-muted text-sm">No data.</div>'}
      </div>
    `);
  } catch (err) { apiErr(err); }
}

function _overallAverageGpa(trend) {
  const rows = trend.filter(t => t.total && t.avg_grade != null);
  if (!rows.length) return null;
  const totalCount = rows.reduce((sum, t) => sum + (toNum(t.total) || 0), 0);
  if (!totalCount) return null;
  const weightedSum = rows.reduce((sum, t) => sum + (toNum(t.avg_grade) || 0) * (toNum(t.total) || 0), 0);
  return totalCount ? weightedSum / totalCount : null;
}

function _perfByYearFromTrend(trend) {
  // Aggregate all semesters (simple union)
  return trend;
}