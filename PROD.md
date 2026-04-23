# MA Learn Dashboard — Production Runbook

**Live URLs:**
- Admin: https://admin.malearnsa.com (GitHub Pages)
- API: https://api.malearnsa.com (DigitalOcean droplet `46.101.151.237`, pm2 → Caddy)
- Student player: https://player.malearnsa.com (separate repo `Majidangawi/malearnsa-player`)

**Promoted to prod:** 2026-04-23. Previously ran on `admin-staging.malearnsa.com` + `api-staging.malearnsa.com`. Staging pm2 app left installed but **stopped**; DNS records for the `-staging` subdomains left in place temporarily for rollback.

---

## Deploy a change

### Frontend (admin.malearnsa.com)

```bash
cd ~/code/ma-learn-dashboard
# edit, commit on a feature branch, merge to main, then:
git push origin main
```

GitHub Pages rebuilds in ~30–60 s. Hard-reload the browser to see the change.

### Backend (api.malearnsa.com)

```bash
cd ~/code/ma-learn-dashboard/backend
npm run build
rsync -az -e "ssh -o ConnectTimeout=10" dist/ root@46.101.151.237:/var/www/ma-learn-dashboard/backend/dist/
ssh root@46.101.151.237 'pm2 restart ma-learn-dashboard-prod --update-env'
curl -sS https://api.malearnsa.com/health        # expect {"status":"ok","environment":"production"}
```

---

## Environments

| pm2 app | Port | Env file | Status |
|---------|------|----------|--------|
| `ma-learn-dashboard-prod`    | 3402 | `/etc/ma-learn-dashboard/.env.production` | **online** |
| `ma-learn-dashboard-staging` | 3401 | `/etc/ma-learn-dashboard/.env.staging`    | stopped (rollback) |

Sheet split (both envs):
- `SHEET_ID` = Token Pool `1nkrwK-KJ7nD2kv_8zdYiLqot6RFoH-v67VpmjCzvYi0` — shared business data (Tokens, Lessons, Customers, Coupons, Newsletters, Subscribers)
- `SHEET_ID_ADMIN` = `17OXBVq8XBXDWUY7Zh88MTycqMYJA8zYRtGSk9WE08QI` — dashboard-owned tabs (EmailTemplates, LinkInBio, LinkInBioHeader, AuditLog)

---

## Rollback

### Revert a bad deploy (single commit)

```bash
cd ~/code/ma-learn-dashboard
git revert <sha> && git push origin main
# backend: rebuild + rsync + pm2 restart as above
```

### Full rollback to pre-redesign (nuclear)

Both frontend and backend have git tag `pre-redesign-2026-04-23`:

```bash
cd ~/code/ma-learn-dashboard
git checkout pre-redesign-2026-04-23 -- .
git commit -m "rollback to pre-redesign snapshot"
git push origin main
# backend: rebuild + rsync + pm2 restart
```

Tarball fallback (if GitHub access is gone): `archives/redesign-2026-04-23/ma-learn-dashboard.tar.gz` in the MA EA repo.

### Reactivate staging

```bash
ssh root@46.101.151.237 'pm2 start ma-learn-dashboard-staging && pm2 save'
```

DNS records for `admin-staging.malearnsa.com` + `api-staging.malearnsa.com` should still exist at the registrar.

---

## Logs

```bash
ssh root@46.101.151.237 'pm2 logs ma-learn-dashboard-prod --lines 100 --nostream'
ssh root@46.101.151.237 'pm2 logs ma-learn-dashboard-prod --err --lines 50 --nostream'
```

Caddy access logs: `journalctl -u caddy -f`

---

## Secrets

Droplet env files live at `/etc/ma-learn-dashboard/.env.{staging,production}`. `chmod 600`, root-only.

To rotate any key:
1. Update the env file: `ssh root@… 'vi /etc/ma-learn-dashboard/.env.production'`
2. Restart: `pm2 restart ma-learn-dashboard-prod --update-env`

---

## GitHub Pages

- Repo: `Majidangawi/ma-learn-dashboard`
- Branch: `main`
- Custom domain: `admin.malearnsa.com` (HTTPS enforced)
- The `frontend/public/CNAME` file mirrors the Pages setting. Both must match.

To change the custom domain (e.g. future rollback to staging subdomain):

```bash
curl -X PUT -H "Authorization: token <PAT>" -H "Accept: application/vnd.github+json" \
  https://api.github.com/repos/Majidangawi/ma-learn-dashboard/pages \
  -d '{"cname":"admin.malearnsa.com","https_enforced":true}'
```

And update `frontend/public/CNAME` in a commit.

---

## Google OAuth

Client ID `362548158836-mf7tr923ok443ndkh2kb14aeag7lrk3n.apps.googleusercontent.com`.

Authorized origins:
- https://admin.malearnsa.com (prod)
- https://admin-staging.malearnsa.com (rollback)

Authorized redirect URIs:
- https://api.malearnsa.com/api/auth/google/callback
- https://api-staging.malearnsa.com/api/auth/google/callback

Allowed admin email (the only account that can sign in): `majid@malearnsa.com`.

---

## Cutover notes (2026-04-23)

- `frontend/public/CNAME` flipped `admin-staging` → `admin.malearnsa.com`
- Pages API `PUT` updated repo Pages config to match + enforced HTTPS
- `.env.production` copied from `.env.staging` with fresh JWT_SECRET, `NODE_ENV=production`, `PORT=3402`, `FRONTEND_ORIGIN=https://admin.malearnsa.com`
- Caddy vhost `api.malearnsa.com { reverse_proxy 127.0.0.1:3402 }` added + reloaded
- `ma-learn-dashboard-prod` pm2 app started; `ma-learn-dashboard-staging` stopped (still installed)
- DNS: `admin.malearnsa.com` CNAME → `Majidangawi.github.io`; `api.malearnsa.com` A → `46.101.151.237`
- Pre-cutover snapshot: git tag `pre-redesign-2026-04-23` on all three repos + tarballs in `archives/redesign-2026-04-23/`
