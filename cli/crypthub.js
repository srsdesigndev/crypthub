#!/usr/bin/env node
'use strict';

// ═══════════════════════════════════════════════════════════
//  CryptHub CLI v2.0.0
//  Compatible with .crypthub files from the web app.
//
//  File format (68-byte header):
//  [0-3]   CRHB magic bytes
//  [4-7]   version (uint32 big-endian)
//  [8-39]  salt   (32 bytes)
//  [40-51] iv     (12 bytes)
//  [52-67] tag    (16 bytes GCM auth tag)
//  [68+]   ciphertext
//
//  Key derivation: PBKDF2-SHA256, 310,000 iterations
//  Encryption:     AES-256-GCM
// ═══════════════════════════════════════════════════════════

const crypto   = require('crypto');
const fs       = require('fs');
const path     = require('path');
const os       = require('os');
const readline = require('readline');

// ── config ───────────────────────────────────────────────────
const CONFIG_DIR  = path.join(os.homedir(), '.crypthub');
const CONFIG_FILE = path.join(CONFIG_DIR, 'config.json');

// ── colours ──────────────────────────────────────────────────
const c = {
  reset:     '\x1b[0m',
  bold:      '\x1b[1m',
  dim:       '\x1b[2m',
  green:     '\x1b[32m',
  red:       '\x1b[31m',
  yellow:    '\x1b[33m',
  clear:     '\x1b[2J\x1b[H',
  eraseLine: '\x1b[2K\x1b[G',
};

const W    = () => Math.min(process.stdout.columns || 60, 60);
const line = (ch = '─') => c.dim + ch.repeat(W()) + c.reset;

const ok   = msg => console.log(`${c.green}✓${c.reset} ${msg}`);
const fail = msg => console.log(`${c.red}✗${c.reset} ${msg}`);
const warn = msg => console.log(`${c.yellow}!${c.reset} ${msg}`);
const info = msg => console.log(`${c.dim}${msg}${c.reset}`);
const bold = msg => console.log(`${c.bold}${msg}${c.reset}`);

// ── spinner ───────────────────────────────────────────────────
function spinner(msg) {
  const frames = ['⠋','⠙','⠹','⠸','⠼','⠴','⠦','⠧','⠇','⠏'];
  let i = 0;
  const iv = setInterval(() => {
    process.stdout.write(`\r${c.dim}${frames[i++ % frames.length]}${c.reset} ${msg}`);
  }, 80);
  return {
    stop: (doneMsg = '') => {
      clearInterval(iv);
      process.stdout.write(`\r${c.eraseLine}`);
      if (doneMsg) ok(doneMsg);
    }
  };
}

// ── temp message — shows then clears ─────────────────────────
function tempMsg(msg, ms = 1500) {
  return new Promise(resolve => {
    process.stdout.write(`${c.green}✓${c.reset} ${msg}`);
    setTimeout(() => {
      process.stdout.write(`\r${c.eraseLine}`);
      resolve();
    }, ms);
  });
}

const sleep = ms => new Promise(r => setTimeout(r, ms));

// ── config helpers ────────────────────────────────────────────
function loadConfig() {
  if (!fs.existsSync(CONFIG_FILE)) return {};
  try { return JSON.parse(fs.readFileSync(CONFIG_FILE, 'utf8')); }
  catch { return {}; }
}

function saveConfig(data) {
  if (!fs.existsSync(CONFIG_DIR)) fs.mkdirSync(CONFIG_DIR, { recursive: true });
  fs.writeFileSync(CONFIG_FILE, JSON.stringify(data, null, 2));
}

// ── crypto ────────────────────────────────────────────────────
const MAGIC      = Buffer.from([0x43, 0x52, 0x48, 0x42]);
const ITERATIONS = 310000;
const HEADER_LEN = 68;

function deriveKey(password, salt) {
  return crypto.pbkdf2Sync(password, salt, ITERATIONS, 32, 'sha256');
}

