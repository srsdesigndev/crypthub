const { app, BrowserWindow, ipcMain, dialog } = require('electron');
const path   = require('path');
const fs     = require('fs');
const Database = require('better-sqlite3');
const crypto = require('crypto');

// ── Database setup ──────────────────────────────────────────────
const dbPath = path.join(app.getPath('userData'), 'crypthub.db');
let db;

function initDB() {
  db = new Database(dbPath);
  db.exec(`
    CREATE TABLE IF NOT EXISTS passwords (
      id         INTEGER PRIMARY KEY AUTOINCREMENT,
      label      TEXT    NOT NULL,
      username   TEXT,
      password   TEXT    NOT NULL,
      category   TEXT    DEFAULT 'General',
      notes      TEXT,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      updated_at DATETIME DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS master (
      id   INTEGER PRIMARY KEY,
      hash TEXT NOT NULL,
      salt TEXT NOT NULL
    );
  `);
}

// ── Crypto helpers ──────────────────────────────────────────────
const ALGO = 'aes-256-gcm';

function deriveKey(password, salt) {
  return crypto.scryptSync(password, salt, 32);
}

function encrypt(text, key) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv(ALGO, key, iv);
  const data   = Buffer.concat([cipher.update(text, 'utf8'), cipher.final()]);
  const tag    = cipher.getAuthTag();
  return JSON.stringify({ iv: iv.toString('hex'), tag: tag.toString('hex'), data: data.toString('hex') });
}

function decrypt(payload, key) {
  const { iv, tag, data } = JSON.parse(payload);
  const decipher = crypto.createDecipheriv(ALGO, key, Buffer.from(iv, 'hex'));
  decipher.setAuthTag(Buffer.from(tag, 'hex'));
  return decipher.update(Buffer.from(data, 'hex')) + decipher.final('utf8');
}

// ── Session master key (in-memory only) ────────────────────────
let sessionKey = null;

// ── IPC: Auth ───────────────────────────────────────────────────

ipcMain.handle('has-master', () => {
  return !!db.prepare('SELECT id FROM master LIMIT 1').get();
});

ipcMain.handle('set-master', (_, password) => {
  const salt = crypto.randomBytes(32).toString('hex');
  const hash = crypto.scryptSync(password, salt, 64).toString('hex');
  db.prepare('INSERT INTO master (id, hash, salt) VALUES (1, ?, ?)').run(hash, salt);
  sessionKey = deriveKey(password, salt);
  return { ok: true };
});

ipcMain.handle('unlock', (_, password) => {
  const row = db.prepare('SELECT hash, salt FROM master WHERE id = 1').get();
  if (!row) return { ok: false, error: 'No master password set' };
  const hash = crypto.scryptSync(password, row.salt, 64).toString('hex');
  if (hash !== row.hash) return { ok: false, error: 'Wrong password' };
  sessionKey = deriveKey(password, row.salt);
  return { ok: true };
});

ipcMain.handle('lock', () => {
  sessionKey = null;
  return { ok: true };
});

// ── IPC: Entries ────────────────────────────────────────────────

ipcMain.handle('get-entries', () => {
  if (!sessionKey) return { ok: false, error: 'Locked' };
  const rows = db.prepare('SELECT * FROM passwords ORDER BY category, label').all();
  return {
    ok: true,
    entries: rows.map(r => ({ ...r, password: decrypt(r.password, sessionKey) }))
  };
});

ipcMain.handle('add-entry', (_, { label, username, password, category, notes }) => {
  if (!sessionKey) return { ok: false, error: 'Locked' };
  const result = db.prepare(
    'INSERT INTO passwords (label, username, password, category, notes) VALUES (?, ?, ?, ?, ?)'
  ).run(label, username || '', encrypt(password, sessionKey), category || 'General', notes || '');
  return { ok: true, id: result.lastInsertRowid };
});

