function renderCollege() {
  const col   = getCollege(currentUser.collegeId);
  const depts = DB.departments.filter(d => d.collegeId === currentUser.collegeId);

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">${col ? esc(col.name) : 'My College'}</div>
        <div class="text-muted text-sm">${depts.length} department(s)</div>
      </div>
    </div>
    <div class="grid-2 mb-20">
      ${depts.map(dept => {
        const subjs  = DB.subjects.filter(s => s.deptId === dept.id);
        const facs   = DB.users.filter(u => u.role === 'Faculty' && u.deptId === dept.id);
        const chair  = DB.users.find(u => u.role === 'Chairman' && u.deptId === dept.id);
        const sids   = secIdsForDept(dept.id);
        const sm     = gradeSummary(sids);
        return `<div class="card">
          <div class="flex-between mb-16">
            <div>
              <div class="fw-7" style="font-size:1rem">${esc(dept.name)}</div>
              ${chair ? `<div class="text-xs text-muted mt-2">Chairman: ${esc(chair.name)}</div>` : ''}
            </div>
            <span class="badge badge-teal">${sids.length} sections</span>
          </div>
          <div class="grid-3 mb-16">
            ${miniStat('Subjects', subjs.length, 'var(--blue)')}
            ${miniStat('Faculty',  facs.length,  'var(--warning)')}
            ${miniStat('Pass Rate', sm.passRate != null ? sm.passRate + '%' : '—', sm.passRate != null && sm.passRate >= 75 ? 'var(--success)' : 'var(--warning)')}
          </div>
          <div class="card-title">Faculty Members</div>
          ${facs.length === 0
            ? '<div class="text-muted text-sm">No faculty assigned.</div>'
            : facs.map(f => `<div class="flex-between mb-8">
                <div class="flex gap-8"><div class="avatar avatar-sm">${initials(f.name)}</div><div class="text-sm fw-6">${esc(f.name)}</div></div>
                <span class="text-xs text-muted">${DB.sections.filter(s => s.facultyId === f.id && sids.includes(s.id)).length} section(s)</span>
              </div>`).join('')}
        </div>`;
      }).join('')}
    </div>
    <div class="section-card">
      <div class="section-card-head"><div class="page-title">All Subjects in College</div></div>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Subject Name</th><th>Units</th><th>Department</th><th>Year</th><th>Sem</th></tr></thead>
        <tbody>${DB.subjects.filter(s => depts.map(d => d.id).includes(s.deptId)).map(s => {
          const dept = getDept(s.deptId);
          return `<tr>
            <td><span class="chip">${esc(s.code)}</span></td>
            <td class="fw-6">${esc(s.name)}</td>
            <td>${s.units}</td>
            <td class="text-sm text-muted">${dept ? esc(dept.name.replace('Department of ', '')) : '—'}</td>
            <td>Year ${s.year}</td>
            <td>${s.sem === 1 ? '1st' : s.sem === 2 ? '2nd' : 'Summer'}</td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   SUBJECT ASSIGNMENT  (Dean + Chairman)
────────────────────────────────────────────── */