function encryptVault(plainObj, password) {
  const salt   = crypto.randomBytes(32);
  const iv     = crypto.randomBytes(12);
  const key    = deriveKey(password, salt);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt     = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const ct     = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag    = cipher.getAuthTag();
  const ver    = Buffer.alloc(4);
  ver.writeUInt32BE(1, 0);
  return { bytes: Buffer.concat([MAGIC, ver, salt, iv, tag, ct]), key, salt };
}

function decryptVault(fileBytes, password) {
  if (fileBytes.length < HEADER_LEN + 1)
    throw new Error(`File too small (${fileBytes.length} bytes).`);
  if (!fileBytes.slice(0, 4).equals(MAGIC))
    throw new Error('Not a valid .crypthub file.');
  const salt = fileBytes.slice(8,  40);
  const iv   = fileBytes.slice(40, 52);
  const tag  = fileBytes.slice(52, 68);
  const ct   = fileBytes.slice(68);
  const key  = deriveKey(password, salt);
  try {
    const d  = crypto.createDecipheriv('aes-256-gcm', key, iv);
    d.setAuthTag(tag);
    const pt = Buffer.concat([d.update(ct), d.final()]);
    return { data: JSON.parse(pt.toString('utf8')), key, salt };
  } catch {
    throw new Error('Wrong master password or corrupted file.');
  }
}

function reEncryptVault(plainObj, key, salt) {
  const iv     = crypto.randomBytes(12);
  const cipher = crypto.createCipheriv('aes-256-gcm', key, iv);
  const pt     = Buffer.from(JSON.stringify(plainObj), 'utf8');
  const ct     = Buffer.concat([cipher.update(pt), cipher.final()]);
  const tag    = cipher.getAuthTag();
  const ver    = Buffer.alloc(4);
  ver.writeUInt32BE(1, 0);
  return Buffer.concat([MAGIC, ver, Buffer.from(salt), iv, tag, ct]);
}

// ── session (in-memory only) ──────────────────────────────────
let SESSION = null;

function requireSession() {
  if (!SESSION) { fail('No vault open. Run: crypthub open'); process.exit(1); }
}

function persist() {
  if (!SESSION) return;
  const sp = spinner('Saving…');
  try {
    const bytes = reEncryptVault(SESSION.data, SESSION.key, SESSION.salt);
    fs.writeFileSync(SESSION.vaultPath, bytes);
    sp.stop();
  } catch (e) {
    sp.stop();
    fail('Save failed: ' + e.message);
  }
}

// ── prompt helpers ────────────────────────────────────────────
function prompt(question) {
  const rl = readline.createInterface({ input: process.stdin, output: process.stdout });
  return new Promise(resolve => {
    rl.question(question, ans => { rl.close(); resolve(ans.trim()); });
  });
}

function promptPassword(question) {
  return new Promise(resolve => {
    process.stdout.write(question);
    let pwd = '';

    const onData = ch => {
      if (ch === '\n' || ch === '\r') {
        if (process.stdin.isTTY) process.stdin.setRawMode(false);
        process.stdin.pause();
        process.stdin.removeListener('data', onData);
        process.stdout.write('\n');
        resolve(pwd);
        return;
      }
      if (ch === '\u0003') process.exit(0);
      if (ch === '\u007f') {
        if (pwd.length > 0) {
          pwd = pwd.slice(0, -1);
          process.stdout.write('\b \b');
        }
        return;
      }
      pwd += ch;
      process.stdout.write('*');
    };

    if (process.stdin.isTTY) process.stdin.setRawMode(true);
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.on('data', onData);
  });
}

