# CryptHub CLI

Manage your `.crypthub` vault from the terminal.  
Fully compatible with vaults created by the [CryptHub web app](https://crypthub.srsdevdesign.com).

Zero dependencies — Node.js built-ins only.

---

## Requirements

- Node.js 18+
- macOS, Linux, or Windows
- Chrome or Edge not required — CLI works purely in terminal

---

## Install

```bash
cd cli/
npm install -g .
```

Installs `crypthub` as a global command. Run from anywhere after install.

---

## Commands

### Outside a session

```bash
crypthub init              # create a new vault
crypthub open              # unlock vault, enter interactive session
crypthub use <path>        # point CLI at an existing vault file
crypthub status            # show current vault config
crypthub locate            # find all .crypthub files on your system
crypthub version           # show version
crypthub help              # show help
```

### Inside a session

```
list [category]    list all entries, filter by category optionally
get  <label>       copy password to clipboard
show <label>       reveal full entry including password
add                add a new entry interactively
edit <label>       edit an existing entry
delete <label>     delete an entry
search <query>     search across label, username, notes
dashboard          vault overview — stats, categories, recent entries
info               vault file stats
cls                clear screen
lock               lock vault and exit
help               show available commands
```

---

## Migrating from the web app

See [MIGRATING.md](./MIGRATING.md) for the full guide.

Quick version:

```bash
# find your web app vault
crypthub locate

# point CLI at it
crypthub use ~/Downloads/my-vault.crypthub

# open with same master password you use in the browser
crypthub open
```

---

## Quick start — new vault

```bash
crypthub init     # creates vault, saves config
crypthub open     # unlock and enter session
```

---

## Example session

```
$ crypthub open

  ██████╗██████╗ ██╗   ██╗██████╗ ████████╗
 ██╔════╝██╔══██╗╚██╗ ██╔╝██╔══██╗╚══██╔══╝
 ██║     ██████╔╝ ╚████╔╝ ██████╔╝   ██║
 ██║     ██╔══██╗  ╚██╔╝  ██╔═══╝    ██║
 ╚██████╗██║  ██║   ██║   ██║        ██║
  ╚═════╝╚═╝  ╚═╝   ╚═╝   ╚═╝        ╚═╝

  local-first · AES-256-GCM · v2.0.0

  vault : /Users/you/my-vault.crypthub
  size  : 2048 bytes

  Master password : ****************

✓ Unlocked — 8 entries

  "help" — commands · "dashboard" — overview · "cls" — clear screen

crypthub › list

──────────────────────────────────────────────────────────────
  ID    LABEL                   USERNAME                CATEGORY
──────────────────────────────────────────────────────────────
  1     GitHub                  user@example.com        [Dev/Tech]
  2     Netflix                 user@example.com        [Entertainment]
  3     AWS                     admin@company.com       [Work]
──────────────────────────────────────────────────────────────
  3 entries

crypthub › get github

──────────────────────────────────────────────────────────────
  GitHub  [Dev/Tech]
  username : user@example.com
──────────────────────────────────────────────────────────────

✓ Password copied to clipboard.

crypthub › dashboard
  [ shows vault stats, category chart, recent entries ]

crypthub › lock

✓ Vault locked. Session cleared.
```

---

## Clipboard support

| OS | Tool | Notes |
|---|---|---|
| macOS | `pbcopy` | built-in, works automatically |
| Windows | `clip` | built-in, works automatically |
| Linux | `xclip` | install with `sudo apt install xclip` |

---

## How it works

The CLI reads and writes the exact same `.crypthub` binary format as the web app.  
A vault created in the browser opens in the CLI and vice versa — no conversion needed.

Crypto is identical to the web app:
- PBKDF2-SHA256, 310,000 iterations
- AES-256-GCM, fresh random IV on every write
- Session key in memory only, cleared on lock

Config lives at `~/.crypthub/config.json` — just the path to your vault.  
No passwords are ever stored.

---

## Uninstall

```bash
npm uninstall -g crypthub-cli
rm -rf ~/.crypthub
```

---

## Security

See [SECURITY.md](../SECURITY.md) for the full threat model.  
CLI uses Node.js built-in `crypto` module — no third-party libraries.


## Troubleshooting

See [TROUBLESHOOTING.md](./TROUBLESHOOTING.md)