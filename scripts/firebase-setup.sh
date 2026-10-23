#!/usr/bin/env bash
# ─── Dominio online: crea il progetto Firebase e pubblica il gioco ────────────
# Da lanciare UNA volta, dal Terminale del Mac, nella cartella del gioco:
#
#   ./scripts/firebase-setup.sh              (crea un progetto nuovo)
#   ./scripts/firebase-setup.sh mio-progetto (usa un progetto che esiste già)
#
# Cosa fa:
#   1. accesso a Google (si apre il browser)
#   2. crea il progetto Firebase "Dominio" (piano gratuito Spark)
#   3. registra l'app web e scrive .env.local con la configurazione
#   4. crea il database Firestore in Europa
#   5. ti fa attivare l'accesso anonimo (un clic nella console)
#   6. pubblica regole di sicurezza e gioco: https://<progetto>.web.app
#
# Per gli aggiornamenti successivi basta ./scripts/deploy.sh
set -euo pipefail
trap 'c=$?; echo; echo "Lo script si è fermato alla riga $LINENO (codice $c). Incolla queste righe a Claude."' ERR
cd "$(dirname "$0")/.."

FB=(npx --yes firebase-tools@14)
bold() { printf '\n\033[1m%s\033[0m\n' "$1"; }
json_get() { node -e "let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{const v=JSON.parse(s);const r=$1;if(r===undefined||r===null)process.exit(1);console.log(r)})"; }

if ! command -v node >/dev/null 2>&1; then
  echo "Serve Node.js (https://nodejs.org). Installalo e rilancia lo script."
  exit 1
fi

# ── 1. Accesso ──────────────────────────────────────────────────────────────
bold "1/6  Accesso a Google"
"${FB[@]}" login

# ── 2. Progetto ─────────────────────────────────────────────────────────────
if [ $# -ge 1 ]; then
  PROJECT_ID="$1"
  bold "2/6  Uso il progetto esistente: $PROJECT_ID"
else
  # (niente `tr </dev/urandom | head`: con pipefail su macOS chiude lo script in silenzio)
  SUFFIX=$(node -e "console.log(require('crypto').randomBytes(3).toString('hex'))")
  PROJECT_ID="dominio-$SUFFIX"
  bold "2/6  Creo il progetto $PROJECT_ID"
  if ! "${FB[@]}" projects:create "$PROJECT_ID" --display-name "Dominio"; then
    echo
    echo "Non sono riuscito a crearlo (capita al primo uso di Firebase: vanno accettati i termini)."
    echo "Apri https://console.firebase.google.com , crea un progetto (Analytics non serve)"
    echo "e rilancia:  ./scripts/firebase-setup.sh <id-del-progetto>"
    exit 1
  fi
fi
printf '{\n  "projects": {\n    "default": "%s"\n  }\n}\n' "$PROJECT_ID" > .firebaserc

# ── 3. App web e .env.local ─────────────────────────────────────────────────
bold "3/6  Registro l'app web e scrivo .env.local"
APP_ID=$("${FB[@]}" apps:list WEB --project "$PROJECT_ID" --json | json_get "(v.result||[]).find(a=>a.displayName==='Dominio')?.appId" || true)
if [ -z "$APP_ID" ]; then
  APP_ID=$("${FB[@]}" apps:create WEB "Dominio" --project "$PROJECT_ID" --json | json_get "v.result.appId")
fi
"${FB[@]}" apps:sdkconfig WEB "$APP_ID" --project "$PROJECT_ID" --json | node -e "
let s='';process.stdin.on('data',d=>s+=d).on('end',()=>{
  const v=JSON.parse(s); const c=(v.result&&(v.result.sdkConfig||v.result))||{};
  const lines=[
    '# Creato da scripts/firebase-setup.sh — non va su git',
    'VITE_FIREBASE_API_KEY='+(c.apiKey||''),
    'VITE_FIREBASE_AUTH_DOMAIN='+(c.authDomain||''),
    'VITE_FIREBASE_PROJECT_ID='+(c.projectId||''),
    'VITE_FIREBASE_APP_ID='+(c.appId||''),
    'VITE_FIREBASE_STORAGE_BUCKET='+(c.storageBucket||''),
    'VITE_FIREBASE_MESSAGING_SENDER_ID='+(c.messagingSenderId||''),
  ];
  if(!c.apiKey){console.error('Configurazione non trovata nella risposta di Firebase.');process.exit(1)}
  require('fs').writeFileSync('.env.local',lines.join('\n')+'\n');
  console.log('.env.local scritto.');
})"

# ── 4. Firestore ────────────────────────────────────────────────────────────
bold "4/6  Creo il database Firestore (Europa)"
if ! "${FB[@]}" firestore:databases:create "(default)" --location eur3 --project "$PROJECT_ID"; then
  echo "(Il database c'è già, oppure va creato a mano: console Firebase → Firestore Database → Crea.)"
fi

# ── 5. Accesso anonimo ──────────────────────────────────────────────────────
bold "5/6  Attiva l'accesso anonimo (serve un clic)"
AUTH_URL="https://console.firebase.google.com/project/$PROJECT_ID/authentication/providers"
echo "Apro: $AUTH_URL"
echo "Lì: «Inizia» (se lo chiede) → «Anonimo» → Attiva → Salva."
open "$AUTH_URL" 2>/dev/null || true
read -r -p "Quando hai fatto premi Invio… " _

# ── 6. Pubblicazione ────────────────────────────────────────────────────────
bold "6/6  Pubblico regole di sicurezza e gioco"
npm run build
"${FB[@]}" deploy --only firestore:rules,hosting --project "$PROJECT_ID"

bold "Fatto!"
echo "Il gioco è online su:  https://$PROJECT_ID.web.app"
echo "Aprilo dal telefono, scegli i giocatori e premi «Online»: manda il link all'amico."