ipcMain.handle('update-entry', (_, { id, label, username, password, category, notes }) => {
  if (!sessionKey) return { ok: false, error: 'Locked' };
  db.prepare(
    'UPDATE passwords SET label=?, username=?, password=?, category=?, notes=?, updated_at=CURRENT_TIMESTAMP WHERE id=?'
  ).run(label, username || '', encrypt(password, sessionKey), category || 'General', notes || '', id);
  return { ok: true };
});

ipcMain.handle('delete-entry', (_, id) => {
  if (!sessionKey) return { ok: false, error: 'Locked' };
  db.prepare('DELETE FROM passwords WHERE id = ?').run(id);
  return { ok: true };
});

ipcMain.handle('generate-password', (_, { length = 20, symbols = true }) => {
  const chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  const sym   = '!@#$%^&*()-_=+[]{}';
  const pool  = symbols ? chars + sym : chars;
  const bytes = crypto.randomBytes(length);
  return Array.from(bytes).map(b => pool[b % pool.length]).join('');
});

// ── IPC: Migration ───────────────────────────────────────────────
//
// .crypthub binary format:
//   [4  bytes] magic         "CRHB"
//   [4  bytes] version       uint32 BE = 1
//   [32 bytes] exportSalt    random — used to derive exportKey
//   [64 bytes] masterSalt    vault's master salt as UTF-8 hex string (64 chars, null-padded)
//   [12 bytes] IV            AES-GCM nonce
//   [16 bytes] GCM auth tag
//   [N  bytes] ciphertext    AES-256-GCM encrypted JSON payload
//
// JSON payload: { exportedAt, masterHash, masterSalt, entries[] }
//
// Key derivation (import):
//   masterHash = scrypt(userPassword, masterSalt_from_header, 64).hex
//   exportKey  = scrypt(masterHash, exportSalt, 32)
//   → decrypt → verify payload.masterHash === derived masterHash

const MAGIC    = Buffer.from('CRHB');
const VER      = 1;
const HDR_SIZE = 4 + 4 + 32 + 64 + 12 + 16; // 132 bytes

// EXPORT
ipcMain.handle('export-vault', async () => {
  if (!sessionKey) return { ok: false, error: 'Locked' };

  const { canceled, filePath } = await dialog.showSaveDialog({
    title: 'Export CryptHub Vault',
    defaultPath: `crypthub-backup-${new Date().toISOString().slice(0, 10)}.crypthub`,
    filters: [{ name: 'CryptHub Backup', extensions: ['crypthub'] }]
  });
  if (canceled || !filePath) return { ok: false, error: 'Cancelled' };

  const master  = db.prepare('SELECT hash, salt FROM master WHERE id=1').get();
  const rows    = db.prepare('SELECT * FROM passwords ORDER BY id').all();
  const entries = rows.map(r => ({
    label:      r.label,
    username:   r.username   || '',
    password:   decrypt(r.password, sessionKey),
    category:   r.category   || 'General',
    notes:      r.notes      || '',
    created_at: r.created_at,
    updated_at: r.updated_at
  }));

  const payload    = JSON.stringify({ exportedAt: new Date().toISOString(), masterHash: master.hash, masterSalt: master.salt, entries });
  const exportSalt = crypto.randomBytes(32);
  const exportKey  = crypto.scryptSync(master.hash, exportSalt, 32);
  const iv         = crypto.randomBytes(12);
  const cipher     = crypto.createCipheriv(ALGO, exportKey, iv);
  const ciphertext = Buffer.concat([cipher.update(payload, 'utf8'), cipher.final()]);
  const tag        = cipher.getAuthTag();

  const masterSaltField = Buffer.alloc(64, 0);
  masterSaltField.write(master.salt, 'utf8');

  const verBuf = Buffer.allocUnsafe(4);
  verBuf.writeUInt32BE(VER);

  const bundle = Buffer.concat([MAGIC, verBuf, exportSalt, masterSaltField, iv, tag, ciphertext]);
  fs.writeFileSync(filePath, bundle);

  return { ok: true, path: filePath, count: entries.length };
});

