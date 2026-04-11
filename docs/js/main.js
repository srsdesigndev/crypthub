'use strict';

// ═══════════════════════════════════════════════════════════
//  CRYPTO  —  PBKDF2 + AES-256-GCM
//
//  Binary file format (68-byte header):
//  [0-3]   magic  CRHB (0x43 0x52 0x48 0x42)
//  [4-7]   version = 1  (uint32, big-endian)
//  [8-39]  salt   (32 bytes, random, per-vault)
//  [40-51] iv     (12 bytes, random, per-write)
//  [52-67] tag    (16 bytes, GCM auth tag)
//  [68+]   ciphertext   (AES-256-GCM encrypted JSON)
// ═══════════════════════════════════════════════════════════

async function cryptEncrypt(plainObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const km  = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );

  const enc = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify(plainObj))
  ));

  const ct  = enc.slice(0, enc.length - 16);
  const tag = enc.slice(enc.length - 16);

  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, 1, false);

  const out = new Uint8Array(68 + ct.length);
  let i = 0;
  const w = b => { out.set(b, i); i += b.length; };
  w(new Uint8Array([0x43, 0x52, 0x48, 0x42]));
  w(ver); w(salt); w(iv); w(tag); w(ct);

  return { bytes: out, key, salt };
}

async function cryptDecrypt(fileBytes, password) {
  if (fileBytes.length < 69)
    throw new Error(`File too small (${fileBytes.length} bytes).`);
  if (
    fileBytes[0] !== 0x43 || fileBytes[1] !== 0x52 ||
    fileBytes[2] !== 0x48 || fileBytes[3] !== 0x42
  ) throw new Error('Not a valid .crypthub file.');

  const salt = fileBytes.slice(8,  40);
  const iv   = fileBytes.slice(40, 52);
  const tag  = fileBytes.slice(52, 68);
  const ct   = fileBytes.slice(68);

  const km  = await crypto.subtle.importKey(
    'raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']
  );
  const key = await crypto.subtle.deriveKey(
    { name: 'PBKDF2', salt, iterations: 310000, hash: 'SHA-256' },
    km, { name: 'AES-GCM', length: 256 }, false, ['encrypt', 'decrypt']
  );

  const combined = new Uint8Array(ct.length + 16);
  combined.set(ct); combined.set(tag, ct.length);

  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, combined);
  } catch {
    throw new Error('Wrong master password.');
  }

  return { data: JSON.parse(new TextDecoder().decode(plain)), key, salt };
}

async function cryptReEncrypt(plainObj, key, salt) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt(
    { name: 'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify(plainObj))
  ));
  const ct  = enc.slice(0, enc.length - 16);
  const tag = enc.slice(enc.length - 16);

  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, 1, false);

  const out = new Uint8Array(68 + ct.length);
  let i = 0;
  const w = b => { out.set(b, i); i += b.length; };
  w(new Uint8Array([0x43, 0x52, 0x48, 0x42]));
  w(ver); w(new Uint8Array(salt)); w(iv); w(tag); w(ct);
  return out;
}

// ═══════════════════════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════════════════════
let FH      = null;   // FileSystemFileHandle
let KEY     = null;   // CryptoKey (in-memory only)
let SALT    = null;   // Uint8Array
let ENTRIES = [];     // plaintext entries (in-memory only)
let NEXT_ID = 1;
let CUR_CAT = 'All';
let QUERY   = '';