// ── banner ────────────────────────────────────────────────────
async function showBanner() {
  process.stdout.write(c.clear);
  const rows = [
    `${c.green}  ██████╗██████╗ ██╗   ██╗██████╗ ████████╗${c.reset}`,
    `${c.green} ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝${c.reset}`,
    `${c.green} ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║   ${c.reset}`,
    `${c.green} ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║   ${c.reset}`,
    `${c.green} ╚██████╗██║  ██║   ██║   ██║        ██║   ${c.reset}`,
    `${c.green}  ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝   ${c.reset}`,
  ];
  for (const r of rows) { console.log(r); await sleep(55); }
  console.log();
  info('  local-first · AES-256-GCM · v2.0.0');
  console.log();
  await sleep(180);
}

// ── commands ──────────────────────────────────────────────────

async function cmdInit() {
  await showBanner();
  bold('  Initialize Vault');
  console.log(line());

  const config = loadConfig();

  // single vault policy
  if (config.vaultPath && fs.existsSync(config.vaultPath)) {
    console.log();
    warn(`A vault already exists: ${config.vaultPath}`);
    info('  CryptHub works best with a single vault.');
    info('  Multiple vaults create management overhead.');
    console.log();
    const ans = await prompt('  Create a second vault anyway? (y/N): ');
    if (ans.toLowerCase() !== 'y') {
      console.log();
      info('  Run: crypthub open');
      console.log();
      process.exit(0);
    }
  }

  console.log();
  const defaultPath = path.join(os.homedir(), 'my-vault.crypthub');
  const input       = await prompt(`  Vault path [${defaultPath}]: `);
  const vaultPath   = path.resolve(input || defaultPath);

  if (fs.existsSync(vaultPath)) {
    console.log();
    warn(`File already exists: ${vaultPath}`);
    const use = await prompt('  Use this existing vault? (y/N): ');
    if (use.toLowerCase() !== 'y') process.exit(0);
    saveConfig({ vaultPath });
    console.log();
    ok(`Config updated → ${vaultPath}`);
    info('  Run: crypthub open');
    console.log();
    process.exit(0);
  }

  console.log();
  const pwd  = await promptPassword('  Master password : ');
  const pwd2 = await promptPassword('  Confirm         : ');
  console.log();

  if (pwd.length < 6) { fail('Minimum 6 characters.'); process.exit(1); }
  if (pwd !== pwd2)   { fail('Passwords do not match.'); process.exit(1); }

  const sp = spinner('Creating vault…');
  await sleep(100);
  const { bytes } = encryptVault({ v: 1, entries: [], nextId: 1 }, pwd);
  fs.writeFileSync(vaultPath, bytes);
  saveConfig({ vaultPath });
  sp.stop();

  console.log();
  ok(`Vault created → ${vaultPath}`);
  ok(`Config saved  → ${CONFIG_FILE}`);
  console.log();
  info('  Run: crypthub open');
  console.log();
}

async function cmdOpen() {
  await showBanner();

  const config = loadConfig();
  if (!config.vaultPath) {
    fail('No vault configured. Run: crypthub init');
    process.exit(1);
  }

  const vaultPath = config.vaultPath;
  if (!fs.existsSync(vaultPath)) {
    fail(`Vault not found: ${vaultPath}`);
    process.exit(1);
  }

  const size = fs.statSync(vaultPath).size;
  info(`  vault : ${vaultPath}`);
  info(`  size  : ${size} bytes`);
  console.log();
  console.log(line());
  console.log();

  const pwd = await promptPassword('  Master password : ');
  console.log();

  const sp = spinner('Unlocking…');
  await sleep(80);

  let result;
  try {
    const bytes = fs.readFileSync(vaultPath);
    result = decryptVault(bytes, pwd);
    sp.stop();
  } catch (e) {
    sp.stop();
    fail(e.message);
    process.exit(1);
  }

  SESSION = { vaultPath, key: result.key, salt: result.salt, data: result.data };

  const count = SESSION.data.entries?.length ?? 0;
  ok(`Unlocked — ${count} entr${count === 1 ? 'y' : 'ies'}`);
  console.log();
  info('  "help" — commands · "dashboard" — overview · "cls" — clear screen');
  console.log();

  await interactiveShell();
}

