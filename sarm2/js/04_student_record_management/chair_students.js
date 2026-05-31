function renderChairStudents(q = '', activeStudentId = null) {
  const deptId  = currentUser.deptId;
  const colId   = currentUser.collegeId;
  const dept    = getDept(deptId);
  const col     = getCollege(colId);

  let pool = DB.students.filter(s =>
    s.deptId === deptId &&
    s.status !== 'graduated' &&
    s.status !== 'archived'
  );
  if (q) pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase())
  );

  const activeStudent = activeStudentId ? getStudent(activeStudentId) : null;

  // ── Academic Timeline (same logic as Registrar) ──
  function buildTimeline(sid) {
    const s      = getStudent(sid);
    if (!s) return '';
    const myEnr  = DB.enrollments.filter(e => e.studentId === sid);
    const ordMap = {1:'1st',2:'2nd',3:'3rd',4:'4th'};
    const allSemKeys = [...new Set(
      DB.sections.filter(sec => myEnr.some(e=>e.sectionId===sec.id) && sec.submitted)
                 .map(sec => `${sec.sy}|${sec.sem}`)
    )].sort();
    if (!allSemKeys.length) return `<div class="empty" style="padding:30px"><div class="empty-icon" style="font-size:2rem">📭</div><div class="empty-text">No submitted grades yet.</div></div>`;
    function yearOfKey(sy,sem){const ids=DB.sections.filter(s2=>s2.sy===sy&&s2.sem===sem&&s2.submitted&&myEnr.some(e=>e.sectionId===s2.id)).map(s2=>s2.id);const yrs=ids.map(id=>getSubject(getSection(id)?.subjectId)?.year).filter(Boolean);if(!yrs.length)return 0;return yrs.sort((a,b)=>yrs.filter(v=>v===b).length-yrs.filter(v=>v===a).length)[0];}
    const byYear={};
    allSemKeys.forEach(key=>{const[sy,sem]=key.split('|');const yr=yearOfKey(sy,sem)||0;if(!byYear[yr])byYear[yr]=[];byYear[yr].push({sy,sem});});
    const gpa=calcGPA(sid);
    const passed=DB.grades.filter(g=>g.studentId===sid&&getSection(g.sectionId)?.submitted&&g.grade<=3).length;
    const failed=DB.grades.filter(g=>g.studentId===sid&&getSection(g.sectionId)?.submitted&&g.grade>3).length;
    return `
      <div class="flex gap-12 mb-16" style="flex-wrap:wrap">
        <div style="background:var(--success-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:#0d9488">${passed}</div>
          <div style="font-size:.7rem;color:#0d9488;font-weight:600">Passed</div>
        </div>
        <div style="background:var(--danger-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:#dc2626">${failed}</div>
          <div style="font-size:.7rem;color:#dc2626;font-weight:600">Failed</div>
        </div>
        <div style="background:var(--blue-dim);border-radius:10px;padding:10px 18px;text-align:center">
          <div style="font-size:1.3rem;font-weight:800;color:var(--blue)">${gpa?gpa.toFixed(2):'—'}</div>
          <div style="font-size:.7rem;color:var(--blue);font-weight:600">GPA</div>
        </div>
      </div>
      ${Object.keys(byYear).sort((a,b)=>+a-+b).map(yr=>{
        const label=+yr>0?`${ordMap[yr]||yr+'th'} Year`:'Other';
        return `<div style="display:flex;align-items:center;gap:10px;margin-bottom:10px;margin-top:18px"><div style="width:4px;height:24px;background:var(--blue);border-radius:4px;flex-shrink:0"></div><div style="font-size:.95rem;font-weight:800;color:var(--blue)">${label}</div></div>
        ${byYear[yr].map(({sy,sem})=>{
          const secs=DB.sections.filter(sec=>sec.sy===sy&&sec.sem===sem&&sec.submitted&&myEnr.some(e=>e.sectionId===sec.id));
          const sg=semesterGPA(sid,sy,sem);
          return `<div class="section-card mb-10"><div class="section-card-head" style="background:var(--bg3)"><div><div class="fw-7">${sem} Semester — ${sy}</div><div class="text-xs text-muted mt-1">${secs.length} subject(s) · GPA: <strong style="color:${sg?gradeColor(sg):'var(--text3)'}">${sg?sg.toFixed(2):'—'}</strong></div></div>${sg?`<span style="font-size:1.2rem;font-weight:800;color:${gradeColor(sg)}">${sg.toFixed(2)}</span>`:''}</div>
          <div class="table-wrap"><table style="min-width:unset"><thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Grade</th><th>Status</th></tr></thead>
          <tbody>${secs.map(sec=>{const subj=getSubject(sec.subjectId),gr=gradeFor(sid,sec.id),pass=gr&&gr.grade<=3,fail=gr&&gr.grade>3;return`<tr><td><span class="chip">${subj?esc(subj.code):'—'}</span></td><td class="fw-6">${subj?esc(subj.name):'—'}</td><td>${subj?subj.units:'—'}</td><td><span style="color:${gr?gradeColor(gr.grade):'var(--text3)'};font-weight:700;font-family:var(--mono)">${gr?fmt2(gr.grade):'Pending'}</span></td><td>${pass?'<span class="badge badge-success">✔ Passed</span>':fail?'<span class="badge badge-danger">✖ Failed</span>':'<span class="badge badge-muted">Pending</span>'}</td></tr>`;}).join('')}</tbody></table></div></div>`;
        }).join('')}`;
      }).join('')}`;
  }

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Student Records</div>
        <div class="text-sm text-muted mt-1">
          <span style="color:var(--blue);font-weight:600">${esc(dept?.name||'—')}</span>
          <span style="color:var(--text3)"> · ${esc(col?.name||'—')}</span>
        </div>
      </div>
      <div class="search-wrap">
        <input class="search-input" placeholder="Search name or student ID…"
          value="${esc(q)}"
          oninput="renderChairStudents(this.value)">
      </div>
    </div>

    <div style="display:grid;grid-template-columns:${activeStudent?'360px 1fr':'1fr'};gap:20px;align-items:start;width:100%;max-width:100%">

      <!-- Student list -->
      <div class="section-card" style="margin-bottom:0">
        <div class="section-card-head">
          <div class="fw-6">${pool.length} Student(s)</div>
        </div>
        <div class="table-wrap"><table style="min-width:unset">
          <thead><tr><th>ID</th><th>Name</th><th>Year</th><th>Status</th><th></th></tr></thead>
          <tbody>
            ${pool.length===0
              ?`<tr><td colspan="5" class="table-empty">No active students found.</td></tr>`
              :pool.map(s=>`<tr style="${activeStudentId===s.id?'background:var(--blue-dim);':''}">
                  <td class="mono text-xs text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                      ${initials(s.name)}
                    </div>
                    <div>
                      <div class="fw-6" style="font-size:.83rem">${esc(s.name)}</div>
                      <div class="text-xs text-muted">${esc(s.program)}</div>
                    </div>
                  </div></td>
                  <td style="font-size:.82rem">Yr ${s.year}</td>
                  <td><span class="badge badge-${stuStatusBadge(s)}" style="font-size:.65rem">${stuStatus(s)}</span></td>
                  <td>
                    <button class="btn btn-sm btn-primary" style="font-size:.72rem;padding:4px 10px"
                      onclick="renderChairStudents('${q}','${s.id}')">View</button>
                  </td>
                </tr>`).join('')}
          </tbody>
        </table></div>
      </div>

      ${activeStudent ? `
      <div>
        <!-- Profile -->
        <div class="card mb-16">
          <div class="flex gap-16 mb-14">
            <div class="avatar" style="width:52px;height:52px;font-size:1rem;background:${activeStudent.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
              ${initials(activeStudent.name)}
            </div>
            <div style="flex:1">
              <div style="font-size:1.05rem;font-weight:800;color:var(--text)">${esc(activeStudent.name)}</div>
              <div class="text-muted text-sm">${esc(activeStudent.id)} · ${esc(activeStudent.program)}</div>
              <div class="flex gap-8 mt-6">
                <span class="badge badge-teal">Year ${activeStudent.year}</span>
                <span class="badge badge-${stuStatusBadge(activeStudent)}">${stuStatus(activeStudent)}</span>
              </div>
            </div>
            <button class="btn btn-ghost btn-sm" onclick="renderChairStudents('${q}',null)" style="align-self:start">✕</button>
          </div>
          ${infoRow('Email',   activeStudent.email   || '—')}
          ${infoRow('Contact', activeStudent.contact || '—')}
          ${infoRow('Address', activeStudent.address || '—')}
          ${infoRow('Admitted',activeStudent.admitted || '—')}
        </div>
        <!-- Academic Timeline -->
        <div class="section-card" style="margin-bottom:0">
          <div class="section-card-head" style="background:var(--bg3)">
            <div class="fw-7">📚 Academic Timeline</div>
            <div class="text-xs text-muted">All Semesters · All Year Levels</div>
          </div>
          <div class="section-card-body">${buildTimeline(activeStudent.id)}</div>
        </div>
      </div>` : `
      <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
        <div class="empty-icon">👆</div>
        <div class="empty-text">Click <strong>View</strong> on any student to see their profile and academic timeline.</div>
      </div>`}
    </div>
  `);
}


/* ──────────────────────────────────────────────
   ARCHIVES MODULE
   Registrar  : browse all colleges → depts → archived students
   Chairman   : browse own college  → depts → archived students
   Folder tree: College → Department → Archived list
────────────────────────────────────────────── */