// ═══════════════════════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════════════════════
const $ = id => document.getElementById(id);
const esc = s => (s || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');

let toastTimer;
function toast(msg, type = 'success') {
  const t = $('toast');
  t.textContent = msg;
  t.className = `on ${type}`;
  clearTimeout(toastTimer);
  toastTimer = setTimeout(() => t.className = '', 2400);
}

function setSaveStatus(state) {
  const el = $('save-status');
  el.className = `tb-status ${state}`;
  el.textContent = state === 'saving' ? 'saving…' : 'saved';
}

// ═══════════════════════════════════════════════════════════
//  PERSIST  —  re-encrypt and write to file on every change
// ═══════════════════════════════════════════════════════════
async function persistNow() {
  if (!FH || !KEY) return;
  setSaveStatus('saving');
  $('btn-add').disabled    = true;
  $('btn-add-tb').disabled = true;
  try {
    const payload = { v: 1, entries: ENTRIES, nextId: NEXT_ID };
    const bytes   = await cryptReEncrypt(payload, KEY, SALT);
    const w       = await FH.createWritable();
    await w.write(bytes);
    await w.close();
    setSaveStatus('saved');
  } catch (e) {
    console.error('[save]', e);
    toast('Save failed: ' + e.message, 'error');
  }
  $('btn-add').disabled    = false;
  $('btn-add-tb').disabled = false;
}

// ═══════════════════════════════════════════════════════════
//  ROUTING
// ═══════════════════════════════════════════════════════════
function showFile() {
  $('s-file').classList.remove('hidden');
  $('s-lock').classList.add('hidden');
  $('app').classList.add('hidden');
}

function showLock(isNew) {
  $('s-file').classList.add('hidden');
  $('s-lock').classList.remove('hidden');
  $('app').classList.add('hidden');
  $('l-fname').textContent    = FH?.name || 'vault.crypthub';
  $('l-mode').textContent     = isNew ? 'Create new vault' : 'Unlock vault';
  $('l-btn').textContent      = isNew ? 'Create Vault' : 'Unlock';
  $('l-pwd').value            = '';
  $('l-conf').value           = '';
  $('l-err').textContent      = '';
  $('l-conf-wrap').classList.toggle('hidden', !isNew);
  setTimeout(() => $('l-pwd').focus(), 80);
}

function showApp() {
  $('s-file').classList.add('hidden');
  $('s-lock').classList.add('hidden');
  $('app').classList.remove('hidden');
  $('tb-fname').textContent = FH?.name || 'vault.crypthub';
  setSaveStatus('saved');
  renderAll();
}

// ═══════════════════════════════════════════════════════════
//  FILE SCREEN
// ═══════════════════════════════════════════════════════════
$('btn-new').onclick = async () => {
  try {
    FH = await window.showSaveFilePicker({
      suggestedName: 'my-vault.crypthub',
      types: [{ description: 'CryptHub Vault', accept: { 'application/octet-stream': ['.crypthub'] } }]
    });
    showLock(true);
  } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'error'); }
};

$('btn-open').onclick = async () => {
  try {
    [FH] = await window.showOpenFilePicker({
      types: [{ description: 'CryptHub Vault', accept: { 'application/octet-stream': ['.crypthub'] } }],
      multiple: false
    });
    showLock(false);
  } catch (e) { if (e.name !== 'AbortError') toast(e.message, 'error'); }
};

// ═══════════════════════════════════════════════════════════
//  LOCK SCREEN
// ═══════════════════════════════════════════════════════════
$('btn-back').onclick  = () => { FH = null; showFile(); };
$('l-btn').onclick     = doUnlock;
$('l-pwd').onkeydown   = e => { if (e.key === 'Enter') doUnlock(); };
$('l-conf').onkeydown  = e => { if (e.key === 'Enter') doUnlock(); };

async function doUnlock() {
  const isNew = $('l-btn').textContent.includes('Create');
  const pwd   = $('l-pwd').value;
  const conf  = $('l-conf').value;
  const err   = $('l-err');
  err.textContent = '';

  if (!pwd)                    { err.textContent = 'Password required.'; return; }
  if (isNew && pwd.length < 6) { err.textContent = 'Minimum 6 characters.'; return; }
  if (isNew && pwd !== conf)   { err.textContent = 'Passwords do not match.'; return; }

  $('l-btn').disabled    = true;
  $('l-btn').textContent = 'working…';

  try {
    if (isNew) {
      const { bytes, key, salt } = await cryptEncrypt({ v: 1, entries: [], nextId: 1 }, pwd);
      const w = await FH.createWritable();
      await w.write(bytes); await w.close();
      KEY = key; SALT = new Uint8Array(salt); ENTRIES = []; NEXT_ID = 1;
      toast('Vault created.');
    } else {
      const file  = await FH.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      if (bytes.length === 0) throw new Error('File is empty.');
      const { data, key, salt } = await cryptDecrypt(bytes, pwd);
      KEY     = key;
      SALT    = new Uint8Array(salt);
      ENTRIES = Array.isArray(data.entries) ? data.entries : [];
      NEXT_ID = typeof data.nextId === 'number' ? data.nextId : ENTRIES.length + 1;
    }
    showApp();
  } catch (e) {
    console.error('[unlock]', e);
    err.textContent = e.message;
  }

  $('l-btn').disabled    = false;
  $('l-btn').textContent = isNew ? 'Create Vault' : 'Unlock';
}

