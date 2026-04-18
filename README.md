# MA Learn Store Ops Dashboard

Backend: Fastify + TypeScript on droplet. Frontend: static HTML/JS on GitHub Pages.
See `docs/superpowers/specs/2026-04-18-ma-ea-dashboard-design.md` in the MA EA repo for the full design.

## Environments
- Staging: `admin-staging.malearnsa.com` → droplet `:3401` (NODE_ENV=staging)
- Production: `admin.malearnsa.com` → droplet `:3400` (NODE_ENV=production) — Plan 2

## Dev
cd backend && npm install && npm test