async function cmdDashboard() {
  requireSession();
  const entries = SESSION.data.entries || [];
  const cats    = {};
  entries.forEach(e => { const k = e.category || 'General'; cats[k] = (cats[k] || 0) + 1; });
  const size   = fs.statSync(SESSION.vaultPath).size;
  const recent = [...entries]
    .sort((a, b) => new Date(b.updated_at || 0) - new Date(a.updated_at || 0))
    .slice(0, 5);

  process.stdout.write(c.clear);
  console.log(line('═'));
  console.log(`${c.bold}  CRYPTHUB DASHBOARD${c.reset}`);
  console.log(line('═'));
  console.log();

  // vault
  info('  VAULT');
  console.log(line());
  console.log(`  path      ${c.dim}${SESSION.vaultPath}${c.reset}`);
  console.log(`  size      ${c.dim}${size} bytes${c.reset}`);
  console.log(`  entries   ${c.green}${c.bold}${entries.length}${c.reset}`);
  console.log();

  // categories
  info('  CATEGORIES');
  console.log(line());
  if (!Object.keys(cats).length) {
    info('  no entries yet.');
  } else {
    const max = Math.max(...Object.values(cats));
    Object.entries(cats)
      .sort((a, b) => b[1] - a[1])
      .forEach(([cat, n]) => {
        const filled = Math.round((n / max) * 12);
        const bar    = c.green + '█'.repeat(filled) + c.reset +
                       c.dim   + '░'.repeat(12 - filled) + c.reset;
        console.log(`  ${cat.padEnd(18)} ${bar}  ${c.dim}${n}${c.reset}`);
      });
  }
  console.log();

  // recent
  info('  RECENT');
  console.log(line());
  if (!recent.length) {
    info('  no entries yet.');
  } else {
    recent.forEach(e => {
      const date = e.updated_at ? new Date(e.updated_at).toLocaleDateString() : '—';
      console.log(
        `  ${c.bold}${e.label.padEnd(22)}${c.reset}` +
        `${c.dim}${(e.username || '—').padEnd(22)}${c.reset}` +
        `${c.dim}${date}${c.reset}`
      );
    });
  }

  console.log();
  console.log(line('═'));
  info('  press Enter to return');
  console.log();
  await prompt('');
}

// ── interactive shell ─────────────────────────────────────────
async function interactiveShell() {
  const rl = readline.createInterface({
    input: process.stdin, output: process.stdout, terminal: true
  });

  const ask = () => new Promise((resolve, reject) => {
    rl.question(`${c.green}crypthub${c.reset} ${c.dim}›${c.reset} `, resolve);
    rl.once('close', reject);
  });

  while (true) {
    let input;
    try { input = await ask(); }
    catch { break; }

    const parts   = input.trim().split(/\s+/);
    const command = parts[0]?.toLowerCase();
    const arg     = parts.slice(1).join(' ');
    if (!command) continue;

    switch (command) {
      case 'list': case 'ls':
        shellList(arg); break;
      case 'get':
        shellGet(arg); break;
      case 'show':
        shellShow(arg); break;
      case 'add':
        rl.close(); await shellAdd(); return interactiveShell();
      case 'edit':
        rl.close(); await shellEdit(arg); return interactiveShell();
      case 'delete': case 'del': case 'rm':
        shellDelete(arg); break;
      case 'search': case 'find':
        shellSearch(arg); break;
      case 'info':
        shellInfo(); break;
      case 'dashboard': case 'dash':
        rl.close(); await cmdDashboard(); return interactiveShell();
      case 'cls': case 'clear':
        process.stdout.write(c.clear);
        info('  "help" for commands');
        console.log(); break;
      case 'help': case '?':
        shellHelp(); break;
      case 'lock': case 'exit': case 'quit': case 'q':
        SESSION = null; rl.close();
        console.log(); ok('Vault locked. Session cleared.'); console.log();
        process.exit(0);
      default:
        fail(`Unknown command: "${command}". Type "help".`);
    }
  }
  rl.close();
}

