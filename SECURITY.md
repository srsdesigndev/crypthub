# Security Policy

## Scope

This document covers the security model of CryptHub, what attacks it is designed to defend against, what it explicitly does not protect against, and how to report vulnerabilities responsibly.

---

## Cryptographic Design

### Key Derivation

The master password is never stored anywhere. On unlock, it is passed through PBKDF2 (310,000 iterations, SHA-256, 32-byte random salt) to derive a 256-bit AES-GCM key. The salt is stored in the vault file header and is unique per vault — created once at vault creation and never changed.

310,000 iterations is aligned with NIST SP 800-132 recommendations for PBKDF2-SHA256 as of 2024. This makes brute-force attacks on weak passwords significantly slower but does not eliminate the risk. Use a strong master password.

### Encryption

Every write operation encrypts the full vault payload using AES-256-GCM with a fresh 12-byte IV generated via `crypto.getRandomValues()`. The GCM authentication tag (16 bytes) is stored in the file header and verified on every read. Any modification to the ciphertext — even a single bit — causes authentication to fail and the file is rejected before any data is exposed.

### Session Key

The derived CryptoKey object lives in JavaScript memory only for the duration of the session. It is never serialised, never written to localStorage, sessionStorage, IndexedDB, or disk. Locking the vault or closing the tab sets the key reference to `null`. Whether the garbage collector immediately zeroes the underlying memory is not guaranteed by the JavaScript specification — this is a known limitation of browser-based cryptography.

### Crypto Implementation

All cryptographic operations use the browser's native [Web Crypto API](https://developer.mozilla.org/en-US/docs/Web/API/Web_Crypto_API). No third-party cryptography libraries are used. The implementation is in a single readable file: [`docs/js/main.js`](./docs/js/main.js).

---

## Threat Model

### What CryptHub protects against

- **Vault file theft** — an attacker who obtains your `.crypthub` file cannot read its contents without your master password. The file is useless without the key.
- **File tampering** — any modification to the vault file is detected by the GCM authentication tag. A tampered file will not decrypt.
- **Server-side compromise** — CryptHub has no server, no database, and no accounts. There is nothing to compromise server-side.
- **Browser storage exposure** — your vault does not live in localStorage, IndexedDB, or any browser-managed storage. Browser clears, extensions, and site data access cannot reach your vault.
- **Network interception** — no vault data is ever transmitted over the network. There is no network surface to intercept.

### What CryptHub does NOT protect against

- **Compromised device** — if an attacker has active access to your device (malware, keylogger, remote access), they can capture your master password as you type it or read the decrypted vault from memory while the session is open.
- **Weak master password** — PBKDF2 slows brute force but does not prevent it against short or common passwords. Use a passphrase of at least 16 characters.
- **Physical access while unlocked** — if your vault is open and someone has physical access to your device, they can read your passwords.
- **Browser vulnerabilities** — CryptHub runs inside the browser. A compromised browser or a browser zero-day could expose the session key or decrypted entries.
- **JavaScript memory disclosure** — the decrypted vault exists in JavaScript memory while unlocked. Memory disclosure vulnerabilities in the browser could expose it.
- **Side-channel attacks** — no mitigations are implemented for timing attacks or cache-based side channels.
- **Forgotten master password** — there is no recovery mechanism. A forgotten password means permanent loss of vault access.
- **Lost vault file** — there is no cloud backup. If you delete your `.crypthub` file without a backup, the vault is gone.

---

## Known Limitations

- **No formal audit** — CryptHub has not been reviewed by a professional cryptographer or security firm. It uses standard primitives correctly to the best of the author's knowledge.
- **Session key in GC memory** — JavaScript does not guarantee that setting a variable to `null` immediately zeroes the underlying memory. The session key may persist in memory briefly after locking.
- **Single-file vault** — the entire vault is re-encrypted and rewritten on every change. For very large vaults this is inefficient, but it avoids partial-write consistency issues.
- **Browser-only** — no native app, no CLI. Attack surface is limited to the browser environment.
- **Chrome and Edge only** — the File System Access API is not implemented in Firefox or Safari.

---

## Supported Versions

| Version | Supported |
|---|---|
| Latest (main branch) | ✓ |
| Older releases | ✗ — update to latest |

---

## Reporting a Vulnerability

If you discover a security vulnerability in CryptHub, please report it responsibly.

**Do not open a public GitHub issue for security vulnerabilities.**

**Contact:** Open a [GitHub Security Advisory](https://github.com/srsdesigndev/crypthub/security/advisories/new) in the repository. This is private and only visible to the maintainer.

**Include in your report:**
- Description of the vulnerability
- Steps to reproduce
- Potential impact
- Suggested fix if you have one

**Response time:** You will receive an acknowledgement within 72 hours. A fix will be prioritised based on severity.

**Disclosure:** Once a fix is released, the vulnerability will be documented in [`CHANGELOG.md`](./CHANGELOG.md) and a GitHub Security Advisory will be published. Reporters will be credited unless they request otherwise.

---

## External References

- [NIST SP 800-132](https://nvlpubs.nist.gov/nistpubs/Legacy/SP/nistspecialpublication800-132.pdf) — PBKDF2 recommendations
- [Web Crypto API](https://www.w3.org/TR/WebCryptoAPI/) — W3C specification
- [File System Access API](https://wicg.github.io/file-system-access/) — WICG specification
- [AES-GCM](https://csrc.nist.gov/publications/detail/sp/800-38d/final) — NIST SP 800-38D