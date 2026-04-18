#!/bin/bash
# Deploys the dashboard backend to the droplet staging slot.
# Builds TypeScript LOCALLY (droplet is 1GB — tsc OOMs there) and ships the
# compiled dist/ + package manifests. Droplet runs only `npm install --omit=dev`.
set -euo pipefail

REPO_DIR="$HOME/code/ma-learn-dashboard"
DROPLET="root@46.101.151.237"
REMOTE_DIR="/var/www/ma-learn-dashboard"

if [ ! -d "$REPO_DIR/backend" ]; then
  echo "Expected $REPO_DIR/backend to exist. Aborting."
  exit 1
fi

echo "→ Build backend locally…"
(cd "$REPO_DIR/backend" && npm run build)

echo "→ Rsync dist/ + manifests to droplet…"
ssh "$DROPLET" "mkdir -p $REMOTE_DIR/backend"
rsync -avz --delete \
  "$REPO_DIR/backend/dist/" "$DROPLET:$REMOTE_DIR/backend/dist/"

# Ship minimal files needed to install prod deps + run pm2
scp "$REPO_DIR/backend/package.json" \
    "$REPO_DIR/backend/ecosystem.config.cjs" \
    "$DROPLET:$REMOTE_DIR/backend/"
scp "$REPO_DIR/package.json" "$REPO_DIR/package-lock.json" "$DROPLET:$REMOTE_DIR/"

echo "→ Install prod deps + (re)start via pm2…"
ssh "$DROPLET" bash -s <<'REMOTE'
set -euo pipefail
cd /var/www/ma-learn-dashboard
npm install --omit=dev --workspaces 2>&1 | tail -3
cd backend
if pm2 describe ma-learn-dashboard-staging >/dev/null 2>&1; then
  pm2 reload ecosystem.config.cjs --only ma-learn-dashboard-staging --update-env
else
  pm2 start ecosystem.config.cjs --only ma-learn-dashboard-staging
fi
pm2 save
pm2 status ma-learn-dashboard-staging
REMOTE

echo ""
echo "→ Done. Verify: curl https://api-staging.malearnsa.com/health"
