function renderArchives(filterCol = null, filterDept = null, q = '') {
  const isRegistrar = currentUser.role === 'Registrar';
  const isChairman  = currentUser.role === 'Chairman';

  // Chairman is scoped to their own college only
  const allowedColIds = isRegistrar
    ? DB.colleges.map(c => c.id)
    : isChairman
      ? [currentUser.collegeId]
      : [];

  if (!allowedColIds.length) {
    set(`<div class="empty"><div class="empty-icon">🚫</div><div class="empty-text">Access denied.</div></div>`);
    return;
  }

  // Force chairman to their college
  if (isChairman && filterCol && filterCol !== currentUser.collegeId) {
    filterCol = currentUser.collegeId;
  }

  const colleges = DB.colleges.filter(c => allowedColIds.includes(c.id));
  const depts    = DB.departments;

  let pool = DB.students.filter(s =>
    (s.status === 'graduated' || s.status === 'archived') &&
    allowedColIds.includes(s.collegeId)
  );
  if (filterCol)  pool = pool.filter(s => s.collegeId === filterCol);
  if (filterDept) pool = pool.filter(s => s.deptId    === filterDept);
  if (q)          pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  );

  const colLabel  = filterCol  ? getCollege(filterCol)?.name : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name   : null;

  let breadcrumb = `<span onclick="renderArchives()" style="cursor:pointer;color:var(--blue)">Archives</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderArchives(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">📦 Archives</div>
        <div class="text-sm text-muted" style="margin-top:4px">${breadcrumb}</div>
      </div>
      ${(filterDept || q) ? `<div class="search-wrap">
        <input class="search-input" placeholder="Search name or ID…"
          value="${esc(q)}"
          oninput="renderArchives(${filterCol||'null'},${filterDept||'null'},this.value)">
      </div>` : ''}
    </div>

    ${/* Summary stats at top level */(!filterCol && !q) ? `
      <div class="grid-4 mb-20">
        ${statCard('🗃', 'Total Archived', DB.students.filter(s=>(s.status==='graduated'||s.status==='archived')&&allowedColIds.includes(s.collegeId)).length, 'var(--text3)', 'var(--bg4)')}
        ${statCard('🎓', 'Graduated',      DB.students.filter(s=>s.status==='graduated'&&allowedColIds.includes(s.collegeId)).length, 'var(--success)', 'var(--success-dim)')}
        ${statCard('📁', 'Transferred/Withdrew', DB.students.filter(s=>s.status==='archived'&&allowedColIds.includes(s.collegeId)).length, 'var(--warning)', 'var(--warning-dim)')}
        ${statCard('🏛', 'Colleges', colleges.length, 'var(--blue)', 'var(--blue-dim)')}
      </div>` : ''}

    <!-- College folders -->
    ${!filterCol && !q ? `
      <div class="mb-8 text-sm text-muted fw-6">COLLEGES</div>
      <div class="grid-3 mb-24">
        ${colleges.map(col => {
          const total    = DB.students.filter(s => s.collegeId===col.id && (s.status==='graduated'||s.status==='archived')).length;
          const grads    = DB.students.filter(s => s.collegeId===col.id && s.status==='graduated').length;
          return `<div onclick="renderArchives(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2rem;margin-bottom:10px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;color:var(--text);margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-12">${depts.filter(d=>d.collegeId===col.id).length} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.4rem;font-weight:800;color:var(--text3)">${total}</span>
              <div>
                <span class="badge badge-success" style="font-size:.65rem">🎓 ${grads}</span>
                <span class="badge badge-muted"   style="font-size:.65rem;margin-left:4px">📁 ${total-grads}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Department folders -->
    ${filterCol && !filterDept && !q ? `
      <div class="mb-8 text-sm text-muted fw-6">DEPARTMENTS</div>
      <div class="grid-3 mb-24">
        ${depts.filter(d => d.collegeId === filterCol).map(dept => {
          const total = DB.students.filter(s => s.deptId===dept.id && (s.status==='graduated'||s.status==='archived')).length;
          const grads = DB.students.filter(s => s.deptId===dept.id && s.status==='graduated').length;
          return `<div onclick="renderArchives(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:20px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2rem;margin-bottom:10px">📂</div>
            <div class="fw-7" style="font-size:.9rem;color:var(--text);margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-12">
              <span style="font-size:1.4rem;font-weight:800;color:var(--text3)">${total}</span>
              <div>
                <span class="badge badge-success" style="font-size:.65rem">🎓 ${grads}</span>
                <span class="badge badge-muted"   style="font-size:.65rem;margin-left:4px">📁 ${total-grads}</span>
              </div>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    <!-- Archived student list -->
    ${(filterDept || q) ? `
      <div class="section-card">
        <div class="section-card-head">
          <div class="fw-6">
            ${filterDept ? esc(deptLabel || '') : 'Search Results'} —
            ${pool.length} archived record(s)
          </div>
          ${filterDept ? `<div class="search-wrap">
            <input class="search-input" placeholder="Search…"
              value="${esc(q)}"
              oninput="renderArchives(${filterCol||'null'},${filterDept||'null'},this.value)">
          </div>` : ''}
        </div>
        <div class="table-wrap"><table>
          <thead><tr>
            <th>Student ID</th><th>Name</th><th>Program</th>
            <th>Year Level</th><th>Archive Reason</th><th>Archived Date</th><th>Archived By</th>
            ${isRegistrar ? '<th>Actions</th>' : ''}
          </tr></thead>
          <tbody>
            ${pool.length === 0
              ? `<tr><td colspan="${isRegistrar?8:7}" class="table-empty">No archived records found.</td></tr>`
              : pool.map(s => `<tr>
                  <td class="mono text-sm text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                      ${initials(s.name)}
                    </div>
                    <div>
                      <div class="fw-6">${esc(s.name)}</div>
                      <div class="text-xs text-muted">${esc(s.archiveNote || '—')}</div>
                    </div>
                  </div></td>
                  <td class="text-sm">${esc(s.program)}</td>
                  <td>Year ${s.year}</td>
                  <td><span class="badge badge-${s.status==='graduated'?'success':'warning'}">${s.status==='graduated'?'🎓 Graduated':'📁 Transferred/Withdrew'}</span></td>
                  <td class="text-sm text-muted">${esc(s.archivedAt || '—')}</td>
                  <td class="text-sm text-muted">${esc(s.archivedBy || '—')}</td>
                  ${isRegistrar ? `<td>
                    <button class="btn btn-sm btn-ghost" onclick="restoreStudent('${s.id}',${filterCol||'null'},${filterDept||'null'})">↩ Restore</button>
                  </td>` : ''}
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>` : ''}
  `);
}

/* ── Restore archived student back to enrolled ── */
function restoreStudent(sid, filterCol, filterDept) {
  const s = getStudent(sid);
  if (!s) return;
  if (!confirm(`Restore ${s.name} to active (Enrolled) status?`)) return;
  s.status      = 'enrolled';
  s.archiveNote = null;
  s.archivedAt  = null;
  s.archivedBy  = null;
  save();
  logAudit(`Student restored: ${sid} — ${s.name}`);
  toast(`${s.name} restored to Enrolled status`, 'success');
  renderArchives(filterCol, filterDept);
}


/* ══════════════════════════════════════════════
   END STUDENT RECORDS MODULE
══════════════════════════════════════════════ */

/* ══════════════════════════════════════════════
   CURRICULUM MODULE  (Registrar)
   Set subjects per college/dept per year level
   with optional prerequisite linking
