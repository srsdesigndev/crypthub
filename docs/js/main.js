'use strict';

// ═══════════════════════════════════════════
//  CRYPTO  (PBKDF2 + AES-256-GCM)
//
//  Binary layout (68-byte header):
//  [0-3]  magic CRHB
//  [4-7]  version = 1
//  [8-39] salt (32 bytes)
//  [40-51] iv  (12 bytes)
//  [52-67] tag (16 bytes)
//  [68+]  ciphertext
// ═══════════════════════════════════════════

async function cryptEncrypt(plainObj, password) {
  const salt = crypto.getRandomValues(new Uint8Array(32));
  const iv   = crypto.getRandomValues(new Uint8Array(12));

  const km  = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:310000, hash:'SHA-256' },
    km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
  );

  const enc = new Uint8Array(await crypto.subtle.encrypt(
    { name:'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify(plainObj))
  ));

  // WebCrypto AES-GCM output = ciphertext + 16-byte tag
  const ct  = enc.slice(0, enc.length - 16);
  const tag = enc.slice(enc.length - 16);

  // Build file bundle
  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, 1, false);
  const out = new Uint8Array(68 + ct.length);
  let i = 0;
  const w = b => { out.set(b, i); i += b.length; };
  w(new Uint8Array([0x43,0x52,0x48,0x42])); // CRHB
  w(ver); w(salt); w(iv); w(tag); w(ct);

  return { bytes: out, key, salt };
}

