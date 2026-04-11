[test](../assets/cli/web-landing.png)

# CryptHub

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Version](https://img.shields.io/badge/version-1.2.0-blue?style=flat-square)
![Encryption](https://img.shields.io/badge/encryption-AES--256--GCM-blueviolet?style=flat-square)
![Node](https://img.shields.io/badge/node-18+-brightgreen?style=flat-square)
![Browser](https://img.shields.io/badge/browser-Chrome%20%7C%20Edge-orange?style=flat-square)
![No Cloud](https://img.shields.io/badge/cloud-none-lightgrey?style=flat-square)
![Zero Dependencies](https://img.shields.io/badge/dependencies-zero-success?style=flat-square)

A local-first password manager that runs in your browser and terminal.  
Your vault is stored as an encrypted `.crypthub` file on your filesystem — not in the browser, not on any server.

**Web app:** [crypthub.srsdevdesign.com](https://crypthub.srsdevdesign.com)

---

## How it works

1. Open CryptHub in Chrome or Edge — or unlock from the terminal with `crypthub open`
2. Create a new vault or open an existing `.crypthub` file from your device
3. Enter your master password — it derives a 256-bit AES-GCM key via PBKDF2
4. Your vault decrypts into memory. Every change re-encrypts and writes back to the file immediately
5. Lock at any time — the session key is cleared from memory, the file on disk stays encrypted

---

## Security

| Property | Detail |
|---|---|
| Encryption | AES-256-GCM |
| Key derivation | PBKDF2, 310,000 iterations, SHA-256 |
| Salt | 32 bytes, random, stored in file header |
| IV | 12 bytes, fresh random value on every write |
| Auth tag | 16-byte GCM tag — detects any file tampering |
| Session key | In-memory only, never written to disk |
| Master password | Never stored — used only to derive the key |
| Crypto implementation | Web Crypto API (browser) · Node.js crypto (CLI) — no libraries |
| External audit | None — source is open for review |

**File format** (68-byte header):

```
[0-3]   CRHB  — magic bytes
[4-7]   0x01  — version
[8-39]  salt  — 32 bytes
[40-51] iv    — 12 bytes
[52-67] tag   — 16 bytes (GCM auth tag)
[68+]   ciphertext
```

For full threat model, known limitations, and vulnerability disclosure:
see [SECURITY.md](./SECURITY.md)

---

## Browser support

Requires the [File System Access API](https://developer.mozilla.org/en-US/docs/Web/API/File_System_Access_API).

| Browser | Supported |
|---|---|
| Chrome 86+ | ✓ |
| Edge 86+ | ✓ |
| Brave, Opera (Chromium) | ✓ |
| Firefox | ✗ |
| Safari | ✗ |

Firefox and Safari do not implement this API. There is no IndexedDB fallback.

---

## CLI

Manage your vault from the terminal. Same `.crypthub` file — fully interoperable with the web app.

```bash
# install
cd cli/
npm install -g .

# first time
crypthub init

# every day
crypthub open
```

**Commands inside a session:**

```
list [category]    list all entries
get  <label>       copy password to clipboard
show <label>       reveal full entry
add                add a new entry
edit <label>       edit an entry
delete <label>     delete an entry
search <query>     search entries
dashboard          vault overview
cls                clear screen
lock               lock and exit
```

**Switching from web app to CLI:**

```bash
crypthub locate                              # find your vault file
crypthub use ~/Downloads/my-vault.crypthub   # point CLI at it
crypthub open                                # unlock with same password
```

Full CLI documentation: [cli/README.md](./cli/README.md)  
Migration guide: [cli/MIGRATING.md](./cli/MIGRATING.md)  
Troubleshooting: [cli/TROUBLESHOOTING.md](./cli/TROUBLESHOOTING.md)

---

## Run locally

No build step required.

```bash
git clone https://github.com/srsdesigndev/crypthub
cd crypthub
# open docs/index.html in Chrome or Edge
```

For self-hosting on GitHub Pages, Netlify, or Cloudflare Pages:
see [DEPLOY.md](./DEPLOY.md)

---

## Project structure

```
docs/
  index.html          landing page
  crypthub.html       vault app
  js/
    main.js           all crypto and app logic
  favicon.ico
cli/
  crypthub.js         CLI tool — zero dependencies
  package.json
  README.md           CLI command reference
  MIGRATING.md        web app → CLI migration guide
  TROUBLESHOOTING.md  install and usage troubleshooting
assets/               icons and images
.github/
  ISSUE_TEMPLATE/
    bug_report.md
    feature_request.md
  PULL_REQUEST_TEMPLATE.md
SECURITY.md
CONTRIBUTING.md
CHANGELOG.md
CODE_OF_CONDUCT.md
DEPLOY.md
```

---

## Limitations

- Web app: Chrome and Edge only — Firefox and Safari not supported
- No master password recovery — if you forget it, the vault cannot be decrypted
- No cloud sync — move vaults by copying the `.crypthub` file
- No formal security audit has been conducted
- CLI requires Node.js 18+

---

## Contributing

Open an issue before submitting a pull request for significant changes.  
Security-related changes must include a clear explanation of the threat model being addressed.

```bash
git checkout -b fix/your-change
git commit -m "fix: describe the change"
git push origin fix/your-change
# open a pull request
```

Full contribution guidelines: [CONTRIBUTING.md](./CONTRIBUTING.md)

---

## Changelog

See [CHANGELOG.md](./CHANGELOG.md)

---

## License

MIT — see [LICENSE](./LICENSE)

© 2026 srsdesigndev