// ═══════════════════════════════════════════════════════════
//  LOCK
// ═══════════════════════════════════════════════════════════
$('btn-lock').onclick = () => {
  KEY = null; SALT = null; ENTRIES = []; NEXT_ID = 1;
  showLock(false);
};

// ═══════════════════════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════════════════════
function renderAll() { renderSidebar(); renderEntries(); }

function renderSidebar() {
  const cats = ['All', ...new Set(ENTRIES.map(e => e.category).filter(Boolean).sort())];
  $('cats').innerHTML = cats.map(c => {
    const n = c === 'All' ? ENTRIES.length : ENTRIES.filter(e => e.category === c).length;
    return `<div class="cat ${CUR_CAT === c ? 'on' : ''}" data-c="${esc(c)}">
      <span>${esc(c)}</span>
      <span class="cat-count">${n}</span>
    </div>`;
  }).join('');
  $('cats').querySelectorAll('.cat').forEach(el => {
    el.onclick = () => {
      CUR_CAT = el.dataset.c;
      $('m-title').textContent = CUR_CAT;
      renderAll();
    };
  });
}

function getFiltered() {
  const q = QUERY.toLowerCase();
  return ENTRIES.filter(e =>
    (CUR_CAT === 'All' || e.category === CUR_CAT) &&
    (!q || e.label.toLowerCase().includes(q) || (e.username || '').toLowerCase().includes(q))
  );
}

function renderEntries() {
  const rows = getFiltered();
  $('m-cnt').textContent = `${rows.length} entr${rows.length === 1 ? 'y' : 'ies'}`;

  if (!rows.length) {
    $('list').innerHTML = `<div class="empty">${QUERY ? 'no results.' : 'no entries. add one with the button above.'}</div>`;
    return;
  }

  $('list').innerHTML = `
    <table class="entries">
      <thead>
        <tr>
          <th>Label</th>
          <th>Username</th>
          <th>Category</th>
          <th></th>
        </tr>
      </thead>
      <tbody>
        ${rows.map(e => `
          <tr>
            <td class="td-label">${esc(e.label)}</td>
            <td class="td-user">${esc(e.username || '—')}</td>
            <td class="td-cat">${esc(e.category || 'general')}</td>
            <td class="td-acts">
              <button class="act" data-a="copy" data-id="${e.id}">copy</button>
              <button class="act" data-a="edit" data-id="${e.id}">edit</button>
              <button class="act del" data-a="del"  data-id="${e.id}">delete</button>
            </td>
          </tr>`).join('')}
      </tbody>
    </table>`;

  $('list').querySelectorAll('.act').forEach(btn => {
    btn.onclick = async ev => {
      ev.stopPropagation();
      const id    = parseInt(btn.dataset.id);
      const entry = ENTRIES.find(x => x.id === id);
      if (!entry) return;

      if (btn.dataset.a === 'copy') {
        await navigator.clipboard.writeText(entry.password);
        btn.classList.add('copied');
        btn.textContent = 'copied!';
        setTimeout(() => { btn.classList.remove('copied'); btn.textContent = 'copy'; }, 1800);
        toast('Password copied to clipboard.');

      } else if (btn.dataset.a === 'edit') {
        openModal(entry);

      } else if (btn.dataset.a === 'del') {
        if (confirm(`Delete "${entry.label}"?`)) {
          ENTRIES = ENTRIES.filter(x => x.id !== id);
          renderAll();
          toast('Entry deleted.', 'warn');
          await persistNow();
        }
      }
    };
  });
}

