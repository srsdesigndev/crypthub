![CryptHub](<assets/crypthub-main.png>)

# CryptHub

> A local-first, encrypted password manager that runs entirely in your browser. Your vault never leaves your device.

![License](https://img.shields.io/badge/license-MIT-green?style=flat-square)
![Status](https://img.shields.io/badge/status-active-brightgreen?style=flat-square)
![Encryption](https://img.shields.io/badge/encryption-AES--256--GCM-blue?style=flat-square)
![Storage](https://img.shields.io/badge/storage-local--only-orange?style=flat-square)

---

## What is CryptHub?

CryptHub is an open-source, browser-based password manager that keeps everything local — no cloud, no subscriptions, no accounts, no telemetry. Every password is encrypted with **AES-256-GCM** before it touches your browser's storage. The only way in is your master password.

When you need to move to a new device, CryptHub lets you export your entire vault as a single encrypted `.crypthub` file. Import it on any browser, verify with your master password, and your vault is restored exactly as it was.

🌐 **Live at [crypthub.srsdevdesign.com](https://crypthub.srsdevdesign.com)** — no install, no setup, works in any modern browser.

---

## Features

- **AES-256-GCM encryption** — every password is individually encrypted at rest
- **Master password authentication** — PBKDF2 key derivation, never stored in plain text
- **Local IndexedDB storage** — no internet connection required after first load, ever
- **Password generator** — cryptographically random, configurable length and symbols
- **Password strength meter** — real-time feedback as you type
- **Category organisation** — group passwords by Social, Work, Finance, Dev, and more
- **Full-text search** — filter entries instantly across label, username, and category
- **Vault migration** — export to a signed `.crypthub` encrypted file, import on any device
- **One vault, one session** — no merging, no conflicts, clean slate on import
- **Lock on demand** — session key lives in memory only, cleared on lock or tab close

---

## Security Model

| Layer | Implementation |
|---|---|
| Password hashing | PBKDF2 (310,000 iterations, random 32-byte salt) |
| Vault encryption | AES-256-GCM with random IV per entry |
| Export file | AES-256-GCM, signed with master password via PBKDF2 chain |
| Session key | In-memory only, never written to disk |
| Master password | Never stored — only a salted PBKDF2 hash |
| Tamper detection | GCM authentication tag on every encrypted value |

The `.crypthub` export file uses a two-layer key derivation chain:

```
masterHash = PBKDF2(userPassword, masterSalt, 310000)
exportKey  = PBKDF2(masterHash, exportSalt, 32)
```

This means the export file can only be decrypted by someone who knows the original master password. If the file is tampered with, the GCM auth tag verification will fail and the import is rejected.

---

## Getting Started

No installation required. Simply visit:

👉 **[crypthub.srsdevdesign.com](https://crypthub.srsdevdesign.com)**

Works on any device with a modern browser (Chrome, Firefox, Safari, Edge). Your vault is stored locally in your browser's IndexedDB — encrypted, private, and never transmitted anywhere.

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
3. Save your `.crypthub` file to a safe location (USB, secure storage, etc.)

**To import:**
1. Select the **Import** tab
2. Click **Select .crypthub File** and choose your backup
3. Enter your master password to verify and decrypt
4. Your vault is fully restored — the previous vault is wiped

> ⚠️ Import is destructive. It permanently replaces all current data with the imported vault. There is no undo.

### Locking

Click the lock icon in the top right corner at any time. The session key is cleared from memory immediately. Re-enter your master password to unlock.

---

## FAQ

**What happens if I forget my master password?**
There is no recovery option. Your master password is never stored anywhere — not on your device, not on any server. If you forget it, your vault cannot be decrypted. Write it down and keep it somewhere safe.

**Is my data backed up anywhere?**
No. Your vault lives entirely in your browser's IndexedDB. Use the **Export** feature regularly to keep a backup `.crypthub` file on a USB drive or secure storage.

**Does CryptHub work offline?**
Yes. After the first load, CryptHub works fully offline. No internet connection is ever required to access your vault.

**Can I use it on multiple devices?**
Yes — use the **Migrate Vault** feature to export your vault and import it on any other device or browser.

**Is it safe to use in a shared or public computer?**
Not recommended. Always lock your vault before leaving and clear browser data after use on shared machines.

---

## Browser Support

| Browser | Supported |
|---|---|
| Chrome / Chromium | ✅ |
| Firefox | ✅ |
| Safari | ✅ |
| Edge | ✅ |
| Opera | ✅ |

---

## Built With

- [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API) — AES-256-GCM, PBKDF2, random bytes (built-in to all modern browsers)
- [IndexedDB](https://developer.mozilla.org/en-US/docs/Web/API/IndexedDB_API) — local browser storage
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