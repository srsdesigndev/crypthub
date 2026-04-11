# Deploying CryptHub

CryptHub is a static HTML/JS app with no backend and no build step.  
You can host it anywhere that serves static files.

---

## Option 1 — GitHub Pages (recommended)

The simplest way. Free, no server required.

**Step 1 — Fork the repository**

Go to [github.com/srsdesigndev/crypthub](https://github.com/srsdesigndev/crypthub)  
and click **Fork**.

**Step 2 — Enable GitHub Pages**

In your forked repo:

```
Settings → Pages → Branch: main → Folder: /docs → Save
```

Your app is now live at:

```
https://yourusername.github.io/crypthub/
```

**Step 3 — Add a custom domain (optional)**

If you want to use your own domain (e.g. `passwords.yourdomain.com`):

1. Add a CNAME record in your DNS provider:

```
Type:  CNAME
Name:  passwords        ← your chosen subdomain
Value: yourusername.github.io
TTL:   3600
```

2. Update the `CNAME` file inside `docs/`:

```
passwords.yourdomain.com
```

3. In GitHub repo settings:

```
Settings → Pages → Custom domain → enter your domain → Save
```

4. Wait for DNS to propagate (usually 5–30 minutes).  
   GitHub will show a green checkmark when the domain is verified.

---

## Option 2 — Any static host

CryptHub works on any host that serves static HTML files.  
Examples: Netlify, Vercel, Cloudflare Pages, your own VPS with nginx.

**Deploy the contents of `docs/` as your web root.**

```
docs/
  index.html       → yourdomain.com/
  crypthub.html    → yourdomain.com/crypthub.html
  js/
    main.js
  favicon.ico
```

No server-side code. No environment variables. No build process.

**Netlify example:**

1. Fork the repo
2. Connect your GitHub account to Netlify
3. New site → Import from Git → select your fork
4. Build settings:
   - Build command: *(leave empty)*
   - Publish directory: `docs`
5. Deploy

**Cloudflare Pages example:**

1. Fork the repo
2. Cloudflare dashboard → Pages → Create a project
3. Connect GitHub → select your fork
4. Build settings:
   - Framework preset: None
   - Build command: *(leave empty)*
   - Build output directory: `docs`
5. Deploy

---

## Option 3 — Run locally, no server

Open `docs/crypthub.html` directly in Chrome or Edge.

```bash
git clone https://github.com/srsdesigndev/crypthub
cd crypthub
# open docs/crypthub.html in Chrome or Edge
```

No install. No dependencies. No internet connection required after cloning.

---

## Important notes

**Browser requirement**

CryptHub uses the File System Access API. Only Chrome 86+ and Edge 86+ support it.  
Firefox and Safari will show an unsupported browser message.

**HTTPS required**

The File System Access API only works over HTTPS (or localhost).  
GitHub Pages, Netlify, Vercel, and Cloudflare Pages all provide HTTPS automatically.  
If you host on your own server, configure TLS before deploying.

**No server-side changes needed**

CryptHub has no backend, no database, no API keys, and no environment variables.  
Everything runs in the browser. Deploying is just copying files.

**Your vault stays on your device**

Hosting CryptHub yourself does not change where your vault is stored.  
Your `.crypthub` file always lives on your local filesystem, regardless of where the app is hosted.  
The host never sees your passwords.

---

## Updating to a new version

```bash
# in your fork
git remote add upstream https://github.com/srsdesigndev/crypthub
git fetch upstream
git merge upstream/main
git push origin main
```

GitHub Pages will redeploy automatically after the push.

---

## Questions and issues

Open an issue at [github.com/srsdesigndev/crypthub/issues](https://github.com/srsdesigndev/crypthub/issues)