// IMPORT STEP 1 — open file, validate, send bundle to renderer for password entry
ipcMain.handle('import-vault', async () => {
  const { canceled, filePaths } = await dialog.showOpenDialog({
    title: 'Import CryptHub Vault',
    filters: [{ name: 'CryptHub Backup', extensions: ['crypthub'] }],
    properties: ['openFile']
  });
  if (canceled || !filePaths.length) return { ok: false, error: 'Cancelled' };

  let bundle;
  try { bundle = fs.readFileSync(filePaths[0]); }
  catch (e) { return { ok: false, error: 'Cannot read file.' }; }

  if (bundle.length < HDR_SIZE + 1)
    return { ok: false, error: 'File is too small or corrupt.' };
  if (bundle.slice(0, 4).toString('ascii') !== 'CRHB')
    return { ok: false, error: 'Not a valid CryptHub backup file.' };

  return {
    ok: true,
    needsPassword: true,
    bundle: bundle.toString('base64')
  };
});

// IMPORT STEP 2 — verify password, wipe, restore
ipcMain.handle('verify-and-restore', async (_, { bundleB64, masterPassword }) => {
  const bundle        = Buffer.from(bundleB64, 'base64');
  const exportSalt    = bundle.slice(8,  40);
  const masterSaltRaw = bundle.slice(40, 104).toString('utf8').replace(/\0/g, '');
  const iv            = bundle.slice(104, 116);
  const tag           = bundle.slice(116, 132);
  const ciphertext    = bundle.slice(132);

  let payload;
  try {
    const masterHash = crypto.scryptSync(masterPassword, masterSaltRaw, 64).toString('hex');
    const exportKey  = crypto.scryptSync(masterHash, exportSalt, 32);
    const decipher   = crypto.createDecipheriv(ALGO, exportKey, iv);
    decipher.setAuthTag(tag);
    const raw = Buffer.concat([decipher.update(ciphertext), decipher.final()]);
    payload = JSON.parse(raw.toString('utf8'));
  } catch (e) {
    return { ok: false, error: 'Wrong master password or corrupted file.' };
  }

  // Signature verification
  const verifyHash = crypto.scryptSync(masterPassword, payload.masterSalt, 64).toString('hex');
  if (verifyHash !== payload.masterHash)
    return { ok: false, error: 'Vault signature mismatch. File may be tampered with.' };

  // WIPE
  db.exec('DELETE FROM passwords; DELETE FROM master;');
  sessionKey = null;

  // RESTORE master
  db.prepare('INSERT INTO master (id, hash, salt) VALUES (1, ?, ?)').run(payload.masterHash, payload.masterSalt);
  sessionKey = deriveKey(masterPassword, payload.masterSalt);

  // RESTORE entries
  const ins = db.prepare(
    'INSERT INTO passwords (label,username,password,category,notes,created_at,updated_at) VALUES (?,?,?,?,?,?,?)'
  );
  db.transaction(entries => {
    for (const e of entries)
      ins.run(e.label, e.username, encrypt(e.password, sessionKey), e.category, e.notes, e.created_at, e.updated_at);
  })(payload.entries);

  return { ok: true, count: payload.entries.length, exportedAt: payload.exportedAt };
});

// ── Window ───────────────────────────────────────────────────────
function createWindow() {
  initDB();
  const win = new BrowserWindow({
    width: 1100,
    height: 720,
    minWidth: 800,
    minHeight: 600,
    titleBarStyle: 'hiddenInset',
    backgroundColor: '#0d0d0f',
    webPreferences: {
      nodeIntegration: false,
      contextIsolation: true,
      preload: path.join(__dirname, 'preload.js')
    }
  });
   win.loadFile(path.join(__dirname, 'index.html'))
}

app.whenReady().then(createWindow);
app.on('window-all-closed', () => { if (process.platform !== 'darwin') app.quit(); });
app.on('activate', () => { if (BrowserWindow.getAllWindows().length === 0) createWindow(); });