// ── shell functions ───────────────────────────────────────────

function shellList(filter) {
  requireSession();
  let entries = SESSION.data.entries || [];
  if (filter) entries = entries.filter(e =>
    e.category?.toLowerCase() === filter.toLowerCase()
  );
  console.log();
  if (!entries.length) {
    info(filter ? `  no entries in: ${filter}` : '  no entries. type "add" to create one.');
    console.log(); return;
  }
  console.log(line());
  console.log(`${c.dim}  ${'ID'.padEnd(5)}${'LABEL'.padEnd(24)}${'USERNAME'.padEnd(24)}CATEGORY${c.reset}`);
  console.log(line());
  entries.forEach(e => {
    console.log(
      `  ${c.dim}${String(e.id).padEnd(5)}${c.reset}` +
      `${c.bold}${e.label.padEnd(24)}${c.reset}` +
      `${c.dim}${(e.username || '—').padEnd(24)}${c.reset}` +
      `${c.dim}[${e.category || 'general'}]${c.reset}`
    );
  });
  console.log(line());
  info(`  ${entries.length} entr${entries.length === 1 ? 'y' : 'ies'}`);
  console.log();
}

function shellGet(label) {
  requireSession();
  if (!label) { fail('Usage: get <label>'); return; }
  const entry = findEntry(label);
  if (!entry) { fail(`No entry found: "${label}"`); return; }
  console.log();
  console.log(line());
  console.log(`  ${c.bold}${entry.label}${c.reset}  ${c.dim}[${entry.category || 'general'}]${c.reset}`);
  if (entry.username) console.log(`  username : ${c.dim}${entry.username}${c.reset}`);
  if (entry.notes)    console.log(`  notes    : ${c.dim}${entry.notes}${c.reset}`);
  console.log(line());
  try {
    const cmd = process.platform === 'darwin' ? 'pbcopy'
              : process.platform === 'win32'  ? 'clip'
              : 'xclip -selection clipboard';
    require('child_process').execSync(cmd, { input: entry.password });
    console.log(); ok('Password copied to clipboard.');
  } catch {
    console.log(); warn('Clipboard unavailable. Install xclip on Linux.');
    console.log(`  password : ${c.green}${entry.password}${c.reset}`);
  }
  console.log();
}

function shellShow(label) {
  requireSession();
  if (!label) { fail('Usage: show <label>'); return; }
  const entry = findEntry(label);
  if (!entry) { fail(`No entry found: "${label}"`); return; }
  console.log();
  console.log(line());
  console.log(`  ${c.bold}${entry.label}${c.reset}  ${c.dim}[${entry.category || 'general'}]${c.reset}`);
  if (entry.username) console.log(`  username : ${entry.username}`);
  console.log(`  password : ${c.green}${entry.password}${c.reset}`);
  if (entry.notes)    console.log(`  notes    : ${c.dim}${entry.notes}${c.reset}`);
  console.log(`  id       : ${c.dim}${entry.id}${c.reset}`);
  console.log(line());
  console.log();
}

async function shellAdd() {
  requireSession();
  console.log();
  bold('  New Entry');
  console.log(line());
  console.log();

  const label = await prompt('  Label *        : ');
  if (!label) { fail('Label is required.'); return; }

  const username = await prompt('  Username/Email : ');
  const password = await promptPassword('  Password *     : ');
  if (!password) { fail('Password is required.'); return; }

  console.log();
  info('  Categories: General, Social, Work, Finance, Entertainment, Dev/Tech, Shopping, Other');
  const category = await prompt('  Category       : ') || 'General';
  const notes    = await prompt('  Notes          : ');

  SESSION.data.entries.push({
    id:         SESSION.data.nextId++,
    label, username, password, category, notes,
    created_at: new Date().toISOString(),
    updated_at: new Date().toISOString()
  });

  persist();
  console.log();
  await tempMsg(`Entry saved: ${c.bold}${label}${c.reset}`, 1500);
  console.log();
}

