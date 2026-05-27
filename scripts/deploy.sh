#!/usr/bin/env bash
# scripts/deploy.sh
# Pushes to GitHub and deploys to Hetzner.
# Reads GITHUB_TOKEN and HETZNER_SSH_KEY from .env in project root.
# Run from any directory: bash scripts/deploy.sh

set -e

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_DIR="$(dirname "$SCRIPT_DIR")"
ENV_FILE="$PROJECT_DIR/.env"

# ── Load credentials from .env ────────────────────────────────
if [ ! -f "$ENV_FILE" ]; then
  echo "ERROR: .env not found at $ENV_FILE"
  exit 1
fi

export $(grep -E '^(GITHUB_TOKEN|HETZNER_SSH_KEY)=' "$ENV_FILE" | xargs)

if [ -z "$GITHUB_TOKEN" ]; then
  echo "ERROR: GITHUB_TOKEN not set in .env"
  exit 1
fi

if [ -z "$HETZNER_SSH_KEY" ]; then
  echo "ERROR: HETZNER_SSH_KEY not set in .env"
  exit 1
fi

# ── Write SSH key to temp file ────────────────────────────────
KEY_FILE=$(mktemp)
echo "$HETZNER_SSH_KEY" | base64 -d > "$KEY_FILE"
chmod 600 "$KEY_FILE"
trap "rm -f $KEY_FILE" EXIT

# ── Push to GitHub ────────────────────────────────────────────
echo "Pushing to GitHub..."
cd "$PROJECT_DIR"

REPO="lgbernstein/finance-dashboard"
git remote set-url origin "https://${GITHUB_TOKEN}@github.com/${REPO}.git"
git push origin main
git remote set-url origin "https://github.com/${REPO}.git"

echo "GitHub push done."

# ── Deploy to Hetzner ─────────────────────────────────────────
echo "Deploying to Hetzner..."
ssh -i "$KEY_FILE" \
    -o StrictHostKeyChecking=no \
    -o BatchMode=yes \
    root@5.78.219.36 \
    "cd /var/www/finance-dashboard && git pull origin main && pm2 restart finance-dashboard && echo 'Server restarted.'"

echo "Deploy complete."
