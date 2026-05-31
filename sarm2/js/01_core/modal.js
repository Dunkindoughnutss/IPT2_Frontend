function togglePwdVis(inputId, btn) {
  const el = document.getElementById(inputId);
  if (!el) return;
  el.type = el.type === 'password' ? 'text' : 'password';
  btn.textContent = el.type === 'password' ? '👁' : '🙈';
}

/* ──────────────────────────────────────────────
   MODAL ENGINE
────────────────────────────────────────────── */
function showModal(title, body, footer) {
  closeModal();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.id        = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-box">
      <div class="flex-between mb-20">
        <div class="modal-title">${esc(title)}</div>
        <button class="modal-close" onclick="closeModal()">✕</button>
      </div>
      <div>${body}</div>
      <div class="modal-footer">${footer}</div>
    </div>`;
  overlay.addEventListener('click', e => { if (e.target === overlay) closeModal(); });
  document.body.appendChild(overlay);
}

function closeModal() {
  document.getElementById('modal-overlay')?.remove();
}


/* ──────────────────────────────────────────────
   INIT
────────────────────────────────────────────── */
document.getElementById('topbar-date').textContent = today();
