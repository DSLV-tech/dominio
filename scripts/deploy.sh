#!/usr/bin/env bash
# ─── Pubblica Dominio su Firebase Hosting ─────────────────────────────────────
# Dopo ./scripts/firebase-setup.sh: ricompila il gioco e pubblica la nuova
# versione (e le regole di Firestore, se sono cambiate).
set -euo pipefail
cd "$(dirname "$0")/.."

if [ ! -f .firebaserc ] || [ ! -f .env.local ]; then
  echo "Manca la configurazione Firebase: lancia prima ./scripts/firebase-setup.sh"
  exit 1
fi

npm run build
npx --yes firebase-tools@14 deploy --only firestore:rules,hosting

PROJECT_ID=$(node -e "console.log(require('./.firebaserc').projects.default)")
echo
echo "Pubblicato: https://$PROJECT_ID.web.app"
