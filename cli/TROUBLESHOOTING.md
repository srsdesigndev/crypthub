# Troubleshooting

Common problems and fixes for CryptHub CLI, based on real installation and usage experience.

---

## Installation

### `npm install -g .` fails with permission denied

**Error:**
```
npm error code EACCES
npm error syscall symlink
npm error errno -13
npm error Error: EACCES: permission denied
```

**Cause:** npm is trying to write to `/usr/local/lib/node_modules` which requires root access. Do not use `sudo` — it creates security and ownership problems.

**Fix:** Configure npm to use a directory you own.

```bash
# 1. create a local npm directory
mkdir -p ~/.npm-global

# 2. tell npm to use it
npm config set prefix ~/.npm-global

# 3. add it to your PATH
#    for zsh (default on macOS Catalina+):
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc

#    for bash (default on Linux, older macOS, conda environments):
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc

# 4. install again
cd /path/to/crypthub/cli
npm install -g .

# 5. verify
crypthub help
```

---

### `crypthub: command not found` after install

**Cause:** The npm global bin directory is not in your PATH, or the PATH change hasn't been applied to the current shell session.

**Step 1 — verify the binary exists:**
```bash
ls ~/.npm-global/bin/crypthub
```

If it's there, the binary installed correctly. The PATH just needs updating.

**Step 2 — apply PATH for the current session immediately:**
```bash
export PATH="$HOME/.npm-global/bin:$PATH"
```

**Step 3 — make it permanent:**

First check which shell you're using:
```bash
echo $SHELL
```

- `/bin/zsh` — add to `~/.zshrc`:
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.zshrc
source ~/.zshrc
```

- `/bin/bash` without conda — add to `~/.bashrc`:
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bashrc
source ~/.bashrc
```

- `/bin/bash` with conda (you see `(base)` in your prompt) — add to `~/.bash_profile` instead. This is the most common cause of the PATH not persisting across sessions on macOS with conda, because conda initialises in `.bash_profile` and macOS terminal loads `.bash_profile` on login shells, not `.bashrc`:
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

**Step 4 — open a new terminal window** and verify:
```bash
crypthub help
```

---

### Binary exists but still `command not found` in new terminal

**Cause:** On macOS, the terminal opens a login shell which loads `.bash_profile` but not `.bashrc`. If you added the PATH to `.bashrc` only, it won't apply to new terminal windows.

**Fix — conda users on macOS:**
```bash
echo 'export PATH="$HOME/.npm-global/bin:$PATH"' >> ~/.bash_profile
source ~/.bash_profile
```

**Fix — if you added it to `.bashrc` and want to keep it there**, make `.bash_profile` source `.bashrc`:
```bash
echo '[ -f ~/.bashrc ] && source ~/.bashrc' >> ~/.bash_profile
source ~/.bash_profile
```

Then open a new terminal and try `crypthub help`.

Then open a new terminal and try `crypthub help`.

---

### Node.js version error

**Error:**
```
SyntaxError: Unexpected token
```
or
```
engine unsupported
```

**Cause:** Node.js version is below 18.

**Check your version:**
```bash
node --version
```

