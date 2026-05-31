function renderSecurity() {
  const failedEvents  = DB.auditLog.filter(l => !l.ok).length;
  const successEvents = DB.auditLog.filter(l => l.ok).length;
  const lockedUsers   = DB.users.filter(u => u.lockedOut);

  set(`
    <div class="grid-2 mb-20">

      <!-- System status card -->
      <div class="card">
        <div class="card-title">System Status</div>
        ${infoRow('Data Storage',      '<span style="color:var(--success)">localStorage (prototype)</span>')}
        ${infoRow('Last Auto-Backup',  `<span style="color:var(--success)">${DB.lastBackup || 'Not yet'}</span>`)}
        ${infoRow('Total Backups',     `<span style="color:var(--blue)">${DB.backupCount || 0}</span>`)}
        ${infoRow('Backup Frequency',  '<span style="color:var(--teal)">Every 5 minutes (auto)</span>')}
        ${infoRow('Account Lockout',   '<span style="color:var(--success)">After 5 failed attempts</span>')}
        ${infoRow('Locked Accounts',   lockedUsers.length > 0
          ? `<span style="color:var(--danger)">${lockedUsers.length} account(s) locked</span>`
          : '<span style="color:var(--success)">None</span>')}
        <div class="mt-16 flex gap-8">
          <button class="btn btn-primary btn-sm" onclick="runBackup(true);renderSecurity()">▶ Run Backup Now</button>
          <button class="btn btn-ghost btn-sm"   onclick="exportAuditLog()">⬇ Export Audit Log</button>
        </div>
      </div>

      <!-- Security summary card -->
      <div class="card">
        <div class="card-title">Security Summary</div>
        <div class="grid-3 mb-16">
          ${miniStat('Total Events', DB.auditLog.length, '#374151')}
          ${miniStat('Successful',   successEvents,      'var(--success)')}
          ${miniStat('Failed',       failedEvents,       'var(--danger)')}
        </div>

        ${lockedUsers.length > 0 ? `
          <div class="card-title mb-8">Locked Accounts</div>
          ${lockedUsers.map(u => `<div class="flex-between mb-8">
            <div class="flex gap-8">
              <div class="avatar avatar-sm">${initials(u.name)}</div>
              <div>
                <div class="text-sm fw-6">${esc(u.name)}</div>
                <div class="text-xs text-muted">${esc(u.username)} · ${u.failedAttempts} failed attempts</div>
              </div>
            </div>
            <button class="btn btn-sm btn-success" onclick="unlockUser(${u.id});renderSecurity()">🔓 Unlock</button>
          </div>`).join('')}` : '<div class="text-muted text-sm">No locked accounts.</div>'}

        <div class="divider"></div>
        <div class="card-title">CIA Triad</div>
        ${[
          ['Confidentiality', 'Role-based access control active',    95,  'var(--blue)'],
          ['Integrity',       'Grade locking active',                100, 'var(--success)'],
          ['Availability',    'Auto-backup every 5 minutes',         99,  'var(--teal)'],
        ].map(([k, v, p, c]) => `<div class="mb-10">
          <div class="flex-between mb-4">
            <span class="text-sm">${k}</span>
            <span class="fw-7 text-sm" style="color:${c}">${p}%</span>
          </div>
          <div class="text-xs text-muted mb-4">${v}</div>
          <div class="progress" style="height:6px">
            <div class="progress-bar" style="width:${p}%;background:${c}"></div>
          </div>
        </div>`).join('')}
      </div>
    </div>

    <!-- Backup History -->
    <div class="section-card mb-20">
      <div class="section-card-head">
        <div class="page-title">Backup History</div>
        <span class="badge badge-teal">${DB.backupCount || 0} total</span>
      </div>
      <div class="table-wrap"><table>
        <thead><tr><th>#</th><th>Timestamp</th><th>Type</th><th>Size</th></tr></thead>
        <tbody>
          ${(DB.backupLog || []).length === 0
            ? `<tr><td colspan="4" class="table-empty">No backups yet. First backup runs 10 seconds after login.</td></tr>`
            : (DB.backupLog || []).map(b => `<tr>
                <td class="text-muted">#${b.id}</td>
                <td class="mono text-sm">${esc(b.ts)}</td>
                <td><span class="badge badge-${b.auto ? 'teal' : 'blue'}">${b.auto ? 'Auto' : 'Manual'}</span></td>
                <td class="mono text-sm text-muted">${(b.size / 1024).toFixed(1)} KB</td>
              </tr>`).join('')}
        </tbody>
      </table></div>
    </div>

    <!-- Audit Trail -->
    <div class="section-card">
      <div class="section-card-head">
        <div class="page-title">Audit Trail Log</div>
        <span class="badge badge-teal">${DB.auditLog.length} entries</span>
      </div>
      <div class="table-wrap" style="max-height:400px;overflow-y:auto"><table>
        <thead><tr><th>Timestamp</th><th>User</th><th>Action</th><th>IP Address</th><th>Result</th></tr></thead>
        <tbody>${DB.auditLog.map(l => `<tr>
          <td class="mono text-xs text-muted">${esc(l.ts)}</td>
          <td class="fw-6 text-sm">${esc(l.user)}</td>
          <td class="text-sm">${esc(l.action)}</td>
          <td class="mono text-xs text-muted">${esc(l.ip)}</td>
          <td><span class="badge badge-${l.ok ? 'success' : 'danger'}">${l.ok ? '✔ OK' : '✖ Failed'}</span></td>
        </tr>`).join('')}</tbody>
      </table></div>
    </div>`);
}

function exportAuditLog() {
  let c = 'SARM-DA AUDIT TRAIL LOG\n' + new Date().toISOString() + '\n\n';
  c += 'Timestamp            | User          | Action                                   | IP              | Result\n';
  c += '-'.repeat(105) + '\n';
  DB.auditLog.forEach(l => {
    c += `${l.ts.padEnd(21)}| ${l.user.padEnd(14)}| ${l.action.padEnd(42)}| ${l.ip.padEnd(17)}| ${l.ok ? 'SUCCESS' : 'FAILED'}\n`;
  });
  const blob = new Blob([c], { type: 'text/plain' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `AuditLog_${new Date().toISOString().slice(0, 10)}.txt`;
  a.click();
  logAudit('Audit log exported');
  toast('Audit log exported successfully', 'success');
}


/* ══════════════════════════════════════════════
   STUDENT RECORDS MODULE
   ──────────────────────────────────────────────
   Registrar  : Add, Edit, Archive all students
   Archives   : Registrar = all colleges
                Chairman  = own college only
   Folder tree: College → Department → Students
══════════════════════════════════════════════ */

/* ──────────────────────────────────────────────
   STUDENT RECORDS  (Registrar)
   List active students, add new, edit, archive
────────────────────────────────────────────── */
