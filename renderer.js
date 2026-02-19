// ── State ──────────────────────────────────────────────────────
let allEntries = [];
let currentCat = 'All';
let searchQuery = '';

// ── DOM refs ───────────────────────────────────────────────────
const lockScreen   = document.getElementById('lock-screen');
const appEl        = document.getElementById('app');
const lockInput    = document.getElementById('lock-input');
const lockBtn      = document.getElementById('lock-btn');
const lockError    = document.getElementById('lock-error');
const lockLabel    = document.getElementById('lock-label-text');
const entryList    = document.getElementById('entry-list');
const catList      = document.getElementById('cat-list');
const searchInput  = document.getElementById('search-input');
const mainTitle    = document.getElementById('main-title');
const entryCount   = document.getElementById('entry-count');
const addBtn       = document.getElementById('add-btn');
const lockAppBtn   = document.getElementById('lock-app-btn');
const entryModal   = document.getElementById('entry-modal');
const modalTitleTx = document.getElementById('modal-title-text');
const modalClose   = document.getElementById('modal-close');
const modalCancel  = document.getElementById('modal-cancel');
const modalSave    = document.getElementById('modal-save');
const editId       = document.getElementById('edit-id');
const fLabel       = document.getElementById('f-label');
const fUser        = document.getElementById('f-user');
const fPwd         = document.getElementById('f-pwd');
const fCat         = document.getElementById('f-cat');
const fNotes       = document.getElementById('f-notes');
const genBtn       = document.getElementById('gen-btn');
const toastEl      = document.getElementById('toast');