**Fix:** Install Node.js 18 or later from [nodejs.org](https://nodejs.org) or via your package manager:

```bash
# macOS with Homebrew
brew install node

# Ubuntu/Debian
curl -fsSL https://deb.nodesource.com/setup_20.x | sudo -E bash -
sudo apt install -y nodejs
```

---

## Vault Setup

### Vault file not found after `crypthub open`

**Error:**
```
✗ Vault file not found: /some/path/TEST@123
```

**Cause:** During `crypthub init`, a password or other input was accidentally captured as the vault path. This happened because the vault path prompt captured unexpected input.

**Fix:** Reset the config by running `crypthub init` again or point directly at your vault:

```bash
# find your actual vault file
crypthub locate

# or search manually
find ~ -name "*.crypthub" 2>/dev/null

# point CLI at the correct file
crypthub use ~/path/to/your-vault.crypthub

# verify
crypthub status
```

---

### No vault configured

**Error:**
```
✗ No vault configured. Run: crypthub init
```

**Cause:** Either `crypthub init` was never run, or the config file at `~/.crypthub/config.json` was deleted.

**Fix — if you have an existing vault (e.g. from the web app):**
```bash
crypthub locate
crypthub use ~/path/to/vault.crypthub
```

**Fix — if you need a new vault:**
```bash
crypthub init
```

---

### Web app and CLI pointing at different vaults

**Symptom:** Passwords added in the browser don't appear in the CLI, or vice versa.

**Cause:** The CLI is configured to use a different `.crypthub` file than the one the web app is writing to.

**Fix:**

1. Find all vault files on your system:
```bash
crypthub locate
```

2. Identify which one the web app uses — it is the file you selected when you clicked "Open Existing Vault" or "Create New Vault" in the browser.

3. Point the CLI at that file:
```bash
crypthub use ~/path/to/web-app-vault.crypthub
```

4. Open it with the same master password:
```bash
crypthub open
```

See [MIGRATING.md](./MIGRATING.md) for the full migration guide.

---

### `crypthub locate` didn't find my vault

**Cause:** The vault is in a location that `locate` doesn't scan (it checks home, Downloads, Desktop, Documents, and the current directory up to 3 levels deep).

**Fix — full system search:**
```bash
find ~ -name "*.crypthub" 2>/dev/null
```

This searches your entire home directory. May take a few seconds.

---

## Authentication

### Wrong master password error

**Error:**
```
✗ Wrong master password or corrupted file.
```

**Possible causes:**

1. **Incorrect password** — the master password is case-sensitive and must match exactly what you set during `crypthub init` or in the web app.

2. **Wrong vault file** — you may be pointing at a different `.crypthub` file than expected. Run `crypthub status` to confirm which file the CLI is using.

3. **Corrupted file** — if the file was partially written or transferred incorrectly, the GCM authentication tag will fail.

**Check which vault is active:**
```bash
crypthub status
```

**If you suspect a corrupted file:**
```bash
# check file size — a valid vault is at least 69 bytes
ls -lh ~/.crypthub/config.json
find ~ -name "*.crypthub" -exec ls -lh {} \;
```

A valid `.crypthub` file is at minimum 69 bytes (68-byte header + at least 1 byte of ciphertext). A 0-byte or very small file is corrupted.

**There is no password recovery.** If you have forgotten your master password, the vault cannot be decrypted. This is by design.

---

### Password input not hidden / showing characters

**Cause:** Terminal raw mode is not supported in some environments (certain terminal emulators, IDE terminals, or piped input).

**Fix:** Use a standard terminal — Terminal.app on macOS, or a standard terminal emulator on Linux. Avoid running the CLI from inside VS Code's integrated terminal if you see this issue.

---

## Clipboard

### `get <label>` does not copy to clipboard on Linux

**Error:**
```
! Clipboard unavailable. Install xclip on Linux.
```

**Fix:**
```bash
# Ubuntu/Debian
sudo apt install xclip

# Fedora
sudo dnf install xclip

# Arch
sudo pacman -S xclip
```

After installing, `crypthub get <label>` will copy to clipboard automatically.

---

### Clipboard works but pastes wrong content

**Cause:** Another application overwrote the clipboard between the `get` command and your paste.

**Fix:** Paste immediately after running `get`. The CLI does not clear the clipboard after a timeout — be mindful on shared machines.

---

## Config

### Reset config completely

If you want to start fresh:

```bash
rm -rf ~/.crypthub
crypthub init
```

This deletes the config directory and all CLI settings. Your `.crypthub` vault file is not affected — it lives wherever you saved it.

---

### View current config

```bash
cat ~/.crypthub/config.json
```

Output:
```json
{
  "vaultPath": "/Users/you/Downloads/my-vault.crypthub"
}
```

Edit this file directly if needed — just update the `vaultPath` value to the correct absolute path.

---

### Change vault path without `crypthub use`

```bash
# directly edit the config
echo '{"vaultPath":"/new/path/to/vault.crypthub"}' > ~/.crypthub/config.json

# verify
crypthub status
```

---

## General

### Spinner or formatting looks broken in my terminal

**Cause:** Some terminals don't support Unicode block characters (`⠋⠙⠹`) or ANSI escape codes.

**Affected environments:** Some CI terminals, Windows CMD (non-WSL), older terminal emulators.

**Fix:** Use a modern terminal. On Windows, use Windows Terminal or WSL. On macOS, use Terminal.app or iTerm2.

---

### `crypthub open` hangs at "Unlocking…"

**Cause:** PBKDF2 with 310,000 iterations takes approximately 0.5–1.5 seconds depending on your hardware. This is intentional — it makes brute-force attacks slower.

It is not frozen. Wait 1–2 seconds.

---

### Changes made in CLI don't appear in web app immediately

**Cause:** The web app reads the vault file when you open it. If you made changes in the CLI while the web app was open, the web app has an older version in memory.

**Fix:** Lock and reopen the vault in the web app to reload from disk.

---

## Still stuck?

Open an issue: [github.com/srsdesigndev/crypthub/issues](https://github.com/srsdesigndev/crypthub/issues)

Include:
- Your OS and version
- Node.js version (`node --version`)
- Shell (`echo $SHELL`)
- The exact error message
- Steps to reproduce

Do not include your master password or vault contents in any issue.