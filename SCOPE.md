# CryptHub — Project Scope

> Living document. Updated as features are built and shipped.
> Last updated: February 2026

---

## Status Legend

| Symbol | Meaning |
|---|---|
| ✅ | Done & shipped |
| 🔄 | In progress |
| ⏳ | Pending |
| ❌ | Blocked |

---

## ✅ Shipped — v1.0.0

- [x] Project scaffolded with Electron + SQLite
- [x] AES-256-GCM encryption on all stored passwords
- [x] Master password authentication via scrypt key derivation
- [x] Session key in-memory only — never written to disk
- [x] Add, edit, delete password entries
- [x] Label, username, password, category, notes per entry
- [x] Cryptographically random password generator
- [x] Password strength meter
- [x] Category filter in sidebar
- [x] Full-text search across label, username, category
- [x] Copy password to clipboard
- [x] Lock / unlock session
- [x] Vault export — signed encrypted `.crypthub` binary file
- [x] Vault import — verify master password, wipe, restore
- [x] One vault, one session — no merging
- [x] `src/` folder structure
- [x] `.gitignore` configured
- [x] `README.md` professional with download links
- [x] MIT License
- [x] GitHub Actions CI/CD pipeline for Mac + Windows + Linux builds
- [x] macOS `.dmg` release published (arm64 + x64)
- [x] Git history cleaned of large binary files

---

## 🔴 Immediate — Before Next Release

- [ ] Add app icon
  - [ ] `.icns` — macOS
  - [ ] `.ico` — Windows
  - [ ] `.png` 512x512 — Linux
  - [ ] Place in `assets/` folder
- [ ] Rebuild macOS `.dmg` with icon included
- [ ] Re-publish macOS release `v1.0.1` with icon
- [ ] Add `"postinstall": "electron-builder install-app-deps"` to `package.json` scripts
- [ ] Add screenshot of app to `README.md`

---

## 🟡 Security & Core

- [ ] Auto-lock after inactivity
  - [ ] Configurable timeout — 5 min / 15 min / 30 min / never
  - [ ] Reset timer on any user interaction
  - [ ] Show lock screen immediately on timeout
- [ ] Confirm master password on first setup
  - [ ] Ask password twice to prevent typos on first run
- [ ] Wrong password attempt limiting
  - [ ] Lock out UI after 5 failed attempts
  - [ ] Show attempt counter to user
- [ ] Change master password
  - [ ] Re-encrypt all entries with new key
  - [ ] Verify old password before allowing change

---

## 🟢 Features

- [ ] Copy username to clipboard
  - [ ] Add copy button next to username on entry cards
- [ ] Show / hide password toggle on entry cards
- [ ] Custom categories
  - [ ] User can add new categories
  - [ ] User can rename categories
  - [ ] User can delete empty categories
- [ ] Settings screen
  - [ ] Auto-lock timeout selector
  - [ ] Change master password
  - [ ] App version display
- [ ] Entry audit log
  - [ ] Track when each password was last viewed
  - [ ] Track when each password was last changed
- [ ] Keyboard shortcuts
  - [ ] `Cmd+N` / `Ctrl+N` — new entry
  - [ ] `Cmd+L` / `Ctrl+L` — lock vault
  - [ ] `Cmd+F` / `Ctrl+F` — focus search
  - [ ] `Escape` — close modal
- [ ] Onboarding tip on first launch
  - [ ] "Click New Entry to add your first password"
  - [ ] Dismiss and never show again

---

## 📦 Distribution

- [ ] Windows `.exe` build
  - [ ] Build from Windows machine
  - [ ] Test installer on clean Windows system
  - [ ] Attach to GitHub Release
- [ ] Linux `.AppImage` build
  - [ ] Build via GitHub Actions or Windows machine
  - [ ] Test on Ubuntu
  - [ ] Attach to GitHub Release
- [ ] Test GitHub Actions workflow end-to-end
  - [ ] Push `v1.0.1` tag
  - [ ] Verify Mac + Windows + Linux all build successfully
  - [ ] Verify binaries auto-attach to GitHub Release
- [ ] Update README download table with Windows + Linux links

---

## 🧹 Polish

- [ ] About screen
  - [ ] App version
  - [ ] License info
  - [ ] Link to GitHub repo
- [ ] App version displayed in sidebar or titlebar
- [ ] Better empty state
  - [ ] Illustration or icon
  - [ ] Friendlier copy when vault is empty
- [ ] macOS code signing
  - [ ] Apple Developer account ($99/year)
  - [ ] Eliminates "unidentified developer" warning on first open
- [ ] Windows code signing
  - [ ] Eliminates SmartScreen warning on install

---

## 💡 Future Ideas

- [ ] Browser extension integration
- [ ] Biometric unlock — Touch ID (macOS) / Windows Hello
- [ ] TOTP / 2FA code storage and generator
- [ ] Secure notes — store text that isn't a password
- [ ] Password expiry reminders
- [ ] Breach detection — check against HaveIBeenPwned API (opt-in)
- [ ] Multiple vaults
- [ ] CLI interface

---

## Release History

| Version | Date | Notes |
|---|---|---|
| v1.0.0 | Feb 2026 | Initial release — macOS only |
| v1.0.1 | ⏳ | Icon + postinstall fix |
| v1.1.0 | ⏳ | Windows + Linux + auto-lock |

---

*This document is the single source of truth for what CryptHub is, what it does, and where it's going.*