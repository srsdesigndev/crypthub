# CryptHub

A local-first password manager that runs in your browser.  
Your vault is stored as an encrypted `.crypthub` file on your filesystem — not in the browser, not on any server.

**Live:** [crypthub.srsdevdesign.com](https://crypthub.srsdevdesign.com)

---

## How it works

1. Open CryptHub in Chrome or Edge
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
| Crypto implementation | Web Crypto API — browser-native, no libraries |
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

## Run locally

No build step required.

```bash
git clone https://github.com/srsdesigndev/crypthub
cd crypthub
# open docs/index.html in Chrome or Edge
```

---

## Project structure

```
docs/
  index.html        landing page
  crypthub.html     vault app
  js/
    main.js         all crypto and app logic
  favicon.ico
assets/             icons and images
```

---

## Limitations

- Chrome and Edge only — Firefox and Safari not supported
- No master password recovery — if you forget it, the vault cannot be decrypted
- No cloud sync — move vaults by copying the `.crypthub` file
- No formal security audit has been conducted

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

---

## License

MIT — see [LICENSE](./LICENSE)

© 2026 srsdesigndev