// ── Toast ──────────────────────────────────────────────────────
let toastTimer;
function toast(msg, type = 'success') {
  toastEl.textContent = msg;
  toastEl.className = `show ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => { toastEl.className = ''; }, 2200);
}

// ── Lock screen ────────────────────────────────────────────────
async function initLock() {
  const hasMaster = await window.crypthub.hasMaster();
  if (!hasMaster) {
    lockLabel.textContent = 'Create Master Password';
    lockBtn.textContent = 'Set Password & Enter';
  }
}

async function handleUnlock() {
  const pwd = lockInput.value.trim();
  if (!pwd) { lockError.textContent = 'Please enter a password.'; return; }
  lockError.textContent = '';
  lockBtn.disabled = true;
  lockBtn.textContent = '...';

  const hasMaster = await window.crypthub.hasMaster();
  let result;
  if (!hasMaster) {
    if (pwd.length < 6) {
      lockError.textContent = 'Minimum 6 characters.';
      lockBtn.disabled = false;
      lockBtn.textContent = 'Set Password & Enter';
      return;
    }
    result = await window.crypthub.setMaster(pwd);
  } else {
    result = await window.crypthub.unlock(pwd);
  }

  if (result.ok) {
    lockScreen.classList.add('hidden');
    appEl.classList.remove('hidden');
    lockInput.value = '';
    await loadEntries();
  } else {
    lockError.textContent = result.error || 'Authentication failed.';
    lockBtn.disabled = false;
    lockBtn.textContent = 'Unlock';
  }
}

lockBtn.addEventListener('click', handleUnlock);
lockInput.addEventListener('keydown', e => { if (e.key === 'Enter') handleUnlock(); });

lockAppBtn.addEventListener('click', async () => {
  await window.crypthub.lock();
  allEntries = [];
  renderEntries();
  appEl.classList.add('hidden');
  lockScreen.classList.remove('hidden');
  lockBtn.disabled = false;
  lockBtn.textContent = 'Unlock';
  lockInput.value = '';
  lockError.textContent = '';
  // Reset label in case it was "create"
  const hasMaster = await window.crypthub.hasMaster();
  lockLabel.textContent = hasMaster ? 'Master Password' : 'Create Master Password';
});

// ── Entries ────────────────────────────────────────────────────
async function loadEntries() {
  const res = await window.crypthub.getEntries();
  if (res.ok) {
    allEntries = res.entries;
    renderSidebar();
    renderEntries();
  }
}

function getFilteredEntries() {
  return allEntries.filter(e => {
    const catMatch = currentCat === 'All' || e.category === currentCat;
    const q = searchQuery.toLowerCase();
    const textMatch = !q ||
      e.label.toLowerCase().includes(q) ||
      (e.username || '').toLowerCase().includes(q) ||
      (e.category || '').toLowerCase().includes(q);
    return catMatch && textMatch;
  });
}

function renderSidebar() {
  const cats = ['All', ...new Set(allEntries.map(e => e.category).filter(Boolean).sort())];
  catList.innerHTML = cats.map(cat => {
    const count = cat === 'All' ? allEntries.length : allEntries.filter(e => e.category === cat).length;
    const icon = catIcon(cat);
    return `<div class="cat-item ${currentCat === cat ? 'active' : ''}" data-cat="${cat}">
      ${icon} ${cat}
      <span class="cat-count">${count}</span>
    </div>`;
  }).join('');

  catList.querySelectorAll('.cat-item').forEach(el => {
    el.addEventListener('click', () => {
      currentCat = el.dataset.cat;
      mainTitle.textContent = currentCat === 'All' ? 'All Passwords' : currentCat;
      renderSidebar();
      renderEntries();
    });
  });
}

function catIcon(cat) {
  const icons = {
    'All': '⊞', 'General': '◈', 'Social': '◉', 'Work': '◆',
    'Finance': '◇', 'Entertainment': '◎', 'Dev / Tech': '◐',
    'Shopping': '◑', 'Other': '○'
  };
  return icons[cat] || '○';
}

function renderEntries() {
  const entries = getFilteredEntries();
  entryCount.textContent = `${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`;

  if (!entries.length) {
    entryList.innerHTML = `
      <div class="empty-state">
        <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1">
          <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
        </svg>
        <p>${searchQuery ? 'No results found.' : 'No entries yet. Add your first password!'}</p>
      </div>`;
    return;
  }

  entryList.innerHTML = entries.map(e => `
    <div class="entry-card" data-id="${e.id}">
      <div class="card-cat">${e.category || 'General'}</div>
      <div class="card-label">${escHtml(e.label)}</div>
      <div class="card-user">${escHtml(e.username || ' ')}</div>
      <div class="card-actions">
        <button class="card-action" data-action="copy" data-id="${e.id}" title="Copy password">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/>
          </svg>
          Copy
        </button>
        <button class="card-action" data-action="edit" data-id="${e.id}" title="Edit">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
            <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
          </svg>
          Edit
        </button>
        <button class="card-action danger" data-action="delete" data-id="${e.id}" title="Delete">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
            <path d="M10 11v6"/><path d="M14 11v6"/>
          </svg>
          Delete
        </button>
      </div>
    </div>`).join('');

  // Card action events
  entryList.querySelectorAll('.card-action').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      e.stopPropagation();
      const id  = parseInt(btn.dataset.id);
      const action = btn.dataset.action;
      const entry = allEntries.find(x => x.id === id);
      if (!entry) return;

      if (action === 'copy') {
        await navigator.clipboard.writeText(entry.password);
        btn.classList.add('copy-ok');
        btn.innerHTML = `<svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg> Copied!`;
        setTimeout(() => { renderEntries(); }, 1500);
        toast('Password copied!');
      } else if (action === 'edit') {
        openModal(entry);
      } else if (action === 'delete') {
        if (confirm(`Delete "${entry.label}"?`)) {
          await window.crypthub.deleteEntry(id);
          toast('Entry deleted', 'error');
          await loadEntries();
        }
      }
    });
  });
}

function escHtml(str) {
  return (str || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
}

// ── Search ─────────────────────────────────────────────────────
searchInput.addEventListener('input', () => {
  searchQuery = searchInput.value;
  renderEntries();
});

// ── Modal ──────────────────────────────────────────────────────
function openModal(entry = null) {
  editId.value = entry ? entry.id : '';
  modalTitleTx.textContent = entry ? 'Edit Entry' : 'New Entry';
  fLabel.value  = entry ? entry.label : '';
  fUser.value   = entry ? (entry.username || '') : '';
  fPwd.value    = entry ? entry.password : '';
  fCat.value    = entry ? (entry.category || 'General') : 'General';
  fNotes.value  = entry ? (entry.notes || '') : '';
  updateStrength(fPwd.value);
  entryModal.classList.remove('hidden');
  fLabel.focus();
}

function closeModal() {
  entryModal.classList.add('hidden');
}

addBtn.addEventListener('click', () => openModal());
modalClose.addEventListener('click', closeModal);
modalCancel.addEventListener('click', closeModal);
entryModal.addEventListener('click', e => { if (e.target === entryModal) closeModal(); });

modalSave.addEventListener('click', async () => {
  const label    = fLabel.value.trim();
  const password = fPwd.value.trim();
  if (!label)    { toast('Label is required', 'error'); fLabel.focus(); return; }
  if (!password) { toast('Password is required', 'error'); fPwd.focus(); return; }

  const data = {
    label,
    username: fUser.value.trim(),
    password,
    category: fCat.value,
    notes: fNotes.value.trim()
  };

  const id = editId.value;
  if (id) {
    await window.crypthub.updateEntry({ id: parseInt(id), ...data });
    toast('Entry updated!');
  } else {
    await window.crypthub.addEntry(data);
    toast('Entry saved!');
  }
  closeModal();
  await loadEntries();
});

// ── Password generator ─────────────────────────────────────────
genBtn.addEventListener('click', async () => {
  const pwd = await window.crypthub.generatePassword({ length: 20, symbols: true });
  fPwd.value = pwd;
  updateStrength(pwd);
  toast('Password generated!');
});

fPwd.addEventListener('input', () => updateStrength(fPwd.value));

function updateStrength(pwd) {
  const segs = [document.getElementById('s1'), document.getElementById('s2'),
                document.getElementById('s3'), document.getElementById('s4')];
  const lbl  = document.getElementById('strength-label');
  segs.forEach(s => { s.className = 'strength-seg'; });

  if (!pwd) { lbl.textContent = ''; return; }

  let score = 0;
  if (pwd.length >= 8)  score++;
  if (pwd.length >= 14) score++;
  if (/[A-Z]/.test(pwd) && /[0-9]/.test(pwd)) score++;
  if (/[^A-Za-z0-9]/.test(pwd)) score++;

  const labels = ['', 'Weak', 'Fair', 'Strong', 'Very Strong'];
  lbl.textContent = labels[score] || '';
  for (let i = 0; i < score; i++) segs[i].classList.add(`s${score}`);
}

// ── Migration ──────────────────────────────────────────────────
const migrateBtn        = document.getElementById('migrate-btn');
const migrateModal      = document.getElementById('migrate-modal');
const migrateModalClose = document.getElementById('migrate-modal-close');
const migrateTabs       = document.querySelectorAll('.migrate-tab');
const exportPanel       = document.getElementById('panel-export');
const importPanel       = document.getElementById('panel-import');

// State
let importBundle = null;

// Open / close modal
migrateBtn.addEventListener('click', () => {
  resetMigrateModal();
  migrateModal.classList.remove('hidden');
});
migrateModalClose.addEventListener('click', closeMigrateModal);
migrateModal.addEventListener('click', e => { if (e.target === migrateModal) closeMigrateModal(); });

function closeMigrateModal() {
  migrateModal.classList.add('hidden');
  importBundle = null;
}

function resetMigrateModal() {
  // Reset tabs to export
  migrateTabs.forEach(t => t.classList.toggle('active', t.dataset.tab === 'export'));
  exportPanel.classList.add('active');
  importPanel.classList.remove('active');
  // Reset import steps
  showImportStep(1);
  document.getElementById('import-pwd').value = '';
  document.getElementById('import-error').textContent = '';
  importBundle = null;
}

// Tab switching
migrateTabs.forEach(tab => {
  tab.addEventListener('click', () => {
    migrateTabs.forEach(t => t.classList.remove('active'));
    tab.classList.add('active');
    const isExport = tab.dataset.tab === 'export';
    exportPanel.classList.toggle('active', isExport);
    importPanel.classList.toggle('active', !isExport);
    if (!isExport) showImportStep(1);
  });
});

// ── EXPORT ────────────────────────────────────────────────
document.getElementById('export-cancel').addEventListener('click', closeMigrateModal);
document.getElementById('export-confirm').addEventListener('click', async () => {
  const btn = document.getElementById('export-confirm');
  btn.disabled = true;
  btn.textContent = 'Exporting...';

  const res = await window.crypthub.exportVault();

  btn.disabled = false;
  btn.textContent = 'Export Vault →';

  if (res.ok) {
    closeMigrateModal();
    toast(`Exported ${res.count} entries successfully!`);
  } else if (res.error !== 'Cancelled') {
    toast(res.error || 'Export failed', 'error');
  }
});

// ── IMPORT ────────────────────────────────────────────────
function showImportStep(n) {
  document.querySelectorAll('.import-step').forEach((el, i) => {
    el.classList.toggle('active', i + 1 === n);
  });
}

document.getElementById('import-cancel-1').addEventListener('click', closeMigrateModal);

document.getElementById('import-pick-file').addEventListener('click', async () => {
  const btn = document.getElementById('import-pick-file');
  btn.disabled = true;
  btn.textContent = 'Opening...';

  const res = await window.crypthub.importVault();

  btn.disabled = false;
  btn.textContent = 'Select .crypthub File →';

  if (!res.ok) {
    if (res.error !== 'Cancelled') toast(res.error, 'error');
    return;
  }

  importBundle = res.bundle;
  document.getElementById('import-error').textContent = '';
  document.getElementById('import-pwd').value = '';
  showImportStep(2);
  setTimeout(() => document.getElementById('import-pwd').focus(), 100);
});

document.getElementById('import-cancel-2').addEventListener('click', () => {
  importBundle = null;
  showImportStep(1);
});

async function doVerifyAndRestore() {
  const pwd = document.getElementById('import-pwd').value.trim();
  const errEl = document.getElementById('import-error');
  if (!pwd) { errEl.textContent = 'Please enter your master password.'; return; }

  const btn = document.getElementById('import-verify');
  btn.disabled = true;
  btn.textContent = 'Verifying...';
  errEl.textContent = '';

  const res = await window.crypthub.verifyAndRestore({ bundleB64: importBundle, masterPassword: pwd });

  btn.disabled = false;
  btn.textContent = 'Verify & Restore Vault';

  if (!res.ok) {
    errEl.textContent = res.error || 'Verification failed.';
    return;
  }

  // Success
  const exported = new Date(res.exportedAt).toLocaleDateString('en-US', { year:'numeric', month:'long', day:'numeric' });
  document.getElementById('import-success-msg').textContent =
    `${res.count} entr${res.count === 1 ? 'y' : 'ies'} restored from backup created on ${exported}.`;
  showImportStep(3);

  // Reload entries in background
  await loadEntries();
}

document.getElementById('import-verify').addEventListener('click', doVerifyAndRestore);
document.getElementById('import-pwd').addEventListener('keydown', e => { if (e.key === 'Enter') doVerifyAndRestore(); });

document.getElementById('import-done').addEventListener('click', () => {
  closeMigrateModal();
  toast(`Vault restored successfully!`);
});

// ── Init ───────────────────────────────────────────────────────
initLock();