# Changelog

All notable changes to CryptHub are documented here.  
Format follows [Keep a Changelog](https://keepachangelog.com/en/1.0.0/).  
Versioning follows [Semantic Versioning](https://semver.org/).

---

## [1.1.0] — 2026-04-11

### Changed
- Migrated from Electron desktop app to web-only architecture
- Replaced card-based entry UI with a clean table layout
- Replaced mixed CSS with a unified design token system
- Added dark/light mode via `prefers-color-scheme` — no JS toggle
- Landing page (`index.html`) rewritten — plain document style, factually accurate
- Corrected incorrect claim that vault was stored in IndexedDB — vault uses File System Access API
- Corrected browser support claims — explicitly documented Chrome/Edge only, Firefox/Safari unsupported
- Typography: JetBrains Mono throughout, no display fonts
- Modal closes on Escape key and backdrop click

### Added
- `SECURITY.md` — threat model, crypto rationale, vulnerability disclosure process
- `CONTRIBUTING.md` — contribution guidelines
- `CHANGELOG.md` — this file
- `DEPLOY.md` — self-hosting guide for GitHub Pages, Netlify, Cloudflare Pages
- `CODE_OF_CONDUCT.md` — community standards
- GitHub issue templates for bug reports and feature requests
- GitHub pull request template
- `.nojekyll` — disables Jekyll processing on GitHub Pages

### Removed
- Electron desktop app (`src/` directory) — abandoned, replaced by web app
- `better-sqlite3` dependency — not used in web version
- All references to IndexedDB storage — not used
- Animated reveal effects and decorative UI elements from landing page

### Security
- No changes to cryptographic implementation
- AES-256-GCM, PBKDF2 (310,000 iterations), Web Crypto API — unchanged

---

## [1.0.0] — 2026-01-15

### Added
- Initial release
- AES-256-GCM encryption via Web Crypto API
- PBKDF2 key derivation (310,000 iterations, SHA-256, 32-byte salt)
- File System Access API vault storage — `.crypthub` binary format
- Master password authentication — never stored
- Auto-save on every change — re-encrypts and writes on every add, edit, delete
- Session key in memory only — cleared on lock or tab close
- Password generator via `crypto.getRandomValues()`
- Password strength meter
- Category organisation — General, Social, Work, Finance, Entertainment, Dev/Tech, Shopping, Other
- Full-text search across label and username
- Lock on demand — clears session key from memory
- Browser compatibility check — clear error for unsupported browsers
- Cross-platform — works on any OS in Chrome or Edge
- MIT license