async function cryptDecrypt(fileBytes, password) {
  // fileBytes must be Uint8Array
  if (fileBytes.length < 69)
    throw new Error(`File too small (${fileBytes.length} bytes).`);
  if (fileBytes[0] !== 0x43 || fileBytes[1] !== 0x52 || fileBytes[2] !== 0x48 || fileBytes[3] !== 0x42)
    throw new Error('Not a valid .crypthub file.');

  // Slice makes independent copies — safe to pass to SubtleCrypto
  const salt = fileBytes.slice(8,  40);
  const iv   = fileBytes.slice(40, 52);
  const tag  = fileBytes.slice(52, 68);
  const ct   = fileBytes.slice(68);

  const km  = await crypto.subtle.importKey('raw', new TextEncoder().encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey(
    { name:'PBKDF2', salt, iterations:310000, hash:'SHA-256' },
    km, { name:'AES-GCM', length:256 }, false, ['encrypt','decrypt']
  );

  // WebCrypto decrypt wants ciphertext+tag together
  const combined = new Uint8Array(ct.length + 16);
  combined.set(ct); combined.set(tag, ct.length);

  let plain;
  try {
    plain = await crypto.subtle.decrypt({ name:'AES-GCM', iv }, key, combined);
  } catch {
    throw new Error('Wrong master password.');
  }

  return { data: JSON.parse(new TextDecoder().decode(plain)), key, salt };
}

async function cryptReEncrypt(plainObj, key, salt) {
  const iv  = crypto.getRandomValues(new Uint8Array(12));
  const enc = new Uint8Array(await crypto.subtle.encrypt(
    { name:'AES-GCM', iv }, key,
    new TextEncoder().encode(JSON.stringify(plainObj))
  ));
  const ct  = enc.slice(0, enc.length - 16);
  const tag = enc.slice(enc.length - 16);

  const ver = new Uint8Array(4);
  new DataView(ver.buffer).setUint32(0, 1, false);
  const out = new Uint8Array(68 + ct.length);
  let i = 0;
  const w = b => { out.set(b, i); i += b.length; };
  w(new Uint8Array([0x43,0x52,0x48,0x42]));
  w(ver); w(new Uint8Array(salt)); w(iv); w(tag); w(ct);
  return out;
}

// ═══════════════════════════════════════════
//  STATE
// ═══════════════════════════════════════════
let FH       = null;   // FileSystemFileHandle
let KEY      = null;   // CryptoKey (in-memory only)
let SALT     = null;   // Uint8Array
let ENTRIES  = [];     // plaintext entries in memory
let NEXT_ID  = 1;
let SAVING   = false;
let CUR_CAT  = 'All';
let QUERY    = '';

// ═══════════════════════════════════════════
//  HELPERS
// ═══════════════════════════════════════════
const $ = id => document.getElementById(id);
const esc = s => (s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');

let toastT;
function toast(msg, type='success') {
  const t = $('toast');
  t.textContent = msg; t.className = `on ${type}`;
  clearTimeout(toastT);
  toastT = setTimeout(() => t.className = '', 2600);
}

function setSaveStatus(state) {
  // state: 'saving' | 'saved' | 'idle'
  const el = $('save-status');
  el.className = `save-status ${state}`;
  el.textContent = state === 'saving' ? '● Saving…' : state === 'saved' ? '✓ Saved' : '● Saved';
}

// ═══════════════════════════════════════════
//  AUTO-SAVE  ← THE KEY FIX
//  Every add/edit/delete immediately writes
//  the encrypted file to disk. No manual save.
// ═══════════════════════════════════════════
async function persistNow() {
  if (!FH || !KEY) return;
  setSaveStatus('saving');
  $('btn-add').disabled = true;
  try {
    const payload = { v:1, entries:ENTRIES, nextId:NEXT_ID };
    const bytes   = await cryptReEncrypt(payload, KEY, SALT);
    const w       = await FH.createWritable();
    await w.write(bytes);
    await w.close();
    setSaveStatus('saved');
    console.log('[save] wrote', bytes.length, 'bytes,', ENTRIES.length, 'entries');
  } catch(e) {
    console.error('[save]', e);
    toast('Save failed: ' + e.message, 'error');
  }
  $('btn-add').disabled = false;
}

// ═══════════════════════════════════════════
//  ROUTING
// ═══════════════════════════════════════════
function showFile() {
  $('s-file').classList.remove('hidden');
  $('s-lock').classList.add('hidden');
  $('app').classList.add('hidden');
}

function showLock(isNew) {
  $('s-file').classList.add('hidden');
  $('s-lock').classList.remove('hidden');
  $('app').classList.add('hidden');
  $('l-fname').textContent = FH?.name || 'vault.crypthub';
  $('l-mode').textContent  = isNew ? 'CREATE NEW VAULT' : 'UNLOCK VAULT';
  $('l-btn').textContent   = isNew ? 'Create Vault' : 'Unlock';
  $('l-pwd').value = '';
  $('l-conf').value = '';
  $('l-err').textContent = '';
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

// ═══════════════════════════════════════════
//  FILE SCREEN
// ═══════════════════════════════════════════
$('btn-new').onclick = async () => {
  try {
    FH = await window.showSaveFilePicker({
      suggestedName: 'my-vault.crypthub',
      types: [{ description:'CryptHub Vault', accept:{'application/octet-stream':['.crypthub']} }]
    });
    showLock(true);
  } catch(e) { if (e.name !== 'AbortError') toast(e.message, 'error'); }
};

$('btn-open').onclick = async () => {
  try {
    [FH] = await window.showOpenFilePicker({
      types: [{ description:'CryptHub Vault', accept:{'application/octet-stream':['.crypthub']} }],
      multiple: false
    });
    showLock(false);
  } catch(e) { if (e.name !== 'AbortError') toast(e.message, 'error'); }
};

// ═══════════════════════════════════════════
//  LOCK SCREEN
// ═══════════════════════════════════════════
$('btn-back').onclick = () => { FH = null; showFile(); };
$('l-btn').onclick = doUnlock;
$('l-pwd').onkeydown  = e => { if (e.key==='Enter') doUnlock(); };
$('l-conf').onkeydown = e => { if (e.key==='Enter') doUnlock(); };

async function doUnlock() {
  const isNew = $('l-btn').textContent.includes('Create');
  const pwd   = $('l-pwd').value;
  const conf  = $('l-conf').value;
  const err   = $('l-err');
  err.textContent = '';

  if (!pwd)                    { err.textContent = 'Password required.'; return; }
  if (isNew && pwd.length < 6) { err.textContent = 'Min 6 characters.'; return; }
  if (isNew && pwd !== conf)   { err.textContent = 'Passwords do not match.'; return; }

  $('l-btn').disabled    = true;
  $('l-btn').textContent = '⏳ Working…';

  try {
    if (isNew) {
      // Create empty vault file
      const { bytes, key, salt } = await cryptEncrypt({ v:1, entries:[], nextId:1 }, pwd);
      const w = await FH.createWritable();
      await w.write(bytes);
      await w.close();
      KEY = key; SALT = new Uint8Array(salt); ENTRIES = []; NEXT_ID = 1;
      toast('Vault created! Add your first entry.');
    } else {
      // Read and decrypt existing file
      const file  = await FH.getFile();
      const bytes = new Uint8Array(await file.arrayBuffer());
      console.log('[open] file:', file.name, 'size:', bytes.length);
      if (bytes.length === 0) throw new Error('File is empty.');
      const { data, key, salt } = await cryptDecrypt(bytes, pwd);
      console.log('[open] entries found:', data.entries?.length ?? 0);
      KEY = key; SALT = new Uint8Array(salt);
      ENTRIES = Array.isArray(data.entries) ? data.entries : [];
      NEXT_ID = typeof data.nextId === 'number' ? data.nextId : ENTRIES.length + 1;
    }
    showApp();
  } catch(e) {
    console.error('[unlock]', e);
    err.textContent = e.message;
  }

  $('l-btn').disabled    = false;
  $('l-btn').textContent = isNew ? 'Create Vault' : 'Unlock';
}

// ═══════════════════════════════════════════
//  LOCK
// ═══════════════════════════════════════════
$('btn-lock').onclick = () => {
  KEY = SALT = null; ENTRIES = []; NEXT_ID = 1;
  showLock(false); // go back to password screen for same file
};

// ═══════════════════════════════════════════
//  RENDER
// ═══════════════════════════════════════════
const ICONS = { All:'⊞',General:'◈',Social:'◉',Work:'◆',Finance:'◇',Entertainment:'◎','Dev / Tech':'◐',Shopping:'◑',Other:'○' };

function renderAll() { renderSidebar(); renderEntries(); }

function renderSidebar() {
  const cats = ['All', ...new Set(ENTRIES.map(e=>e.category).filter(Boolean).sort())];
  $('cats').innerHTML = cats.map(c => {
    const n = c==='All' ? ENTRIES.length : ENTRIES.filter(e=>e.category===c).length;
    return `<div class="cat ${CUR_CAT===c?'on':''}" data-c="${c}">
      <span>${ICONS[c]||'○'}</span><span class="cat-n">${c}</span><span class="cat-c">${n}</span>
    </div>`;
  }).join('');
  $('cats').querySelectorAll('.cat').forEach(el => {
    el.onclick = () => { CUR_CAT=el.dataset.c; $('m-title').textContent=CUR_CAT==='All'?'All Passwords':CUR_CAT; renderAll(); };
  });
}

function getFiltered() {
  const q = QUERY.toLowerCase();
  return ENTRIES.filter(e =>
    (CUR_CAT==='All' || e.category===CUR_CAT) &&
    (!q || e.label.toLowerCase().includes(q) || (e.username||'').toLowerCase().includes(q))
  );
}

function renderEntries() {
  const rows = getFiltered();
  $('m-cnt').textContent = `${rows.length} entr${rows.length===1?'y':'ies'}`;
  if (!rows.length) {
    $('list').innerHTML = `<div class="empty">
      <svg width="44" height="44" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.2">
        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
      </svg>
      <p>${QUERY ? 'No results.' : 'No entries yet — click New Entry to start.'}</p>
    </div>`;
    return;
  }
  $('list').innerHTML = rows.map(e => `
    <div class="ec">
      <div class="ec-cat">${esc(e.category||'General')}</div>
      <div class="ec-lbl">${esc(e.label)}</div>
      <div class="ec-usr">${esc(e.username||'')}</div>
      <div class="ec-acts">
        <button class="ab" data-a="copy" data-id="${e.id}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="9" y="9" width="13" height="13" rx="2"/><path d="M5 15H4a2 2 0 0 1-2-2V4a2 2 0 0 1 2-2h9a2 2 0 0 1 2 2v1"/></svg>Copy
        </button>
        <button class="ab" data-a="edit" data-id="${e.id}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/><path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/></svg>Edit
        </button>
        <button class="ab del" data-a="del" data-id="${e.id}">
          <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="3 6 5 6 21 6"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/><path d="M10 11v6"/><path d="M14 11v6"/></svg>Delete
        </button>
      </div>
    </div>`).join('');

  $('list').querySelectorAll('.ab').forEach(btn => {
    btn.onclick = async ev => {
      ev.stopPropagation();
      const id    = parseInt(btn.dataset.id);
      const entry = ENTRIES.find(x => x.id===id);
      if (!entry) return;
      if (btn.dataset.a === 'copy') {
        await navigator.clipboard.writeText(entry.password);
        btn.classList.add('ok');
        btn.innerHTML = `<svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>Copied!`;
        setTimeout(renderEntries, 1600);
        toast('Copied to clipboard!');
      } else if (btn.dataset.a === 'edit') {
        openModal(entry);
      } else if (btn.dataset.a === 'del') {
        if (confirm(`Delete "${entry.label}"?`)) {
          ENTRIES = ENTRIES.filter(x => x.id!==id);
          renderAll();
          toast('Deleted.', 'error');
          await persistNow(); // ← auto-save immediately
        }
      }
    };
  });
}

$('srch').oninput = e => { QUERY=e.target.value; renderEntries(); };

// ═══════════════════════════════════════════
//  MODAL
// ═══════════════════════════════════════════
function openModal(entry=null) {
  $('eid').value    = entry ? entry.id : '';
  $('m-ttl').textContent = entry ? 'Edit Entry' : 'New Entry';
  $('f-lbl').value  = entry ? entry.label : '';
  $('f-usr').value  = entry ? (entry.username||'') : '';
  $('f-pwd').value  = entry ? entry.password : '';
  $('f-cat').value  = entry ? (entry.category||'General') : 'General';
  $('f-nts').value  = entry ? (entry.notes||'') : '';
  strength($('f-pwd').value);
  $('modal').classList.remove('hidden');
  setTimeout(() => $('f-lbl').focus(), 50);
}
function closeModal() { $('modal').classList.add('hidden'); }

$('btn-add').onclick = () => openModal();
$('m-cls').onclick   = closeModal;
$('m-cancel').onclick= closeModal;

$('m-save').onclick = async () => {
  const label = $('f-lbl').value.trim();
  const pwd   = $('f-pwd').value.trim();
  if (!label) { toast('Label required.','error'); $('f-lbl').focus(); return; }
  if (!pwd)   { toast('Password required.','error'); $('f-pwd').focus(); return; }

  const data = {
    label, password: pwd,
    username: $('f-usr').value.trim(),
    category: $('f-cat').value,
    notes:    $('f-nts').value.trim(),
    updated_at: new Date().toISOString()
  };

  const id = $('eid').value;
  if (id) {
    const i = ENTRIES.findIndex(e => e.id===parseInt(id));
    if (i>=0) ENTRIES[i] = { ...ENTRIES[i], ...data };
    toast('Entry updated!');
  } else {
    ENTRIES.push({ id: NEXT_ID++, ...data, created_at: new Date().toISOString() });
    toast('Entry saved!');
  }

  closeModal();
  renderAll();
  await persistNow(); // ← auto-save immediately after every change
};

$('btn-gen').onclick = () => {
  const pool  = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789!@#$%^&*()-_=+[]{}';
  const bytes = crypto.getRandomValues(new Uint8Array(20));
  const p = Array.from(bytes).map(b=>pool[b%pool.length]).join('');
  $('f-pwd').value = p;
  strength(p);
  toast('Password generated!');
};
$('f-pwd').oninput = e => strength(e.target.value);

function strength(p) {
  const segs=[1,2,3,4].map(n=>$(`ss${n}`));
  const lbl=$('s-lbl');
  segs.forEach(s=>s.className='ss');
  if (!p) { lbl.textContent=''; return; }
  let sc=0;
  if(p.length>=8)sc++;if(p.length>=14)sc++;
  if(/[A-Z]/.test(p)&&/[0-9]/.test(p))sc++;
  if(/[^A-Za-z0-9]/.test(p))sc++;
  lbl.textContent=['','Weak','Fair','Strong','Very Strong'][sc]||'';
  for(let i=0;i<sc;i++) segs[i].classList.add(`s${sc}`);
}

// ═══════════════════════════════════════════
//  BROWSER CHECK
// ═══════════════════════════════════════════
if (!window.showSaveFilePicker) {
  $('s-file').innerHTML = `<div class="card" style="text-align:center">
    <div style="font-size:44px;margin-bottom:16px">⚠️</div>
    <div class="logo">Crypt<span>Hub</span></div>
    <p style="color:var(--muted);font-size:13px;line-height:1.8;margin-top:16px">
      Your browser doesn't support the File System Access API.<br/>
      Use <strong style="color:var(--text)">Chrome 86+</strong> or <strong style="color:var(--text)">Edge 86+</strong>.
    </p>
  </div>`;
}