function renderMyGrades() {
  const sid     = currentUser.studentId;
  const student = getStudent(sid);
  if (!student) {
    set(`<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">No student record is linked to your account.<br>Please contact the Registrar.</div></div>`);
    return;
  }

  const myEnr    = DB.enrollments.filter(e => e.studentId === sid);
  const myGrades = DB.grades.filter(g => g.studentId === sid && getSection(g.sectionId)?.submitted);
  const gpa      = calcGPA(sid);
  const sems     = studentSemesters(sid).filter(x => x.gpa != null);

  // Get all semester keys the student has submitted grades in, sorted oldest first
  const semKeys = [...new Set(
    DB.sections
      .filter(s => myEnr.some(e => e.sectionId === s.id) && s.submitted)
      .map(s => `${s.sy}|${s.sem}`)
  )].sort(); // oldest first so year levels go 1st→4th

  // Determine year level for each semester key from the subjects taken
  function yearLevelForSemKey(sy, sem) {
    const secIds = DB.sections
      .filter(s => s.sy === sy && s.sem === sem && s.submitted && myEnr.some(e => e.sectionId === s.id))
      .map(s => s.id);
    const subjectYears = secIds.map(sid2 => {
      const sec  = getSection(sid2);
      const subj = getSubject(sec?.subjectId);
      return subj?.year ?? null;
    }).filter(y => y != null);
    if (!subjectYears.length) return null;
    // Use the mode (most common year) to handle edge cases
    return subjectYears.sort((a, b) =>
      subjectYears.filter(v => v === b).length - subjectYears.filter(v => v === a).length
    )[0];
  }

  // Build: { yearLevel: [{ sy, sem }] }
  const ordinalMap  = { 1:'1st', 2:'2nd', 3:'3rd', 4:'4th' };
  const byYearLevel = {};
  semKeys.forEach(key => {
    const [sy, sem] = key.split('|');
    const yr = yearLevelForSemKey(sy, sem) ?? 0;
    if (!byYearLevel[yr]) byYearLevel[yr] = [];
    byYearLevel[yr].push({ sy, sem });
  });

  // Extract program abbreviation from program string e.g. "BS Information Technology" → "BSIT"
  const progAbbr = student.program
    ? student.program.replace(/\b(Bachelor of Science in |Bachelor of |BS )\s*/gi, 'BS')
        .split(' ').map(w => w[0]).join('').toUpperCase()
    : 'BS';

  set(`
    <!-- Student banner -->
    <div class="card mb-20" style="background:linear-gradient(135deg,#eff6ff,#dbeafe);border-color:#bfdbfe">
      <div class="flex gap-16">
        <div class="avatar avatar-lg" style="background:linear-gradient(135deg,var(--blue),var(--blue2))">${initials(student.name)}</div>
        <div>
          <div style="font-size:1.1rem;font-weight:800;color:var(--text)">${esc(student.name)}</div>
          <div class="text-muted text-sm">${esc(student.id)} · ${esc(student.program)}</div>
          <div class="flex gap-8 mt-6">
            <span class="badge badge-teal">Year ${student.year}</span>
            <span class="badge badge-warning">GPA ${gpa != null ? gpa.toFixed(2) : '—'}</span>
            <span class="badge badge-${stuStatusBadge(student)}">${stuStatus(student)}</span>
          </div>
        </div>
        <div style="margin-left:auto">
          <button class="btn btn-ghost btn-sm" onclick="downloadTranscript('${sid}')">⬇ Transcript</button>
        </div>
      </div>
    </div>

    <!-- GPA Trend (if 2+ semesters) -->
    ${sems.length >= 2 ? `<div class="card mb-20">
      <div class="card-title">📊 My GPA Trend</div>
      <div class="flex gap-16" style="align-items:center;flex-wrap:wrap">
        ${sparkline(sems.map(x => x.gpa), 200, 48)}
        <div class="flex gap-16" style="flex-wrap:wrap">
          ${sems.map(x => `<div class="text-center">
            <div class="fw-7" style="color:${gradeColor(x.gpa)}">${x.gpa.toFixed(2)}</div>
            <div class="text-xs text-muted">${esc(x.sem)} ${esc(x.sy.slice(-4))}</div>
          </div>`).join('')}
        </div>
      </div>
    </div>` : ''}

    <!-- Quick stats -->
    <div class="grid-3 mb-20">
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--success)">${myGrades.filter(g => g.grade <= 3).length}</div>
        <div class="text-muted text-sm">Subjects Passed</div>
      </div>
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--warning)">${gpa != null ? gpa.toFixed(2) : '—'}</div>
        <div class="text-muted text-sm">Current GPA</div>
      </div>
      <div class="card card-sm text-center">
        <div style="font-size:2rem;font-weight:800;color:var(--danger)">${myGrades.filter(g => g.grade > 3).length}</div>
        <div class="text-muted text-sm">Failed Subjects</div>
      </div>
    </div>

    <!-- Grades grouped by Year Level then Semester -->
    ${semKeys.length === 0
      ? `<div class="empty"><div class="empty-icon">📭</div><div class="empty-text">No submitted grades yet.<br>Grades appear here once your faculty submits them.</div></div>`
      : Object.keys(byYearLevel)
          .sort((a, b) => +a - +b)
          .map(yr => {
            const yrLabel  = yr > 0 ? `${progAbbr} ${ordinalMap[yr] || yr + 'th'} Year` : 'Other';
            const semsList = byYearLevel[yr]; // [{sy, sem}]

            return `
              <!-- ── Year Level heading ── -->
              <div style="display:flex;align-items:center;gap:12px;margin-bottom:14px;margin-top:8px">
                <div style="width:4px;height:28px;background:var(--blue);border-radius:4px;flex-shrink:0"></div>
                <div style="font-size:1.05rem;font-weight:800;color:var(--blue)">${esc(yrLabel)}</div>
              </div>

              ${semsList.map(({ sy, sem }) => {
                const semSecs = DB.sections.filter(s =>
                  s.sy === sy && s.sem === sem && s.submitted &&
                  myEnr.some(e => e.sectionId === s.id)
                );
                const semGPA  = semesterGPA(sid, sy, sem);

                return `
                  <!-- Semester sub-section -->
                  <div class="section-card mb-16">
                    <div class="section-card-head" style="background:var(--bg3)">
                      <div>
                        <div class="fw-7" style="font-size:.95rem">${esc(sem)} Semester — ${esc(sy)}</div>
                        <div class="text-xs text-muted mt-1">
                          ${semSecs.length} subject(s) · Semester GPA: <strong>${semGPA != null ? semGPA.toFixed(2) : '—'}</strong>
                        </div>
                      </div>
                      ${semGPA != null
                        ? `<span style="font-size:1.4rem;font-weight:800;color:${gradeColor(semGPA)}">${semGPA.toFixed(2)}</span>`
                        : ''}
                    </div>
                    <div class="table-wrap"><table>
                      <thead><tr>
                        <th>Subject Code</th>
                        <th>Subject Name</th>
                        <th>Units</th>
                        <th>Grade</th>
                        <th>Description</th>
                      </tr></thead>
                      <tbody>${semSecs.map(sec => {
                        const subj = getSubject(sec.subjectId);
                        const gr   = gradeFor(sid, sec.id);
                        return `<tr>
                          <td><span class="chip">${subj ? esc(subj.code) : '—'}</span></td>
                          <td class="fw-6">${subj ? esc(subj.name) : '—'}</td>
                          <td>${subj ? subj.units : '—'}</td>
                          <td>${gr
                            ? `<span style="color:${gradeColor(gr.grade)};font-weight:700;font-family:var(--mono);font-size:1rem">${fmt2(gr.grade)}</span>`
                            : '<span class="badge badge-muted">Pending</span>'}</td>
                          <td class="text-sm text-muted">${gr ? gradeDesc(gr.grade) : '—'}</td>
                        </tr>`;
                      }).join('')}</tbody>
                    </table></div>
                  </div>`;
              }).join('')}
            `;
          }).join('')}
  `);
}

