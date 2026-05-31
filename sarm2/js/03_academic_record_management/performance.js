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
