# joinmindcraft.com — primary marketing domain

**Primary public URL:** https://joinmindcraft.com  
**Firebase Hosting site:** `mindcraft-marketing-site` (project `mindcraft-93858`)  
**Registrar:** Namecheap

App product stays on https://mindcraft-93858.web.app (login, practice, desk).  
Marketing landing / blog / intake live on joinmindcraft.com.

## One-time connect (you do this in browser)

### 1. Firebase Console

1. Open https://console.firebase.google.com/project/mindcraft-93858/hosting
2. Select the **mindcraft-marketing-site** site (not the app site).
3. **Add custom domain** → `joinmindcraft.com`
4. Also add `www.joinmindcraft.com` → redirect to `joinmindcraft.com`
5. Keep the page open — Firebase shows the exact DNS records to paste.

### 2. Namecheap Advanced DNS

1. https://ap.www.namecheap.com/domains/list/
2. **joinmindcraft.com** → **Manage** → **Advanced DNS**
3. Remove parking / URL redirect / Stopper records (currently resolving to
   Namecheap web parking at `198.54.117.242`).
4. Add every record Firebase lists. Typical shape:

| Type | Host | Value |
|------|------|--------|
| TXT | `@` or as shown | Firebase ownership token |
| A | `@` | Firebase IPv4(s) from the console |
| AAAA | `@` | Firebase IPv6(s) if shown |
| CNAME | `www` | `ghs.googlehosted.com` (or value Firebase shows) |

5. Save. SSL provisions automatically once DNS verifies.

### 3. Check

```bash
dig +short joinmindcraft.com A
curl -sI https://joinmindcraft.com | head -15
# Expect Firebase / Google front-end headers, NOT Server: namecheap-web
```

When Connected, hard-refresh https://joinmindcraft.com — you should see the
same landing as https://mindcraft-marketing-site.web.app.

## Already in the repo (CI)

Pushing to `main` deploys marketing content via `.github/workflows/deploy.yml`.
Canonical / OG / intake links in `index.html`, `app/src/lib/siteUrls.ts`, and
related surfaces already point at **https://joinmindcraft.com**.

Until DNS is connected, that hostname still shows Namecheap parking — finish
steps 1–2 above so the custom domain serves Firebase.
