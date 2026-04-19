# Wake-up checklist — Plan 2 handoff

All 23 code-side tasks complete. 91/91 backend tests pass. `npm run build` green.
Frontend pushed to GH Pages staging via `main`. MA EA repo push triggers nothing automatic.

Commits landed: 23 on `ma-learn-dashboard` repo (main), 1 on MA EA repo (Code.js).

## What you need to do (in order)

### 1. Create tabs on the STAGING Sheet (Task 1)

Open staging `MA Learn Token Pool (STAGING)` as `majid@malearnsa.com`.

- Extend `Coupons` tab: add columns I–L = `Products | CreatedAt | CreatedBy | Scope`. Backfill existing rows: `Products=all`, `CreatedAt=2026-04-01T00:00:00`, `CreatedBy=legacy`. **Do NOT reorder A–H** — the live `validate_coupon` reads by column index.
- Create new tab `LinkInBio`. Headers row A1: `LinkID | TitleAR | TitleEN | URL | Icon | Description | Active | Order | ClickCount`
- Create new tab `LinkInBioHeader`. Headers: `Key | Value`. Seed three rows:
  - `PhotoURL | https://majidangawi.com/me.jpg`
  - `TaglineAR | مجيد عنقاوي — صناعة الإلهام`
  - `TaglineEN | Majid Angawi — Making Inspiration`
- Create new tab `EmailTemplates`. Headers: `TemplateID | Name | SubjectAR | SubjectEN | BodyAR | BodyEN | Variables`. Seed 3 rows from your M4/M5/M6 unlock copy in `projects/ma-learn-launch/t3-announcement-copy.txt`.
- Create new tab `NoorActions`. Headers: `ActionID | RequestedAt | Prompt | Plan | ApprovedAt | ExecutedAt | Result | Status`
- (`AuditLog` already exists from Plan 1)

### 2. Push the Apps Script and re-deploy (Task 3)

```bash
cd "/Users/mastudio/MA Photography Dropbox/MA Creative Studio/MA Ai/Claude AI/MA EA/projects/ma-learn-launch/apps-script/token-validator"
cat .clasp.json  # verify scriptId matches STAGING project
clasp push
```

Then in the staging Apps Script web UI:
- Deploy → Manage Deployments → ✏️ pencil on the existing live deployment → Version: "New version" → Description: "Plan 2 admin endpoints" → Deploy
- **URL must NOT change.** Confirm.

Smoke test:
```bash
curl -s -L -X POST "<STAGING_APPS_SCRIPT_URL>" \
  -d "action=admin_toggle_lesson" -d "admin_token=MAL-ADMIN-2026" \
  -d "lesson_id=NONEXISTENT" -d "active=TRUE"
```
Expected: `{"ok":false,"error":"lesson_not_found"}`. If so, gate works.

### 3. Redeploy the staging backend on the droplet

```bash
ssh root@46.101.151.237
cd /var/www/ma-learn-dashboard
git pull
cd backend
npm install
npm run build
# add APPS_SCRIPT_ADMIN_TOKEN to env file (matches ADMIN_TOKEN constant in Code.js)
grep -q APPS_SCRIPT_ADMIN_TOKEN /etc/ma-learn-dashboard/.env.staging || echo "APPS_SCRIPT_ADMIN_TOKEN=MAL-ADMIN-2026" >> /etc/ma-learn-dashboard/.env.staging
pm2 reload ma-learn-dashboard-staging
pm2 status
curl -s https://api-staging.malearnsa.com/health
```

Expected: `{"status":"ok","environment":"staging"}`.

### 4. Smoke test staging end-to-end

Go to `https://admin-staging.malearnsa.com`:

1. Login works (red STAGING badge)
2. Home → 9 KPIs render, revenue chart draws, T3 seats progress visible
3. #lessons → lessons grouped by course+module; toggle a test lesson → approval modal → approve → AuditLog row added
4. #coupons → existing rows visible; + New coupon → preview → approve → new row in Sheet
5. #emails → templates list visible (from step 1 seed); pick template + segment → preview shows 3 samples → approve (test inbox)
6. #linkbio → add link → approve → public page `link-staging.malearnsa.com` shows it → click → counter increments
7. #noor → "list customers this month" → auto-executed plan with data

All in AuditLog. All gated by approval.

### 5. After 48h soak (Task 21)

When staging has been used cleanly for 48h, follow `docs/promotion-runbook.md` for production promotion. The runbook covers Sheet → Apps Script → backend → Cloudflare Pages → smoke test → rollback.

## What's different from the plan

- `APPS_SCRIPT_ADMIN_TOKEN` is `default('dev-token-not-set')` in config.ts so Plan-1 tests boot without it. The real token MUST be set in `.env.staging` and `.env.production`.
- `dataRoutes` and `writesRoutes` are conditional: they only register if `SHEET_ID` (and `APPS_SCRIPT_URL`) are set. Tests without those env vars still pass.
- Plan-1 tests were NOT retroactively updated — they still pass as-is.

## Backend test count
91/91 passing across 21 test files (up from Plan 1's 46/46).