async function shellEdit(label) {
  requireSession();
  if (!label) { fail('Usage: edit <label>'); return; }
  const entry = findEntry(label);
  if (!entry) { fail(`No entry found: "${label}"`); return; }

  console.log();
  bold(`  Edit — ${entry.label}`);
  console.log(line());
  info('  Press Enter to keep current value.');
  console.log();

  const newLabel    = await prompt(`  Label     [${entry.label}]: `)             || entry.label;
  const newUsername = await prompt(`  Username  [${entry.username || ''}]: `)    || entry.username || '';
  const newPassword = await promptPassword(`  Password  [keep current]: `);
  console.log();
  const newCategory = await prompt(`  Category  [${entry.category || 'General'}]: `) || entry.category || 'General';
  const newNotes    = await prompt(`  Notes     [${entry.notes || ''}]: `)       || entry.notes || '';

  entry.label      = newLabel;
  entry.username   = newUsername;
  entry.password   = newPassword || entry.password;
  entry.category   = newCategory;
  entry.notes      = newNotes;
  entry.updated_at = new Date().toISOString();

  persist();
  console.log();
  await tempMsg(`Entry updated: ${c.bold}${entry.label}${c.reset}`, 1500);
  console.log();
}

function shellDelete(label) {
  requireSession();
  if (!label) { fail('Usage: delete <label>'); return; }
  const entry = findEntry(label);
  if (!entry) { fail(`No entry found: "${label}"`); return; }
  SESSION.data.entries = SESSION.data.entries.filter(e => e.id !== entry.id);
  persist();
  console.log(); ok(`Deleted: ${entry.label}`); console.log();
}

function shellSearch(query) {
  requireSession();
  if (!query) { fail('Usage: search <query>'); return; }
  const q       = query.toLowerCase();
  const results = (SESSION.data.entries || []).filter(e =>
    e.label.toLowerCase().includes(q) ||
    (e.username || '').toLowerCase().includes(q) ||
    (e.notes    || '').toLowerCase().includes(q)
  );
  console.log();
  if (!results.length) { info(`  no results for: "${query}"`); console.log(); return; }
  console.log(line());
  results.forEach(e => {
    console.log(
      `  ${c.bold}${e.label.padEnd(24)}${c.reset}` +
      `${c.dim}${(e.username || '—').padEnd(24)}${c.reset}` +
      `${c.dim}[${e.category || 'general'}]${c.reset}`
    );
  });
  console.log(line());
  info(`  ${results.length} result${results.length === 1 ? '' : 's'}`);
  console.log();
}

function shellInfo() {
  requireSession();
  const entries = SESSION.data.entries || [];
  const size    = fs.statSync(SESSION.vaultPath).size;
  const cats    = [...new Set(entries.map(e => e.category || 'General'))];
  console.log();
  console.log(line());
  console.log(`  ${c.bold}Vault Info${c.reset}`);
  console.log(line());
  console.log(`  path       ${c.dim}${SESSION.vaultPath}${c.reset}`);
  console.log(`  entries    ${c.green}${entries.length}${c.reset}`);
  console.log(`  categories ${c.dim}${cats.join(', ') || 'none'}${c.reset}`);
  console.log(`  file size  ${c.dim}${size} bytes${c.reset}`);
  console.log(line());
  console.log();
}