$('srch').oninput = e => { QUERY = e.target.value; renderEntries(); };

// ═══════════════════════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════════════════════
function openModal(entry = null) {
  $('eid').value         = entry ? entry.id : '';
  $('m-ttl').textContent = entry ? 'Edit Entry' : 'New Entry';
  $('f-lbl').value       = entry ? entry.label       : '';
  $('f-usr').value       = entry ? (entry.username  || '') : '';
  $('f-pwd').value       = entry ? entry.password    : '';
  $('f-cat').value       = entry ? (entry.category  || 'General') : 'General';
  $('f-nts').value       = entry ? (entry.notes     || '') : '';
  strength($('f-pwd').value);
  $('modal').classList.remove('hidden');
  setTimeout(() => $('f-lbl').focus(), 50);
}

function closeModal() { $('modal').classList.add('hidden'); }

$('btn-add').onclick    = () => openModal();
$('btn-add-tb').onclick = () => openModal();
$('m-cls').onclick      = closeModal;
$('m-cancel').onclick   = closeModal;

// close modal on backdrop click
$('modal').onclick = e => { if (e.target === $('modal')) closeModal(); };

// close modal on Escape
document.addEventListener('keydown', e => {
  if (e.key === 'Escape' && !$('modal').classList.contains('hidden')) closeModal();
});

$('m-save').onclick = async () => {
  const label = $('f-lbl').value.trim();
  const pwd   = $('f-pwd').value.trim();
  if (!label) { toast('Label is required.', 'error'); $('f-lbl').focus(); return; }
  if (!pwd)   { toast('Password is required.', 'error'); $('f-pwd').focus(); return; }

  const data = {
    label,
    password:   pwd,
    username:   $('f-usr').value.trim(),
    category:   $('f-cat').value,
    notes:      $('f-nts').value.trim(),
    updated_at: new Date().toISOString()
  };

  const id = $('eid').value;
  if (id) {
    const i = ENTRIES.findIndex(e => e.id === parseInt(id));
    if (i >= 0) ENTRIES[i] = { ...ENTRIES[i], ...data };
    toast('Entry updated.');
  } else {
    ENTRIES.push({ id: NEXT_ID++, ...data, created_at: new Date().toISOString() });
    toast('Entry saved.');
  }

  closeModal();
  renderAll();
  await persistNow();
};

// ═══════════════════════════════════════════════════════════
//  PASSWORD GENERATOR
// ═══════════════════════════════════════════════════════════
$('btn-gen').onclick = () => {
  const pool  = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const p     = Array.from(bytes).map(b => pool[b % pool.length]).join('');
  $('f-pwd').value = p;
  strength(p);
  toast('Password generated.');
};

$('f-pwd').oninput = e => strength(e.target.value);

function strength(p) {
  const segs = [1, 2, 3, 4].map(n => $(`ss${n}`));
  const lbl  = $('s-lbl');
  segs.forEach(s => s.className = 'ss');
  if (!p) { lbl.textContent = ''; return; }
  let sc = 0;
  if (p.length >= 8)  sc++;
  if (p.length >= 14) sc++;
  if (/[A-Z]/.test(p) && /[0-9]/.test(p)) sc++;
  if (/[^A-Za-z0-9]/.test(p)) sc++;
  lbl.textContent = ['', 'weak', 'fair', 'strong', 'very strong'][sc] || '';
  for (let i = 0; i < sc; i++) segs[i].classList.add(`s${sc}`);
}

// ═══════════════════════════════════════════════════════════
//  BROWSER CHECK
// ═══════════════════════════════════════════════════════════
if (!window.showSaveFilePicker) {
  $('s-file').innerHTML = `
    <div class="box">
      <div class="box-title">Crypt<span>Hub</span></div>
      <div class="box-sub" style="margin-bottom:0">browser not supported</div>
      <div class="notice" style="margin-top:16px">
        CryptHub requires the File System Access API.<br/>
        Use <strong>Chrome 86+</strong> or <strong>Edge 86+</strong>.<br/><br/>
        Firefox and Safari do not support this API.
      </div>
    </div>`;
}