function renderStudentRecords(filterCol = null, filterDept = null, q = '', activeStudentId = null) {
  const isRegistrar = currentUser.role === 'Registrar';
  const colleges    = DB.colleges;
  const depts       = DB.departments;

  let pool = DB.students.filter(s => s.status !== 'graduated' && s.status !== 'archived');
  if (filterCol)  pool = pool.filter(s => s.collegeId === filterCol);
  if (filterDept) pool = pool.filter(s => s.deptId    === filterDept);
  if (q)          pool = pool.filter(s =>
    s.name.toLowerCase().includes(q.toLowerCase()) ||
    s.id.toLowerCase().includes(q.toLowerCase()) ||
    s.program.toLowerCase().includes(q.toLowerCase())
  );

  const colLabel  = filterCol  ? getCollege(filterCol)?.name : null;
  const deptLabel = filterDept ? getDept(filterDept)?.name   : null;

  let breadcrumb = `<span onclick="renderStudentRecords()" style="cursor:pointer;color:var(--blue)">All Colleges</span>`;
  if (filterCol)  breadcrumb += ` <span style="color:var(--text3)">›</span> <span onclick="renderStudentRecords(${filterCol})" style="cursor:pointer;color:var(--blue)">${esc(colLabel?.replace('College of ','') || '')}</span>`;
  if (filterDept) breadcrumb += ` <span style="color:var(--text3)">›</span> <span style="color:var(--text2)">${esc(deptLabel?.replace('Department of ','') || '')}</span>`;

  // ── Academic Timeline builder ──
  function buildAcademicTimeline(sid) {
    const s      = getStudent(sid);
    if (!s) return '';
    const myEnr  = DB.enrollments.filter(e => e.studentId === sid);
    const ordMap = {1:'1st',2:'2nd',3:'3rd',4:'4th'};

    // Group submitted sections by year then semester
    const allSemKeys = [...new Set(
      DB.sections.filter(sec => myEnr.some(e => e.sectionId === sec.id) && sec.submitted)
                 .map(sec => `${sec.sy}|${sec.sem}`)
    )].sort();

    if (!allSemKeys.length) return `<div class="empty" style="padding:30px"><div class="empty-icon" style="font-size:2rem">📭</div><div class="empty-text">No submitted grades on record yet.</div></div>`;

    // Group by year level
    function yearOfSemKey(sy, sem) {
      const secIds = DB.sections.filter(s2 => s2.sy===sy && s2.sem===sem && s2.submitted && myEnr.some(e => e.sectionId===s2.id)).map(s2=>s2.id);
      const years  = secIds.map(secId => getSubject(getSection(secId)?.subjectId)?.year).filter(Boolean);
      if (!years.length) return 0;
      return years.sort((a,b) => years.filter(v=>v===b).length - years.filter(v=>v===a).length)[0];
    }

    const byYear = {};
    allSemKeys.forEach(key => {
      const [sy,sem] = key.split('|');
      const yr = yearOfSemKey(sy,sem) || 0;
      if (!byYear[yr]) byYear[yr] = [];
      byYear[yr].push({sy,sem});
    });

    const totalPassed = DB.grades.filter(g => g.studentId===sid && getSection(g.sectionId)?.submitted && g.grade<=3).length;
    const totalFailed = DB.grades.filter(g => g.studentId===sid && getSection(g.sectionId)?.submitted && g.grade>3).length;
    const gpa         = calcGPA(sid);

    return `
      <div class="flex gap-12 mb-20" style="flex-wrap:wrap">
        <div style="background:var(--success-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:#0d9488">${totalPassed}</div>
          <div style="font-size:.72rem;color:#0d9488;font-weight:600">Subjects Passed</div>
        </div>
        <div style="background:var(--danger-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:#dc2626">${totalFailed}</div>
          <div style="font-size:.72rem;color:#dc2626;font-weight:600">Subjects Failed</div>
        </div>
        <div style="background:var(--blue-dim);border-radius:10px;padding:12px 20px;text-align:center;min-width:100px">
          <div style="font-size:1.4rem;font-weight:800;color:var(--blue)">${gpa ? gpa.toFixed(2) : '—'}</div>
          <div style="font-size:.72rem;color:var(--blue);font-weight:600">Overall GPA</div>
        </div>
      </div>

      ${Object.keys(byYear).sort((a,b)=>+a-+b).map(yr => {
        const label = +yr > 0 ? `${ordMap[yr] || yr+'th'} Year` : 'Other';
        return `
          <div style="display:flex;align-items:center;gap:10px;margin-bottom:12px;margin-top:20px">
            <div style="width:4px;height:26px;background:var(--blue);border-radius:4px;flex-shrink:0"></div>
            <div style="font-size:1rem;font-weight:800;color:var(--blue)">${label}</div>
          </div>
          ${byYear[yr].map(({sy,sem}) => {
            const semSecs = DB.sections.filter(sec =>
              sec.sy===sy && sec.sem===sem && sec.submitted &&
              myEnr.some(e=>e.sectionId===sec.id)
            );
            const semGPA = semesterGPA(sid,sy,sem);
            return `
              <div class="section-card mb-12">
                <div class="section-card-head" style="background:var(--bg3)">
                  <div>
                    <div class="fw-7">${sem} Semester — ${sy}</div>
                    <div class="text-xs text-muted mt-1">${semSecs.length} subject(s) · Semester GPA:
                      <strong style="color:${semGPA?gradeColor(semGPA):'var(--text3)'}">${semGPA?semGPA.toFixed(2):'—'}</strong>
                    </div>
                  </div>
                  ${semGPA ? `<span style="font-size:1.3rem;font-weight:800;color:${gradeColor(semGPA)}">${semGPA.toFixed(2)}</span>` : ''}
                </div>
                <div class="table-wrap"><table style="min-width:unset">
                  <thead><tr>
                    <th>Code</th><th>Subject</th><th>Units</th><th>Final Grade</th><th>Status</th>
                  </tr></thead>
                  <tbody>${semSecs.map(sec => {
                    const subj = getSubject(sec.subjectId);
                    const gr   = gradeFor(sid, sec.id);
                    const pass = gr && gr.grade <= 3;
                    const fail = gr && gr.grade > 3;
                    return `<tr>
                      <td><span class="chip">${subj?esc(subj.code):'—'}</span></td>
                      <td class="fw-6">${subj?esc(subj.name):'—'}</td>
                      <td>${subj?subj.units:'—'}</td>
                      <td><span style="color:${gr?gradeColor(gr.grade):'var(--text3)'};font-weight:700;font-family:var(--mono);font-size:.95rem">${gr?fmt2(gr.grade):'Pending'}</span></td>
                      <td>${pass?'<span class="badge badge-success">✔ Passed</span>':fail?'<span class="badge badge-danger">✖ Failed</span>':'<span class="badge badge-muted">Pending</span>'}</td>
                    </tr>`;
                  }).join('')}</tbody>
                </table></div>
              </div>`;
          }).join('')}`;
      }).join('')}`;
  }

  // ── Active student detail panel ──
  const activeStudent = activeStudentId ? getStudent(activeStudentId) : null;

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Student Records</div>
        <div class="text-sm text-muted" style="margin-top:4px">${breadcrumb}</div>
      </div>
      <div class="flex gap-12">
        ${(filterDept || q) ? `<div class="search-wrap">
          <input class="search-input" placeholder="Search name, ID, program…"
            value="${esc(q)}"
            oninput="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},this.value)">
        </div>` : ''}
        <button class="btn btn-primary" onclick="showAddStudentModal()">+ Add Student</button>
      </div>
    </div>

    ${/* College folder level */!filterCol ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A COLLEGE</div>
      <div class="grid-3 mb-20">
        ${colleges.map(col => {
          const count    = DB.students.filter(s => s.collegeId===col.id && s.status!=='graduated' && s.status!=='archived').length;
          const deptCnt  = depts.filter(d => d.collegeId===col.id).length;
          return `<div onclick="renderStudentRecords(${col.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--blue)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">🏛</div>
            <div class="fw-7" style="font-size:.95rem;color:var(--text);margin-bottom:4px">${esc(col.name)}</div>
            <div class="text-xs text-muted mb-14">${deptCnt} department(s)</div>
            <div class="flex-between">
              <span style="font-size:1.6rem;font-weight:800;color:var(--blue)">${count}</span>
              <span class="badge badge-info">Active</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    ${/* Department folder level */filterCol && !filterDept && !q ? `
      <div class="mb-8 text-sm text-muted fw-6" style="letter-spacing:.8px">SELECT A DEPARTMENT</div>
      <div class="grid-3 mb-20">
        ${depts.filter(d => d.collegeId===filterCol).map(dept => {
          const count = DB.students.filter(s => s.deptId===dept.id && s.status!=='graduated' && s.status!=='archived').length;
          return `<div onclick="renderStudentRecords(${filterCol},${dept.id})"
            style="cursor:pointer;background:var(--white);border:1.5px solid var(--border);border-radius:var(--radius-lg);padding:22px;box-shadow:var(--shadow);transition:all .18s"
            onmouseover="this.style.borderColor='var(--teal)';this.style.transform='translateY(-2px)'"
            onmouseout="this.style.borderColor='var(--border)';this.style.transform='none'">
            <div style="font-size:2.2rem;margin-bottom:12px">📁</div>
            <div class="fw-7" style="font-size:.9rem;color:var(--text);margin-bottom:4px">${esc(dept.name)}</div>
            <div class="flex-between mt-14">
              <span style="font-size:1.6rem;font-weight:800;color:var(--teal)">${count}</span>
              <span class="badge badge-teal">Active</span>
            </div>
          </div>`;
        }).join('')}
      </div>` : ''}

    ${/* Student list + detail side-by-side */(filterDept || q) ? `
      <div style="display:grid;grid-template-columns:${activeStudent?'380px 1fr':'1fr'};gap:20px;align-items:start;width:100%;max-width:100%">

        <!-- Student list -->
        <div class="section-card" style="margin-bottom:0">
          <div class="section-card-head">
            <div class="fw-6">${filterDept?esc(deptLabel||''):'Search Results'} — ${pool.length} student(s)</div>
          </div>
          <div class="table-wrap"><table style="min-width:unset">
            <thead><tr>
              <th>ID</th><th>Name</th><th>Year</th><th>Status</th><th>Actions</th>
            </tr></thead>
            <tbody>
              ${pool.length===0
                ?`<tr><td colspan="5" class="table-empty">No students found.</td></tr>`
                :pool.map(s=>`<tr style="${activeStudentId===s.id?'background:var(--blue-dim);':''}" >
                    <td class="mono text-xs text-muted">${esc(s.id)}</td>
                    <td>
                      <div class="flex gap-8">
                        <div class="avatar avatar-sm" style="background:${s.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                          ${initials(s.name)}
                        </div>
                        <div>
                          <div class="fw-6" style="font-size:.84rem">${esc(s.name)}</div>
                          <div class="text-xs text-muted">${esc(s.program)}</div>
                        </div>
                      </div>
                    </td>
                    <td style="font-size:.82rem">Yr ${s.year}</td>
                    <td><span class="badge badge-${stuStatusBadge(s)}" style="font-size:.66rem">${stuStatus(s)}</span></td>
                    <td>
                      <button class="btn btn-sm btn-primary" style="font-size:.72rem;padding:4px 10px"
                        onclick="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},'${q}','${s.id}')">
                        View
                      </button>
                    </td>
                  </tr>`).join('')}
            </tbody>
          </table></div>
        </div>

        ${/* Student detail panel — shows when a student is selected */activeStudent ? `
        <div>
          <!-- Profile card -->
          <div class="card mb-16">
            <div class="flex gap-16 mb-16">
              <div class="avatar" style="width:56px;height:56px;font-size:1rem;background:${activeStudent.gender==='Female'?'linear-gradient(135deg,#ec4899,#f472b6)':'linear-gradient(135deg,var(--blue),var(--blue2))'}">
                ${initials(activeStudent.name)}
              </div>
              <div style="flex:1">
                <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${esc(activeStudent.name)}</div>
                <div class="text-muted text-sm">${esc(activeStudent.id)} · ${esc(activeStudent.program)}</div>
                <div class="flex gap-8 mt-6">
                  <span class="badge badge-teal">Year ${activeStudent.year}</span>
                  <span class="badge badge-${stuStatusBadge(activeStudent)}">${stuStatus(activeStudent)}</span>
                  <span class="badge ${activeStudent.gender==='Female'?'badge-danger':'badge-info'}">${activeStudent.gender}</span>
                </div>
              </div>
              <button class="btn btn-ghost btn-sm"
                onclick="renderStudentRecords(${filterCol||'null'},${filterDept||'null'},'${q}',null)"
                style="align-self:start">✕ Close</button>
            </div>
            <div style="display:grid;grid-template-columns:1fr 1fr;gap:0">
              ${infoRow('Student ID',   activeStudent.id)}
              ${infoRow('Email',        activeStudent.email   || '—')}
              ${infoRow('Contact',      activeStudent.contact || '—')}
              ${infoRow('Address',      activeStudent.address || '—')}
              ${infoRow('Admitted',     activeStudent.admitted || '—')}
            </div>
            <div class="flex gap-8 mt-14">
              <button class="btn btn-ghost btn-sm" onclick="showEditStudentModal('${activeStudent.id}')">✎ Edit Profile</button>
              <button class="btn btn-sm btn-danger" onclick="showArchiveStudentModal('${activeStudent.id}')">🗃 Archive</button>
            </div>
          </div>

          <!-- Academic Timeline -->
          <div class="section-card" style="margin-bottom:0">
            <div class="section-card-head" style="background:var(--bg3)">
              <div class="fw-7">📚 Academic Timeline</div>
              <div class="text-xs text-muted">1st Year → 4th Year · All Semesters</div>
            </div>
            <div class="section-card-body">
              ${buildAcademicTimeline(activeStudent.id)}
            </div>
          </div>
        </div>` : `
        <div class="empty" style="background:var(--white);border:1.5px dashed var(--border);border-radius:var(--radius-lg);padding:60px">
          <div class="empty-icon">👆</div>
          <div class="empty-text">Click <strong>View</strong> on any student to see their profile and full academic timeline.</div>
        </div>`}
      </div>` : ''}
  `);
}

/* ── Add Student ── */
function showAddStudentModal() {
  const colOpts  = DB.colleges.map(c    => `<option value="${c.id}">${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
  const nextId   = String(DB.nextId.student || 100001);

  showModal('Add New Student Record', `
    <div class="grid-2">
      <div class="field-wrap">
        <div class="field-label">Student ID <span style="font-weight:400;text-transform:none;color:var(--text4)">(auto-assigned)</span></div>
        <input class="input" value="${esc(nextId)}" disabled style="opacity:.6;background:var(--bg4);font-family:var(--mono);font-weight:700;color:var(--blue)">
      </div>
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="s-name" class="input" placeholder="Juan dela Cruz"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Program</div><input id="s-prog" class="input" placeholder="BS Information Technology"></div>
      <div class="field-wrap"><div class="field-label">Year Admitted</div><input id="s-admit" class="input" placeholder="${new Date().getFullYear()}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">College</div>
        <select id="s-col" class="select-input" onchange="stuDeptFilter(this.value)">${colOpts}</select>
      </div>
      <div class="field-wrap"><div class="field-label">Department</div>
        <select id="s-dept" class="select-input">${deptOpts}</select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="s-year" class="select-input">
          <option value="1">1st Year</option><option value="2">2nd Year</option>
          <option value="3">3rd Year</option><option value="4">4th Year</option>
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Gender</div>
        <select id="s-gender" class="select-input"><option>Male</option><option>Female</option></select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Email</div><input id="s-email" class="input" placeholder="student@uep.edu.ph"></div>
      <div class="field-wrap"><div class="field-label">Contact</div><input id="s-contact" class="input" placeholder="09xxxxxxxxx"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Address</div><input id="s-addr" class="input" placeholder="City, Province"></div>
      <div class="field-wrap">
        <div class="field-label">Birthday <span style="font-weight:400;text-transform:none;color:var(--text4)">— login password (mmddyyyy)</span></div>
        <input id="s-bday" class="input" placeholder="02242003" maxlength="8">
      </div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="addStudent()">Save Record</button>`
  );
}

function stuDeptFilter(colId) {
  const sel   = document.getElementById('s-dept');
  if (!sel) return;
  const depts = DB.departments.filter(d => d.collegeId === +colId);
  sel.innerHTML = depts.map(d => `<option value="${d.id}">${esc(d.name)}</option>`).join('');
}

function addStudent() {
  const id      = String(DB.nextId.student || 100001);
  const name    = document.getElementById('s-name').value.trim();
  const prog    = document.getElementById('s-prog').value.trim();
  const admit   = document.getElementById('s-admit').value.trim();
  const colId   = +document.getElementById('s-col').value;
  const deptId  = +document.getElementById('s-dept').value;
  const year    = +document.getElementById('s-year').value;
  const gender  = document.getElementById('s-gender').value;
  const email   = document.getElementById('s-email').value.trim();
  const contact = document.getElementById('s-contact').value.trim();
  const addr    = document.getElementById('s-addr').value.trim();
  const bday    = document.getElementById('s-bday').value.trim().replace(/\D/g,'');

  if (!name || !prog) { toast('Name and Program are required', 'error'); return; }
  if (!colId)         { toast('Please select a College', 'error'); return; }
  if (!deptId)        { toast('Please select a Department', 'error'); return; }
  if (bday && bday.length !== 8) { toast('Birthday must be 8 digits: mmddyyyy', 'error'); return; }

  DB.students.push({
    id, name, deptId, collegeId: colId, program: prog, year,
    gender, status: 'enrolled', adviserId: null,
    email, contact, address: addr, admitted: admit,
    birthday: bday || null,
  });
  DB.nextId.student = (DB.nextId.student || 100001) + 1;
  save();
  logAudit(`Student record added: ${id} — ${name}`);
  toast(`Student record added. ID: ${id}`, 'success');
  closeModal();
  renderStudentRecords(colId, deptId);
}

/* ── Edit Student ── */
function showEditStudentModal(sid) {
  const s = getStudent(sid);
  if (!s) return;
  const colOpts  = DB.colleges.map(c    => `<option value="${c.id}" ${c.id===s.collegeId?'selected':''}>${esc(c.name)}</option>`).join('');
  const deptOpts = DB.departments.map(d => `<option value="${d.id}" ${d.id===s.deptId?'selected':''}>${esc(d.name)}</option>`).join('');
  showModal(`Edit Student — ${esc(s.name)}`, `
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Student ID</div><input class="input" value="${esc(s.id)}" disabled style="opacity:.5"></div>
      <div class="field-wrap"><div class="field-label">Full Name</div><input id="es-name" class="input" value="${esc(s.name)}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Program</div><input id="es-prog" class="input" value="${esc(s.program)}"></div>
      <div class="field-wrap"><div class="field-label">Year Admitted</div><input id="es-admit" class="input" value="${esc(s.admitted||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">College</div><select id="es-col" class="select-input">${colOpts}</select></div>
      <div class="field-wrap"><div class="field-label">Department</div><select id="es-dept" class="select-input">${deptOpts}</select></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Year Level</div>
        <select id="es-year" class="select-input">
          ${[1,2,3,4].map(y => `<option value="${y}" ${s.year===y?'selected':''}>${y === 1?'1st':y===2?'2nd':y===3?'3rd':'4th'} Year</option>`).join('')}
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Gender</div>
        <select id="es-gender" class="select-input">
          <option ${s.gender==='Male'?'selected':''}>Male</option>
          <option ${s.gender==='Female'?'selected':''}>Female</option>
        </select>
      </div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Status</div>
        <select id="es-status" class="select-input">
          <option value="enrolled"  ${s.status==='enrolled'?'selected':''}>Enrolled</option>
          <option value="inactive"  ${s.status==='inactive'?'selected':''}>Inactive</option>
        </select>
      </div>
      <div class="field-wrap"><div class="field-label">Email</div><input id="es-email" class="input" value="${esc(s.email||'')}"></div>
    </div>
    <div class="grid-2">
      <div class="field-wrap"><div class="field-label">Contact</div><input id="es-contact" class="input" value="${esc(s.contact||'')}"></div>
      <div class="field-wrap"><div class="field-label">Address</div><input id="es-addr" class="input" value="${esc(s.address||'')}"></div>
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-primary" onclick="editStudent('${sid}')">Save Changes</button>`
  );
}

function editStudent(sid) {
  const s = getStudent(sid);
  if (!s) return;
  s.name      = document.getElementById('es-name').value.trim()    || s.name;
  s.program   = document.getElementById('es-prog').value.trim()    || s.program;
  s.admitted  = document.getElementById('es-admit').value.trim()   || s.admitted;
  s.collegeId = +document.getElementById('es-col').value;
  s.deptId    = +document.getElementById('es-dept').value;
  s.year      = +document.getElementById('es-year').value;
  s.gender    = document.getElementById('es-gender').value;
  s.status    = document.getElementById('es-status').value;
  s.email     = document.getElementById('es-email').value.trim();
  s.contact   = document.getElementById('es-contact').value.trim();
  s.address   = document.getElementById('es-addr').value.trim();
  save();
  logAudit(`Student record edited: ${sid} — ${s.name}`);
  toast('Student record updated', 'success');
  closeModal();
  renderStudentRecords(s.collegeId, s.deptId);
}

/* ── Archive Student ── */
function showArchiveStudentModal(sid) {
  const s = getStudent(sid);
  if (!s) return;
  const col  = getCollege(s.collegeId);
  const dept = getDept(s.deptId);
  showModal('Archive Student Record', `
    <div class="alert-box" style="background:var(--warning-dim);border:1px solid rgba(245,158,11,.3);color:#92400e;border-radius:10px;padding:12px 16px;margin-bottom:18px;font-size:.86rem">
      ⚠ Archiving moves this student's record to the archive folder under
      <strong>${esc(col?.name || '—')}</strong> → <strong>${esc(dept?.name || '—')}</strong>.<br>
      The record will no longer appear in active student lists.
    </div>
    <div class="grid-2">
      <div>${infoRow('Student ID', s.id)}</div>
      <div>${infoRow('Name', s.name)}</div>
    </div>
    <div class="field-wrap" style="margin-top:14px">
      <div class="field-label">Archive Reason</div>
      <select id="arch-reason" class="select-input">
        <option value="graduated">Graduated</option>
        <option value="archived">Transferred / Withdrew</option>
      </select>
    </div>
    <div class="field-wrap">
      <div class="field-label">Notes (optional)</div>
      <input id="arch-notes" class="input" placeholder="e.g. Graduated A.Y. 2024-2025">
    </div>`,
    `<button class="btn btn-ghost" onclick="closeModal()">Cancel</button>
     <button class="btn btn-warning" style="background:var(--warning);color:#fff;padding:8px 18px;border-radius:10px;border:none;font-weight:600;cursor:pointer" onclick="archiveStudent('${sid}')">🗃 Archive Record</button>`
  );
}

function archiveStudent(sid) {
  const s      = getStudent(sid);
  if (!s) return;
  const reason = document.getElementById('arch-reason').value;
  const notes  = document.getElementById('arch-notes').value.trim();
  s.status      = reason;
  s.archiveNote = notes || null;
  s.archivedAt  = new Date().toISOString().slice(0, 10);
  s.archivedBy  = currentUser.username;
  save();
  logAudit(`Student archived: ${sid} — ${s.name} (${reason}${notes ? ' | ' + notes : ''})`);
  toast(`${s.name} has been archived as "${reason}"`, 'success');
  closeModal();
  renderStudentRecords(s.collegeId, s.deptId);
}


/* ──────────────────────────────────────────────
   CHAIRMAN STUDENT RECORDS
   Scoped to Chairman's assigned department only
────────────────────────────────────────────── */