function shellHelp() {
  console.log();
  console.log(line());
  console.log(`  ${c.bold}Commands${c.reset}`);
  console.log(line());
  console.log(`  ${c.green}list${c.reset} [category]    list all entries`);
  console.log(`  ${c.green}get${c.reset}  <label>       copy password to clipboard`);
  console.log(`  ${c.green}show${c.reset} <label>       reveal full entry`);
  console.log(`  ${c.green}add${c.reset}                add a new entry`);
  console.log(`  ${c.green}edit${c.reset} <label>       edit an entry`);
  console.log(`  ${c.green}delete${c.reset} <label>     delete an entry`);
  console.log(`  ${c.green}search${c.reset} <query>     search entries`);
  console.log(`  ${c.green}dashboard${c.reset}          vault overview`);
  console.log(`  ${c.green}info${c.reset}               vault stats`);
  console.log(`  ${c.green}cls${c.reset}                clear screen`);
  console.log(`  ${c.green}lock${c.reset}               lock vault and exit`);
  console.log(`  ${c.green}help${c.reset}               show this`);
  console.log(line());
  console.log();
}

function findEntry(label) {
  const entries = SESSION.data.entries || [];
  return (
    entries.find(x => x.label.toLowerCase() === label.toLowerCase()) ||
    entries.find(x => x.label.toLowerCase().includes(label.toLowerCase())) ||
    (/^\d+$/.test(label) ? entries.find(x => x.id === parseInt(label)) : null) ||
    null
  );
}

function cmdHelp() {
  console.log();
  console.log(line());
  console.log(`  ${c.bold}CryptHub CLI${c.reset}  v2.0.0`);
  console.log(line());
  console.log(`  ${c.green}crypthub init${c.reset}              create a new vault`);
  console.log(`  ${c.green}crypthub open${c.reset}              unlock and enter session`);
  console.log(`  ${c.green}crypthub use${c.reset} <path>        point CLI at a vault file`);
  console.log(`  ${c.green}crypthub status${c.reset}            show current vault config`);
  console.log(`  ${c.green}crypthub locate${c.reset}            find all .crypthub files on system`);
  console.log(`  ${c.green}crypthub version${c.reset}           show version`);
  console.log(`  ${c.green}crypthub help${c.reset}              show this`);
  console.log(line());
  console.log();
}

// crypthub use <path>
function cmdUse(vaultPath) {
  if (!vaultPath) {
    fail('Usage: crypthub use <path-to-vault.crypthub>');
    console.log();
    info('  Example: crypthub use ~/Downloads/my-vault.crypthub');
    info('  Example: crypthub use .   ← uses first .crypthub in current directory');
    console.log();
    process.exit(1);
  }

  // shorthand: "." means look in current directory
  let resolved;
  if (vaultPath === '.') {
    const files = fs.readdirSync(process.cwd()).filter(f => f.endsWith('.crypthub'));
    if (!files.length) {
      fail('No .crypthub files found in current directory.');
      process.exit(1);
    }
    if (files.length > 1) {
      warn('Multiple .crypthub files found:');
      files.forEach((f, i) => info(`  [${i + 1}] ${path.join(process.cwd(), f)}`));
      console.log();
      fail('Be specific. Run: crypthub use <filename>');
      process.exit(1);
    }
    resolved = path.resolve(process.cwd(), files[0]);
  } else {
    resolved = path.resolve(vaultPath.replace(/^~/, os.homedir()));
  }

  if (!fs.existsSync(resolved)) {
    fail(`File not found: ${resolved}`);
    process.exit(1);
  }

  // validate it's actually a .crypthub file
  try {
    const bytes = fs.readFileSync(resolved);
    if (bytes.length < 68 ||
        bytes[0] !== 0x43 || bytes[1] !== 0x52 ||
        bytes[2] !== 0x48 || bytes[3] !== 0x42) {
      fail(`Not a valid .crypthub file: ${resolved}`);
      process.exit(1);
    }
  } catch (e) {
    fail(`Cannot read file: ${e.message}`);
    process.exit(1);
  }

  const size = fs.statSync(resolved).size;
  saveConfig({ vaultPath: resolved });

  console.log();
  ok(`Vault set   → ${resolved}`);
  info(`  size      : ${size} bytes`);
  info(`  config    : ${CONFIG_FILE}`);
  console.log();
  info('  Run: crypthub open');
  console.log();
}

