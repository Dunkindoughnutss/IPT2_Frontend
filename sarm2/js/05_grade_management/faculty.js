function renderAdvisees() {
  const myStudents = DB.students.filter(s => s.adviserId === currentUser.id);
  const atRisk     = getAtRiskStudents(myStudents);

  set(`
    <div class="page-header">
      <div class="page-title">My Advisees (${myStudents.length})</div>
    </div>

    ${atRisk.length > 0 ? `<div class="alert-box" style="background:var(--danger-dim);border:1px solid rgba(239,68,68,.3);color:#b91c1c;border-radius:10px;padding:11px 16px;margin-bottom:20px;font-size:.84rem;font-weight:500">
      ⚠ <strong>${atRisk.length} at-risk advisee(s)</strong> — recommend scheduling advising sessions.
    </div>` : ''}

    <div class="section-card">
      <div class="table-wrap"><table>
        <thead><tr>
          <th>Student ID</th><th>Name</th><th>Program</th><th>Year</th><th>GPA</th><th>Status</th><th>GPA Trend</th><th>Alert</th>
        </tr></thead>
        <tbody>
          ${myStudents.length === 0
            ? `<tr><td colspan="8" class="table-empty">No advisees assigned to you yet.</td></tr>`
            : myStudents.map(s => {
                const gpa  = calcGPA(s.id);
                const risk = atRisk.find(r => r.s.id === s.id);
                const sems = studentSemesters(s.id).filter(x => x.gpa != null);
                const vals = sems.map(x => x.gpa);
                return `<tr>
                  <td class="mono text-sm text-muted">${esc(s.id)}</td>
                  <td><div class="flex gap-8">
                    <div class="avatar avatar-sm">${initials(s.name)}</div>
                    <span class="fw-6">${esc(s.name)}</span>
                  </div></td>
                  <td class="text-sm text-muted">${esc(s.program)}</td>
                  <td>Year ${s.year}</td>
                  <td><span style="color:${gpa ? gradeColor(gpa) : 'var(--text3)'};font-weight:700">${gpa ? gpa.toFixed(2) : '—'}</span></td>
                  <td><span class="badge badge-${stuStatusBadge(s)}">${stuStatus(s)}</span></td>
                  <td>${vals.length >= 2 ? sparkline(vals) : '<span class="text-muted text-xs">—</span>'}</td>
                  <td>${risk ? '<span class="risk-tag">⚠ At Risk</span>' : '<span class="badge badge-success">✓ OK</span>'}</td>
                </tr>`;
              }).join('')}
        </tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   HANDLED SECTIONS  (Faculty)
   Subjects shown as clickable cards.
   Student list only appears after clicking a card.
────────────────────────────────────────────── */
let activeSectionCard = null;

function renderSections() {
  const mySecs = DB.sections.filter(s => s.facultyId === currentUser.id);

  set(`
    <div class="page-header">
      <div class="page-title">Handled Sections (${mySecs.length})</div>
    </div>
    ${mySecs.length === 0
      ? `<div class="empty"><div class="empty-icon">📋</div><div class="empty-text">No sections assigned yet.<br>Contact your Chairman or Dean.</div></div>`
      : `
        <!-- Subject cards grid -->
        <div class="grid-3 mb-20">
          ${mySecs.map(sec => {
            const subj    = getSubject(sec.subjectId);
            const enrList = enrolledIn(sec.id);
            const graded  = DB.grades.filter(g => g.sectionId === sec.id).length;
            const pr      = sectionPassRate(sec.id);
            const isActive = activeSectionCard === sec.id;
            return `<div
              onclick="activeSectionCard=${sec.id};renderSections()"
              style="cursor:pointer;background:var(--white);border:2px solid ${isActive ? 'var(--blue)' : 'var(--border)'};border-radius:var(--radius-lg);padding:18px;box-shadow:${isActive ? '0 0 0 3px rgba(59,111,245,.15), var(--shadow)' : 'var(--shadow)'};transition:all .18s;${isActive ? 'background:linear-gradient(135deg,#eff6ff,#fff)' : ''}">
              <div class="flex-between mb-12">
                <div>
                  <span class="chip" style="margin-bottom:6px;display:inline-flex">${subj ? esc(subj.code) : '—'}</span>
                  <div class="fw-7" style="font-size:.95rem;margin-top:4px">${subj ? esc(subj.name) : '—'}</div>
                </div>
                ${sec.submitted ? '<span class="badge badge-success" style="font-size:.65rem">🔒</span>' : ''}
              </div>
              <div class="text-xs text-muted mb-12">
                ${esc(sec.sectionName)} · ${esc(sec.sem)} Sem · ${esc(sec.sy)}${subj ? ' · ' + subj.units + ' units' : ''}
              </div>
              <div style="display:grid;grid-template-columns:1fr 1fr 1fr;gap:8px;margin-bottom:12px">
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:var(--blue)">${enrList.length}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Enrolled</div>
                </div>
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:var(--teal)">${graded}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Graded</div>
                </div>
                <div style="text-align:center;background:var(--bg3);border-radius:8px;padding:8px">
                  <div style="font-size:1.2rem;font-weight:800;color:${pr != null ? (pr >= 75 ? 'var(--success)' : 'var(--danger)') : 'var(--text3)'}">${pr != null ? pr + '%' : '—'}</div>
                  <div style="font-size:.66rem;color:var(--text3)">Pass Rate</div>
                </div>
              </div>
              ${!sec.submitted
                ? `<button class="btn btn-primary btn-sm" style="width:100%" onclick="event.stopPropagation();encodeActiveSec=${sec.id};navigate('encode')">✍ Encode Grades</button>`
                : `<div style="text-align:center;font-size:.78rem;color:var(--success);font-weight:600">✔ Grades Submitted</div>`}
            </div>`;
          }).join('')}
        </div>

        <!-- Expandable student list — only shown when a card is clicked -->
        ${activeSectionCard ? (() => {
          const sec     = getSection(activeSectionCard);
          const subj    = getSubject(sec?.subjectId);
          const enrList = sec ? enrolledIn(sec.id) : [];
          return `<div class="section-card">
            <div class="section-card-head">
              <div>
                <div class="flex gap-10">
                  <span class="chip">${subj ? esc(subj.code) : '—'}</span>
                  <span class="fw-7">${subj ? esc(subj.name) : '—'}</span>
                  <span class="badge badge-teal">${esc(sec.sectionName)}</span>
                  ${sec.submitted ? '<span class="badge badge-success">🔒 Submitted</span>' : ''}
                </div>
                <div class="text-xs text-muted mt-6">${esc(sec.sem)} Semester · ${esc(sec.sy)}</div>
              </div>
              <button class="btn btn-ghost btn-sm" onclick="activeSectionCard=null;renderSections()">✕ Close</button>
            </div>
            <div class="section-card-body">
              ${enrList.length === 0
                ? '<div class="text-muted text-sm">No students enrolled in this section.</div>'
                : `<div class="table-wrap"><table>
                    <thead><tr><th>Student ID</th><th>Name</th><th>Year</th><th>Grade</th></tr></thead>
                    <tbody>${enrList.map(s => {
                      const gr = gradeFor(s.id, activeSectionCard);
                      return `<tr>
                        <td class="mono text-sm text-muted">${esc(s.id)}</td>
                        <td><div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div></td>
                        <td>Year ${s.year}</td>
                        <td>${gr
                          ? `<span style="color:${gradeColor(gr.grade)};font-weight:700">${fmt2(gr.grade)} — ${gradeDesc(gr.grade)}</span>`
                          : '<span class="badge badge-muted">Not graded</span>'}</td>
                      </tr>`;
                    }).join('')}</tbody>
                  </table></div>`}
            </div>
          </div>`;
        })() : ''}
      `}
  `);
}


/* ──────────────────────────────────────────────
   ENCODE GRADES  (Faculty)
   Submit routes grades to students — no locking
   Faculty can always edit for corrections
────────────────────────────────────────────── */
let encodeActiveSec = null;

function renderEncode() {
  const mySecs = DB.sections.filter(s => s.facultyId === currentUser.id);
  if (!encodeActiveSec && mySecs.length > 0) encodeActiveSec = mySecs[0].id;

  const activeSec  = getSection(encodeActiveSec);
  const activeSubj = activeSec ? getSubject(activeSec.subjectId) : null;
  const students   = activeSec ? enrolledIn(encodeActiveSec) : [];

  set(`
    <div class="page-header">
      <div>
        <div class="page-title">Grade Encoding</div>
        <div class="text-muted text-sm">Save grades anytime. Submit to route grades to students — editable at all times for corrections.</div>
      </div>
    </div>

    <div style="display:grid;grid-template-columns:270px 1fr;gap:16px">

      <!-- Section picker sidebar -->
      <div class="card" style="height:fit-content">
        <div class="card-title">My Sections</div>
        ${mySecs.length === 0
          ? '<div class="text-muted text-sm">No sections assigned.</div>'
          : mySecs.map(sec => {
              const subj = getSubject(sec.subjectId);
              const enr  = enrolledIn(sec.id).length;
              const gr   = DB.grades.filter(g => g.sectionId === sec.id).length;
              const isA  = sec.id === encodeActiveSec;
              return `<div class="sec-picker-item${isA ? ' active' : ''}" onclick="encodeActiveSec=${sec.id};renderEncode()">
                <div class="flex gap-8 mb-4">
                  <span class="chip">${subj ? esc(subj.code) : '—'}</span>
                  <span class="badge badge-teal">${esc(sec.sectionName)}</span>
                  ${sec.submitted ? '<span class="badge badge-success" style="font-size:.62rem">✔ Submitted</span>' : ''}
                </div>
                <div class="text-xs text-muted">${esc(sec.sem)} Sem · ${gr}/${enr} graded${sec.submitted ? ' · Visible to students' : ''}</div>
              </div>`;
            }).join('')}
      </div>

      <!-- Grade entry panel -->
      <div>
        ${!activeSec
          ? `<div class="card"><div class="empty"><div class="empty-icon">📋</div><div class="empty-text">Select a section from the left.</div></div></div>`
          : `<div class="section-card">
              <div class="section-card-head">
                <div>
                  <div class="fw-7">${activeSubj ? esc(activeSubj.code) + ' — ' + esc(activeSubj.name) : '—'}</div>
                  <div class="text-xs text-muted mt-4">
                    Section: ${esc(activeSec.sectionName)} · ${esc(activeSec.sem)} Sem ${esc(activeSec.sy)}
                  </div>
                </div>
                <div class="flex gap-8">
                  <button class="btn btn-ghost btn-sm" onclick="saveDraftGrades(${encodeActiveSec})">💾 Save</button>
                  <button class="btn btn-primary btn-sm" onclick="submitGrades(${encodeActiveSec})">✔ Submit to Students</button>
                </div>
              </div>
              <div class="section-card-body">
                ${activeSec.submitted
                  ? `<div class="alert-box alert-teal mb-16">
                      ✔ Grades are submitted and visible to students. You can still update grades here if corrections are needed.
                    </div>`
                  : ''}
                ${students.length === 0
                  ? `<div class="empty"><div class="empty-icon">👥</div><div class="empty-text">No students enrolled in this section.</div></div>`
                  : `<table style="width:100%;border-collapse:collapse">
                      <thead><tr>
                        ${['Student', 'Year', 'Grade', 'Description', 'Status'].map(h =>
                          `<th style="padding:10px 14px;text-align:left;font-size:.72rem;font-weight:700;color:var(--text3);text-transform:uppercase;border-bottom:1px solid var(--border);background:var(--bg3)">${h}</th>`
                        ).join('')}
                      </tr></thead>
                      <tbody>${students.map(s => {
                        const ex = gradeFor(s.id, encodeActiveSec);
                        return `<tr style="border-bottom:1px solid var(--border2)">
                          <td style="padding:11px 14px">
                            <div class="flex gap-8"><div class="avatar avatar-sm">${initials(s.name)}</div>${esc(s.name)}</div>
                          </td>
                          <td style="padding:11px 14px;font-size:.84rem;color:var(--text2)">Year ${s.year}</td>
                          <td style="padding:11px 14px">
                            <select id="g-${s.id}" class="select-input" style="width:140px" onchange="previewGrade('${s.id}')">
                              <option value="">— Select —</option>
                              ${[1.0, 1.25, 1.5, 1.75, 2.0, 2.25, 2.5, 2.75, 3.0, 5.0].map(v =>
                                `<option value="${v}"${ex && ex.grade == v ? ' selected' : ''}>${v.toFixed(2)}</option>`
                              ).join('')}
                              <option value="INC"${ex && ex.grade === 'INC' ? ' selected' : ''}>INC — Incomplete</option>
                            </select>
                          </td>
                          <td style="padding:11px 14px" id="d-${s.id}">
                            <span style="color:${ex ? gradeColor(ex.grade) : 'var(--text3)'};font-size:.84rem">
                              ${ex ? gradeDesc(ex.grade) : '—'}
                            </span>
                          </td>
                          <td style="padding:11px 14px">
                            ${ex
                              ? `<span class="badge badge-success">✓ ${ex.date}</span>`
                              : '<span class="badge badge-muted">Not yet</span>'}
                          </td>
                        </tr>`;
                      }).join('')}</tbody>
                    </table>`}
              </div>
            </div>`}
      </div>
    </div>`);
}

function previewGrade(studentId) {
  const sel  = document.getElementById(`g-${studentId}`);
  const desc = document.getElementById(`d-${studentId}`);
  if (!sel || !desc) return;
  const v = parseFloat(sel.value);
  desc.innerHTML = isNaN(v)
    ? '<span style="color:var(--text3)">—</span>'
    : `<span style="color:${gradeColor(v)};font-size:.84rem">${gradeDesc(v)}</span>`;
}

// Save — saves grades (always editable)
function saveDraftGrades(sectionId) {
  const students = enrolledIn(sectionId);
  let saved = 0, skipped = 0;
  students.forEach(s => {
    const sel = document.getElementById(`g-${s.id}`);
    if (!sel || !sel.value) { skipped++; return; }
    const raw = sel.value;
    const val = raw === 'INC' ? 'INC' : parseFloat(raw);
    if (raw !== 'INC' && isNaN(val)) { skipped++; return; }
    const ex = gradeFor(s.id, sectionId);
    if (ex) { ex.grade = val; ex.date = new Date().toISOString().slice(0, 10); }
    else DB.grades.push({ id: DB.nextId.grade++, studentId: s.id, sectionId, grade: val, facultyId: currentUser.id, date: new Date().toISOString().slice(0, 10) });
    saved++;
  });
  if (saved === 0) { toast('No grades selected.', 'error'); return; }
  save();
  logAudit(`Grades saved: section ${sectionId} — ${saved} student(s)`);
  toast(`${saved} grade(s) saved.${skipped ? ' ' + skipped + ' skipped.' : ''}`, 'success');
  renderEncode();
}

// Submit — routes grades to students (no lock, always editable)
function submitGrades(sectionId) {
  const sec = getSection(sectionId);
  if (!sec) return;
  const students = enrolledIn(sectionId);

  // Auto-save any current dropdown values first
  students.forEach(s => {
    const sel = document.getElementById(`g-${s.id}`);
    if (sel && sel.value) {
      const raw = sel.value;
      const val = raw === 'INC' ? 'INC' : parseFloat(raw);
      if (raw === 'INC' || !isNaN(val)) {
        const ex = gradeFor(s.id, sectionId);
        if (ex) ex.grade = val;
        else DB.grades.push({ id: DB.nextId.grade++, studentId: s.id, sectionId, grade: val, facultyId: currentUser.id, date: new Date().toISOString().slice(0, 10) });
      }
    }
  });

  // Check for ungraded students
  const ungraded = students.filter(s => !gradeFor(s.id, sectionId));
  if (ungraded.length > 0) {
    if (!confirm(`${ungraded.length} student(s) still have no grade:\n${ungraded.map(s => s.name).join(', ')}\n\nSubmit anyway?`)) return;
  }

  // Mark as submitted (visible to students) — NOT locked, can re-submit anytime
  sec.submitted   = true;
  sec.submittedAt = new Date().toISOString().slice(0, 10);
  save();
  logAudit(`Grades submitted: ${sec.sectionName} (${getSubject(sec.subjectId)?.code}). Visible to students.`);
  toast('Grades submitted. Students can now view their grades. You may still edit grades if corrections are needed. ✔', 'success');
  renderEncode();
}


/* ──────────────────────────────────────────────
   MY GRADES  (Student — only submitted grades visible)
   Layout:
     Heading  : Program + Year Level  e.g. "BSIT · 1st Year"
     Subheading: Semester - SY        e.g. "1st Semester - 2023-2024"
     Table    : Subject | Units | Grade | Description  (NO Section column)
────────────────────────────────────────────── */
