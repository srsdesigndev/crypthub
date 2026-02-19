![alt text](<assets/auth-crypthub.png>)
![alt text](<assets/dashboard-crypthub.png>)
![alt text](<assets/add-entry-crypthub.png>)




# CryptHub

> A local-first, encrypted password manager built with Electron & SQLite. Your vault never leaves your machine.

![Platform](https://img.shields.io/badge/platform-macOS%20%7C%20Windows%20%7C%20Linux-lightgrey?style=flat-square)
![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Electron](https://img.shields.io/badge/electron-28-blue?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)

---

## What is CryptHub?

CryptHub is an open-source desktop password manager that keeps everything local — no cloud, no subscriptions, no accounts, no telemetry. Every password is encrypted with **AES-256-GCM** before it touches your disk. The only way in is your master password.

When you need to move to a new machine, CryptHub lets you export your entire vault as a single encrypted `.crypthub` file. Import it anywhere, verify with your master password, and your vault is restored exactly as it was.

---

## Features

- **AES-256-GCM encryption** — every password is individually encrypted at rest
- **Master password authentication** — scrypt key derivation, never stored in plain text
- **Local SQLite storage** — no internet connection required, ever
- **Password generator** — cryptographically random, configurable length and symbols
- **Password strength meter** — real-time feedback as you type
- **Category organisation** — group passwords by Social, Work, Finance, Dev, and more
- **Full-text search** — filter entries instantly across label, username, and category
- **Vault migration** — export to a signed `.crypthub` binary file, import on any machine
- **One vault, one session** — no merging, no conflicts, clean slate on import
- **Lock on demand** — session key lives in memory only, cleared on lock

---

## Security Model

| Layer | Implementation |
|---|---|
| Password hashing | `scrypt` (N=32768, r=8, p=1) |
| Vault encryption | AES-256-GCM with random IV per entry |
| Export file | AES-256-GCM, signed with master password via scrypt chain |
| Session key | In-memory only, never written to disk |
| Master password | Never stored — only a salted scrypt hash |
| Tamper detection | GCM authentication tag on every encrypted value |

The `.crypthub` export file uses a two-layer key derivation chain:

```
masterHash = scrypt(userPassword, masterSalt, 64)
exportKey  = scrypt(masterHash, exportSalt, 32)
```

This means the export file can only be decrypted by someone who knows the original master password. If the file is tampered with, the GCM auth tag verification will fail and the import is rejected.

---

## Download

No coding required. Just download and run.

| Platform | Download |
|---|---|
| macOS (Apple Silicon) | [CryptHub-1.0.0-arm64.dmg](https://github.com/srsdesigndev/crypthub/releases/latest) |
| macOS (Intel) | [CryptHub-1.0.0-x64.dmg](https://github.com/srsdesigndev/crypthub/releases/latest) |
| Windows | [CryptHub-Setup-1.0.0.exe](https://github.com/srsdesigndev/crypthub/releases/latest) |
| Linux | [CryptHub-1.0.0.AppImage](https://github.com/srsdesigndev/crypthub/releases/latest) |

> All release binaries are attached to the [Releases](https://github.com/srsdesigndev/crypthub/releases) page.

---

## Getting Started

### Prerequisites

- [Node.js](https://nodejs.org/) v18 or higher
- macOS, Windows, or Linux
- Xcode Command Line Tools (macOS only): `xcode-select --install`

### Installation

```bash
# Clone the repository
git clone https://github.com/srsdesigndev/crypthub.git
cd crypthub

# Install dependencies
npm install

# Rebuild native SQLite module for your Electron version
./node_modules/.bin/electron-rebuild

# Launch
npm start
```

### First Launch

On first launch, CryptHub will ask you to create a master password. This password encrypts your entire vault — **there is no recovery option if you forget it.** Choose something strong and store it somewhere safe.

---

## Usage

### Adding a password

Click **New Entry** in the sidebar. Fill in the label (required), username, password, category, and optional notes. Use the **⚡ Generate** button to create a cryptographically random password.

### Copying a password

Click the **Copy** button on any entry card. The password is copied to your clipboard.

### Migrating your vault

Click **Migrate Vault** in the sidebar.

**To export:**
1. Select the **Export** tab
2. Click **Export Vault**
3. Choose where to save your `.crypthub` file
4. Move this file to your new machine (USB, secure cloud storage, etc.)

**To import:**
1. Select the **Import** tab
2. Click **Select .crypthub File** and choose your backup
3. Enter your master password to verify and decrypt
4. Your vault is fully restored — the previous vault is wiped

> ⚠️ Import is destructive. It permanently replaces all current data with the imported vault. There is no undo.

### Locking

Click the lock icon in the top right corner at any time. The session key is cleared from memory immediately. Re-enter your master password to unlock.

---

## Project Structure

```
crypthub/
├── main.js          # Electron main process, IPC handlers, crypto, SQLite
├── preload.js       # Context bridge — exposes safe API to renderer
├── index.html       # UI markup and styles
├── renderer.js      # UI logic and event handling
├── package.json
├── .gitignore
└── README.md
```

---

## Built With

- [Electron](https://www.electronjs.org/) — cross-platform desktop framework
- [better-sqlite3](https://github.com/WiseLibs/better-sqlite3) — fast, synchronous SQLite bindings
- [Node.js crypto](https://nodejs.org/api/crypto.html) — AES-256-GCM, scrypt, random bytes (built-in)
- [JetBrains Mono](https://www.jetbrains.com/lp/mono/) + [Syne](https://fonts.google.com/specimen/Syne) — typography

No external UI frameworks. No tracking libraries. No analytics.

---

## Contributing

Contributions are welcome. Please open an issue before submitting a pull request for significant changes so we can discuss the approach.

```bash
# Fork the repo, then:
git checkout -b feature/your-feature-name
git commit -m "feat: describe your change"
git push origin feature/your-feature-name
# Open a pull request
```

Please keep pull requests focused on a single concern. Security-related changes should include a clear explanation of the threat model being addressed.

---

## Roadmap

- [ ] Auto-lock after inactivity timeout
- [ ] Browser extension integration
- [ ] Biometric unlock (Touch ID / Windows Hello)
- [ ] Custom categories
- [ ] Entry history / audit log
- [ ] Packaged installers (.dmg, .exe, .AppImage)

---

## License

```
MIT License

Copyright (c) 2026 CryptHub Contributors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.
```

---

## Disclaimer

CryptHub is provided as-is for personal use. While it uses strong, industry-standard cryptographic primitives, it has not undergone a formal third-party security audit. Use it at your own risk. The authors are not responsible for any data loss or security breaches arising from its use.

---

<p align="center">Built with care. No cloud. No compromise.</p>