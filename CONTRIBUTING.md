# Contributing to CryptHub

Thank you for your interest in contributing. CryptHub is a small, focused project — contributions are welcome but should stay aligned with its core goal: a simple, local-first, privacy-respecting password manager.

---

## Before You Start

Open an issue before submitting a pull request for any significant change. This avoids wasted effort if the change doesn't align with the project's direction.

For small fixes (typos, documentation, obvious bugs) — a PR directly is fine.

---

## What We Welcome

- Bug fixes
- Security improvements (see [SECURITY.md](./SECURITY.md) for vulnerability reports)
- Documentation improvements
- Browser compatibility fixes within the scope of supported browsers
- Accessibility improvements
- Performance improvements that do not change the security model

## What We Will Not Accept

- Cloud sync or server-side features — this is intentionally a local-first tool
- Additional browser storage backends (IndexedDB fallback, etc.)
- Third-party cryptography libraries — Web Crypto API only
- Analytics, telemetry, or tracking of any kind
- UI frameworks or build steps — the project has no build process by design
- Features that significantly increase complexity without clear privacy or security benefit

---

## Development Setup

No build step. No dependencies to install.

```bash
git clone https://github.com/srsdesigndev/crypthub
cd crypthub
# open docs/crypthub.html in Chrome or Edge
```

All application logic is in `docs/js/main.js`.  
The landing page is `docs/index.html`.  
The app is `docs/crypthub.html`.

---

## Code Standards

- Vanilla JavaScript only — no frameworks, no transpilation
- No external libraries — not even for utilities
- All crypto operations must use the Web Crypto API
- Keep `docs/js/main.js` as a single readable file — do not split it
- Follow the existing code style: 2-space indentation, single quotes, strict mode
- Any change to cryptographic logic must include a clear explanation of the security rationale in the PR description

---

## Pull Request Process

1. Fork the repository
2. Create a branch:
   ```bash
   git checkout -b fix/describe-your-change
   ```
3. Make your changes
4. Test in Chrome and Edge
5. Commit with a clear message:
   ```bash
   git commit -m "fix: describe what changed and why"
   ```
6. Push and open a pull request against `main`
7. Fill out the pull request template

**PR titles** should follow the format:
```
fix: short description
feat: short description
docs: short description
security: short description
```

---

## Security-Related Contributions

Any change that touches cryptographic logic, key handling, file format, or session management must:

- Clearly explain the threat model being addressed or improved
- Not reduce the current security guarantees
- Be reviewed carefully before merging — expect a slower review process

If you believe you have found a security vulnerability, do not open a public PR. See [SECURITY.md](./SECURITY.md).

---

## Reporting Bugs

Use the [bug report template](.github/ISSUE_TEMPLATE/bug_report.md) when opening an issue.  
Include your browser version, OS, and steps to reproduce.

---

## License

By contributing, you agree that your contributions will be licensed under the [MIT License](./LICENSE).