// crypthub status
function cmdStatus() {
  const config = loadConfig();
  console.log();
  console.log(line());
  console.log(`  ${c.bold}CryptHub Status${c.reset}`);
  console.log(line());

  if (!config.vaultPath) {
    warn('No vault configured.');
    info('  Run: crypthub init   — to create a new vault');
    info('  Run: crypthub use <path>   — to point at an existing vault');
    console.log();
    return;
  }

  const exists = fs.existsSync(config.vaultPath);
  console.log(`  vault    : ${c.dim}${config.vaultPath}${c.reset}`);
  console.log(`  exists   : ${exists ? c.green + 'yes' : c.red + 'no'}${c.reset}`);

  if (exists) {
    const size = fs.statSync(config.vaultPath).size;
    // peek at magic bytes to validate
    let valid = false;
    try {
      const bytes = fs.readFileSync(config.vaultPath);
      valid = bytes.length >= 68 &&
              bytes[0] === 0x43 && bytes[1] === 0x52 &&
              bytes[2] === 0x48 && bytes[3] === 0x42;
    } catch {}
    console.log(`  size     : ${c.dim}${size} bytes${c.reset}`);
    console.log(`  valid    : ${valid ? c.green + 'yes' : c.red + 'no — not a .crypthub file'}${c.reset}`);
  }

  console.log(`  config   : ${c.dim}${CONFIG_FILE}${c.reset}`);
  console.log(line());
  console.log();
}

// crypthub locate
function cmdLocate() {
  console.log();
  info('  Searching for .crypthub files…');
  console.log();

  const found = [];
  const searchDirs = [
    os.homedir(),
    path.join(os.homedir(), 'Downloads'),
    path.join(os.homedir(), 'Desktop'),
    path.join(os.homedir(), 'Documents'),
    process.cwd(),
  ];

  function scanDir(dir, depth = 0) {
    if (depth > 3) return;
    try {
      const entries = fs.readdirSync(dir, { withFileTypes: true });
      for (const entry of entries) {
        if (entry.name.startsWith('.') && depth > 0) continue;
        if (entry.name === 'node_modules') continue;
        const full = path.join(dir, entry.name);
        if (entry.isFile() && entry.name.endsWith('.crypthub')) {
          found.push(full);
        } else if (entry.isDirectory() && depth < 3) {
          try { scanDir(full, depth + 1); } catch {}
        }
      }
    } catch {}
  }

  searchDirs.forEach(d => { if (fs.existsSync(d)) scanDir(d); });

  // deduplicate
  const unique = [...new Set(found)];

  if (!unique.length) {
    warn('No .crypthub files found in common locations.');
    info('  Searched: home, Downloads, Desktop, Documents, current directory');
    console.log();
    info('  To search the full system (slower):');
    info('  find / -name "*.crypthub" 2>/dev/null');
    console.log();
    return;
  }

  const config = loadConfig();
  console.log(line());
  console.log(`  ${c.dim}${'FILE'.padEnd(50)}SIZE${c.reset}`);
  console.log(line());
  unique.forEach(f => {
    const size    = fs.statSync(f).size;
    const active  = config.vaultPath === f ? ` ${c.green}← active${c.reset}` : '';
    console.log(`  ${f.padEnd(50)} ${c.dim}${size}b${c.reset}${active}`);
  });
  console.log(line());
  console.log();
  info(`  Found ${unique.length} vault${unique.length === 1 ? '' : 's'}.`);
  info('  To use one: crypthub use <path>');
  console.log();
}

// ── entry point ───────────────────────────────────────────────
const [,, command, ...args] = process.argv;

(async () => {
  switch (command) {
    case 'init':    await cmdInit(); break;
    case 'open':    await cmdOpen(); break;
    case 'use':     cmdUse(args.join(' ')); break;
    case 'status':  cmdStatus(); break;
    case 'locate':  cmdLocate(); break;
    case 'version': case '-v': case '--version':
      console.log('crypthub-cli 2.0.0'); break;
    default: cmdHelp();
  }
})();