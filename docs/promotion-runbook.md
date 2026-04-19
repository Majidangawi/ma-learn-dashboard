# MA Learn Dashboard — Production Promotion Runbook

## Pre-promotion (T-24h)

1. 48h staging soak completed (Plan 2 Task 21)
2. No uncommitted changes on `main`
3. Production Sheet is backed up — File → Version history → name current version "Pre-Plan2-Promotion"
4. Production Apps Script deployment ID recorded
5. Current `ma-learn-dashboard-staging` process on droplet is healthy: `pm2 status` green, `curl https://api-staging.malearnsa.com/health` returns env `staging`

## Promotion sequence (T=0)

1. **Sheet** — Task 22: extend prod Coupons tab with columns I–L, create `LinkInBio`, `LinkInBioHeader`, `EmailTemplates`, `AuditLog`, `NoorActions` tabs. Do NOT seed. Do NOT reorder existing Coupons columns A–H.
2. **Apps Script** — Task 23: copy staging `Code.js` (including the Plan 2 admin endpoints at the end) into the PROD `token-validator` project. Rotate `ADMIN_TOKEN` to a NEW prod-only value. Deploy via "Manage Deployments → Edit existing deployment → New Version" (never "New Deployment" — URL must not change).
3. **Backend** — Task 24:
   - On droplet, write `/etc/ma-learn-dashboard/.env.production` (chmod 600) with prod values. `PORT=3400`, `NODE_ENV=production`, fresh `BACKEND_OAUTH_REFRESH_TOKEN`, new `JWT_SECRET`, new `APPS_SCRIPT_ADMIN_TOKEN` (matches step 2), `SHEET_ID=1nkrwK-KJ7nD2kv_8zdYiLqot6RFoH-v67VpmjCzvYi0`, `FRONTEND_ORIGIN=https://admin.malearnsa.com`
   - `cd /var/www/ma-learn-dashboard && git pull && cd backend && npm install && npm run build`
   - `pm2 startOrReload ecosystem.config.cjs && pm2 save`
   - Extend Caddyfile with `api.malearnsa.com { reverse_proxy localhost:3400 }` → `systemctl reload caddy`
   - Verify `curl https://api.malearnsa.com/health` returns `{"status":"ok","environment":"production"}`
4. **Frontend** — Task 25: deploy prod frontend. Option A: Cloudflare Pages connected to `pages-prod` branch with two custom domains `admin.malearnsa.com` and `link.malearnsa.com`, build-time sed replaces `__GOOGLE_OAUTH_CLIENT_ID__` and `__APPS_SCRIPT_URL__`. Option B: second GitHub Pages deploy from a `pages-prod` branch of a mirror repo. Cloudflare Pages preferred.
5. **Smoke test** — Task 26 step 1: run the 8-point smoke checklist below.

## Smoke test checklist

On `admin.malearnsa.com` in a NEW browser session (no cached staging session):

1. `curl -s https://api.malearnsa.com/health` → `{"status":"ok","environment":"production"}`
2. Login: Google Sign-In → password → lands on Home
3. Home: KPIs show real numbers, revenue month-to-date > 0 (T3 launched Apr 15), T3 seats filled matches Customers sheet count
4. Lessons: load → toggle ONE non-critical test lesson. Verify AuditLog row appended. Toggle back.
5. Coupon: create `TEST_PROMO_DELETE` 10% off 1-use-cap. Verify row in prod Coupons. Test validate on a real checkout page. Then deactivate via dashboard.
6. Drip email: add a test EmailTemplates row with `{name}` only. Send to a segment of exactly ONE real buyer (e.g., Majid's own address via a custom single-target segment). Verify delivery.
7. Link-in-bio: add one real link → visit `link.malearnsa.com` → click → verify counter increment in prod Sheet.
8. Noor: "list customers this month" → read plan auto-executed with data → `/api/noor/cost` MTD increments.

## Rollback

If any smoke test step fails:

- **Frontend:** in Cloudflare Pages, revert to previous deployment (one click). Or redirect DNS back to staging temporarily.
- **Backend:** `pm2 stop ma-learn-dashboard-prod`. Service offline until fixed. Staging unaffected.
- **Caddy:** comment out the `api.malearnsa.com` block and reload — users get DNS-level failure instead of malformed responses.
- **Sheet:** File → Version history → restore "Pre-Plan2-Promotion".
- **Apps Script:** Manage Deployments → edit → revert version selector to previous. URL unchanged throughout.
- **Staging:** remains untouched. Continue to use staging while investigating prod issue.

Fix root cause on staging first. Re-run smoke test on staging. Only then re-promote.

## Post-promotion validation (T+1h)

- Check prod `AuditLog` — no unexpected rows
- Check prod `/api/noor/cost` MTD USD < $5 (from smoke test use only)
- Caddy access logs: no 5xx spike on `api.malearnsa.com`
- `pm2 status` — both apps online, no restarts since promotion
- Record deployment in `decisions/log.md` of the MA EA repo
