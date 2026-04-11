# Migrating from the Web App to the CLI

If you have been using the CryptHub web app and want to manage the same vault from the terminal, this guide walks you through it.

No data migration required. The CLI reads the same `.crypthub` file the web app writes. You just need to point the CLI at the right file.

---

## Step 1 — Install the CLI

```bash
cd cli/
npm install -g .
```

Verify it works:

```bash
crypthub help
```

---

## Step 2 — Find your web app vault

Your vault is a `.crypthub` file somewhere on your filesystem. The web app asked you where to save it when you first created it.

If you don't remember where it is, run:

```bash
crypthub locate
```

This scans your home directory, Downloads, Desktop, and Documents for all `.crypthub` files and lists them with their sizes.

Example output:

```
──────────────────────────────────────────────────────────────
  FILE                                               SIZE
──────────────────────────────────────────────────────────────
  /Users/you/Downloads/my-vault.crypthub             2048b
──────────────────────────────────────────────────────────────

Found 1 vault.
To use one: crypthub use <path>
```

If `locate` doesn't find it, search manually:

```bash
find ~ -name "*.crypthub" 2>/dev/null
```

---

## Step 3 — Point the CLI at your vault

```bash
crypthub use ~/Downloads/my-vault.crypthub
```

Or if you are already in the directory containing the vault:

```bash
cd ~/Downloads
crypthub use .
```

The file is not moved or copied. The CLI just saves the path to `~/.crypthub/config.json`.

Confirm it worked:

```bash
crypthub status
```

Expected output:

```
──────────────────────────────────────────────────────────────
  CryptHub Status
──────────────────────────────────────────────────────────────
  vault    : /Users/you/Downloads/my-vault.crypthub
  exists   : yes
  size     : 2048 bytes
  valid    : yes
  config   : /Users/you/.crypthub/config.json
──────────────────────────────────────────────────────────────
```

---

## Step 4 — Open your vault

```bash
crypthub open
```

Enter the same master password you use in the web app. Your vault unlocks and all entries are available.

---

## Using both web and CLI together

The web app and CLI share the same `.crypthub` file. Any changes made in one are immediately available in the other — just unlock with your master password.

**Web app workflow:**
1. Open `crypthub.srsdevdesign.com` in Chrome or Edge
2. Click "Open Existing Vault"
3. Select your `.crypthub` file
4. Enter master password

**CLI workflow:**
1. Run `crypthub open` in terminal
2. Enter master password

Both read and write the same file. No sync needed.

---

## Troubleshooting

**`crypthub locate` didn't find my vault**

The web app stores the vault wherever you chose when you clicked "Create New Vault". Try searching the full home directory:

```bash
find ~ -name "*.crypthub" 2>/dev/null
```

**`crypthub use` says "not a valid .crypthub file"**

The file may be corrupted or not a CryptHub vault. The CLI checks for the `CRHB` magic bytes at the start of the file. If the web app created it correctly, this check will pass.

**Wrong master password error**

The CLI uses the same master password as the web app. They are not separate — it is the same key derived from the same password against the same salt stored in the file header.

**Vault opens in CLI but some entries are missing**

Check that you are pointing at the correct file. If you have multiple `.crypthub` files, run `crypthub locate` to see all of them. The web app and CLI must point at the same file.