function downloadTranscript(sid) {
  const s = getStudent(sid);
  if (!s) { toast('Student record not found', 'error'); return; }
  const myEnr = DB.enrollments.filter(e => e.studentId === sid);
  const gpa   = calcGPA(sid);
  const now   = new Date().toLocaleDateString('en-PH');
  const col   = getCollege(s.collegeId);
  const dept  = getDept(s.deptId);

  let c = `UNIVERSITY OF EASTERN PHILIPPINES\nUniversity Town, Northern Samar\n`;
  c += `${col ? col.name : ''}\n${dept ? dept.name : ''}\n`;
  c += `${'═'.repeat(65)}\nUNOFFICIAL TRANSCRIPT OF RECORDS\n${'═'.repeat(65)}\n\n`;
  c += `Student ID   : ${s.id}\n`;
  c += `Full Name    : ${s.name}\n`;
  c += `Program      : ${s.program}\n`;
  c += `Year Level   : Year ${s.year}\n`;
  c += `GPA          : ${gpa != null ? gpa.toFixed(2) : 'N/A'}\n`;
  c += `Status       : ${stuStatus(s)}\n`;
  c += `Date Printed : ${now}\n\n`;

  const keys = [...new Set(
    DB.sections
      .filter(sec => myEnr.some(e => e.sectionId === sec.id) && sec.submitted)
      .map(sec => `${sec.sy}|${sec.sem}`)
  )].sort();

  keys.forEach(key => {
    const [sy, sem] = key.split('|');
    c += `${'─'.repeat(65)}\n${sem} SEMESTER — A.Y. ${sy}\n${'─'.repeat(65)}\n`;
    c += `${'Code'.padEnd(10)} ${'Subject'.padEnd(36)} ${'Units'.padEnd(6)} ${'Grade'.padEnd(8)} Description\n`;
    DB.sections
      .filter(sec => sec.sy === sy && sec.sem === sem && sec.submitted && myEnr.some(e => e.sectionId === sec.id))
      .forEach(sec => {
        const subj = getSubject(sec.subjectId);
        const gr   = gradeFor(sid, sec.id);
        c += `${(subj?.code || '—').padEnd(10)} `;
        c += `${(subj?.name || '—').padEnd(36)} `;
        c += `${String(subj?.units || '—').padEnd(6)} `;
        c += `${gr ? fmt2(gr.grade).padEnd(8) : '—'.padEnd(8)} `;
        c += `${gr ? gradeDesc(gr.grade) : '—'}\n`;
      });
    c += '\n';
  });

  c += `${'═'.repeat(65)}\n`;
  c += `⚠  UNOFFICIAL — For official records, visit the Registrar's Office.\n`;
  c += `${'═'.repeat(65)}\n`;

  const blob = new Blob([c], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `Transcript_${sid}_${now.replace(/\//g, '-')}.txt`;
  a.click();
  logAudit(`Unofficial transcript downloaded: ${sid}`);
  toast('Transcript downloaded', 'success');
}


/* ──────────────────────────────────────────────
   ACADEMIC PROGRESS  (Student)
────────────────────────────────────────────── */
function renderProgress() {
  const sid     = currentUser.studentId;
  const student = getStudent(sid);
  if (!student) {
    set(`<div class="empty"><div class="empty-icon">❌</div><div class="empty-text">No student record linked to your account.</div></div>`);
    return;
  }

  const curriculum = DB.subjects.filter(s => s.deptId === student.deptId);
  const myEnr      = DB.enrollments.filter(e => e.studentId === sid);
  // Only count grades from submitted sections
  const myGrades   = DB.grades.filter(g => g.studentId === sid && getSection(g.sectionId)?.submitted);
  const subjOfSec  = secId => getSection(secId)?.subjectId;

  const passedIds  = myGrades.filter(g => g.grade <= 3).map(g => subjOfSec(g.sectionId)).filter(Boolean);
  const failedIds  = myGrades.filter(g => g.grade > 3).map(g => subjOfSec(g.sectionId)).filter(v => !passedIds.includes(v));
  const inProgIds  = myEnr.map(e => subjOfSec(e.sectionId)).filter(v => v && !passedIds.includes(v) && !failedIds.includes(v));

  const completed = curriculum.filter(s => passedIds.includes(s.id));
  const failed    = curriculum.filter(s => failedIds.includes(s.id));
  const inProg    = curriculum.filter(s => inProgIds.includes(s.id) && !passedIds.includes(s.id));
  const notTaken  = curriculum.filter(s => !passedIds.includes(s.id) && !failedIds.includes(s.id) && !inProgIds.includes(s.id));

  const pct = curriculum.length ? Math.round(completed.length / curriculum.length * 100) : 0;
  const gpa = calcGPA(sid);

  set(`
    <div class="grid-2 mb-20">
      <div class="card">
        <div class="flex gap-16 mb-16">
          ${donutSVG(pct, 90, 'var(--blue)')}
          <div>
            <div style="font-size:1.4rem;font-weight:800;color:var(--blue)">${pct}%</div>
            <div class="text-muted text-sm">Curriculum Complete</div>
            <div class="mt-8 text-sm">
              <span style="color:var(--success)">${completed.length}</span> / ${curriculum.length} subjects passed
            </div>
            <div class="mt-4 text-xs text-muted">
              GPA: <strong style="color:var(--warning)">${gpa != null ? gpa.toFixed(2) : '—'}</strong>
            </div>
          </div>
        </div>
        <div class="grid-2">
          ${miniStat('Completed',   completed.length, 'var(--success)')}
          ${miniStat('In Progress', inProg.length,    'var(--blue)')}
          ${miniStat('Failed',      failed.length,    'var(--danger)')}
          ${miniStat('Remaining',   notTaken.length,  'var(--text3)')}
        </div>
      </div>
      <div class="card">
        <div class="card-title">Year-by-Year Progress</div>
        ${[1, 2, 3, 4].map(yr => {
          const yrSubjs = curriculum.filter(s => s.year === yr);
          const yrPassed = yrSubjs.filter(s => passedIds.includes(s.id)).length;
          const yrPct    = yrSubjs.length ? Math.round(yrPassed / yrSubjs.length * 100) : 0;
          const status   = yrPassed === yrSubjs.length && yrSubjs.length > 0 ? 'success' : yrPct > 0 ? 'info' : 'muted';
          return `<div class="mb-12">
            <div class="flex-between mb-4">
              <span class="text-sm fw-6">Year ${yr}</span>
              <div class="flex gap-8">
                <span class="text-xs text-muted">${yrPassed}/${yrSubjs.length}</span>
                <span class="badge badge-${status}">${yrPassed === yrSubjs.length && yrSubjs.length > 0 ? '✓ Done' : yrPct > 0 ? 'In Progress' : 'Upcoming'}</span>
              </div>
            </div>
            <div class="progress"><div class="progress-bar" style="width:${yrPct}%"></div></div>
          </div>`;
        }).join('')}
      </div>
    </div>

    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Curriculum Tracker</div>
        <div class="flex gap-8">
          <span class="badge badge-success">✓ Passed</span>
          <span class="badge badge-info">In Progress</span>
          <span class="badge badge-danger">Failed</span>
          <span class="badge badge-muted">Not Taken</span>
        </div>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>Code</th><th>Subject</th><th>Units</th><th>Year</th><th>Sem</th><th>Grade</th><th>Status</th></tr></thead>
        <tbody>${curriculum.map(subj => {
          const isPassed = passedIds.includes(subj.id);
          const isFailed = failedIds.includes(subj.id);
          const isInProg = inProgIds.includes(subj.id) && !isPassed;
          const gr       = myGrades.find(g => subjOfSec(g.sectionId) === subj.id);
          return `<tr>
            <td><span class="chip">${esc(subj.code)}</span></td>
            <td class="fw-6">${esc(subj.name)}</td>
            <td>${subj.units}</td>
            <td>Year ${subj.year}</td>
            <td>${subj.sem === 1 ? '1st' : subj.sem === 2 ? '2nd' : 'Summer'}</td>
            <td>${gr ? `<span style="color:${gradeColor(gr.grade)};font-weight:700">${fmt2(gr.grade)}</span>` : '—'}</td>
            <td>
              ${isPassed  ? '<span class="badge badge-success">✓ Passed</span>'    : ''}
              ${isFailed  ? '<span class="badge badge-danger">✗ Failed</span>'     : ''}
              ${isInProg  ? '<span class="badge badge-info">In Progress</span>'    : ''}
              ${!isPassed && !isFailed && !isInProg ? '<span class="badge badge-muted">Not Taken</span>' : ''}
            </td>
          </tr>`;
        }).join('')}</tbody>
      </table></div>
    </div>`);
}


/* ──────────────────────────────────────────────
   SECURITY & BACKUP  (Registrar)
────────────────────────────────────────────── */
