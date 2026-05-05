#!/usr/bin/env bash
# neuer-shop.sh
# Legt ein neues privates GitHub-Repo an und initialisiert das Shopify Skeleton-Theme darin.
#
# Aufruf:
#   GITHUB_TOKEN=ghp_xxx ./neuer-shop.sh <repo-name> ["optional description"]
#
# Voraussetzungen:
#   - git, curl, node/npm
#   - @shopify/cli @shopify/theme   (npm install -g @shopify/cli @shopify/theme)
#   - GITHUB_TOKEN: Fine-grained PAT mit "Administration: Read and write" Scope

set -euo pipefail

# ---------- Farben für Output ----------
RED=$'\033[0;31m'
GREEN=$'\033[0;32m'
YELLOW=$'\033[1;33m'
BLUE=$'\033[0;34m'
NC=$'\033[0m'

err()  { echo "${RED}✗ $*${NC}" >&2; }
ok()   { echo "${GREEN}✓ $*${NC}"; }
info() { echo "${BLUE}→ $*${NC}"; }
warn() { echo "${YELLOW}! $*${NC}"; }

# ---------- Argumente ----------
REPO_NAME="${1:-}"
REPO_DESC="${2:-Shopify theme based on official Skeleton theme}"

if [[ -z "$REPO_NAME" ]]; then
  err "Repo-Name fehlt. Aufruf: $0 <repo-name> [\"description\"]"
  exit 1
fi

# Validierung: nur a-z 0-9 - _
if ! [[ "$REPO_NAME" =~ ^[a-zA-Z0-9._-]+$ ]]; then
  err "Repo-Name '$REPO_NAME' enthält ungültige Zeichen. Erlaubt: a-z A-Z 0-9 . _ -"
  exit 1
fi

# ---------- Token-Check ----------
if [[ -z "${GITHUB_TOKEN:-}" ]]; then
  err "GITHUB_TOKEN ist nicht gesetzt."
  echo "   Setze ein Fine-grained PAT mit 'Administration: Read and write' Scope für Repositories."
  echo "   Beispiel: export GITHUB_TOKEN=github_pat_xxx"
  exit 1
fi

# ---------- Tool-Checks ----------
need_tool() {
  if ! command -v "$1" >/dev/null 2>&1; then
    err "Tool '$1' nicht gefunden. $2"
    exit 1
  fi
}

need_tool git    "Installiere git und versuch's nochmal."
need_tool curl   "Installiere curl und versuch's nochmal."
need_tool node   "Installiere Node.js und versuch's nochmal."
need_tool npm    "Installiere npm und versuch's nochmal."
need_tool shopify "Installiere die Shopify CLI: npm install -g @shopify/cli @shopify/theme"

# ---------- GitHub-User aus Token ermitteln ----------
info "Hole GitHub-Username via API..."
GH_USER_JSON=$(curl -fsSL \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  https://api.github.com/user 2>/dev/null) || {
    err "GitHub-API-Aufruf fehlgeschlagen. Token ungültig oder Netzwerkproblem?"
    exit 1
  }

GH_USER=$(echo "$GH_USER_JSON" | sed -n 's/.*"login":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

if [[ -z "$GH_USER" ]]; then
  err "Konnte GitHub-Username nicht aus API-Antwort extrahieren."
  echo "$GH_USER_JSON" | head -c 500 >&2
  exit 1
fi

ok "Authentifiziert als: $GH_USER"

# ---------- Repo bereits vorhanden? ----------
info "Prüfe ob Repo '$GH_USER/$REPO_NAME' schon existiert..."
EXISTS_CODE=$(curl -s -o /dev/null -w "%{http_code}" \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  "https://api.github.com/repos/$GH_USER/$REPO_NAME")

if [[ "$EXISTS_CODE" == "200" ]]; then
  err "Repo '$GH_USER/$REPO_NAME' existiert bereits."
  echo "   Wähle einen anderen Namen oder lösche das alte Repo zuerst."
  exit 1
fi

# ---------- Repo erstellen ----------
info "Lege neues privates Repo '$REPO_NAME' an..."

CREATE_PAYLOAD=$(cat <<EOF
{
  "name": "$REPO_NAME",
  "description": "$REPO_DESC",
  "private": true,
  "auto_init": false
}
EOF
)

CREATE_RESP=$(curl -fsSL -X POST \
  -H "Authorization: Bearer $GITHUB_TOKEN" \
  -H "Accept: application/vnd.github+json" \
  -H "X-GitHub-Api-Version: 2022-11-28" \
  -H "Content-Type: application/json" \
  -d "$CREATE_PAYLOAD" \
  https://api.github.com/user/repos) || {
    err "Repo-Erstellung fehlgeschlagen. Token-Scope korrekt? (braucht Administration: Read and write)"
    exit 1
  }

REPO_HTML_URL=$(echo "$CREATE_RESP" | sed -n 's/.*"html_url":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)
REPO_SSH_URL=$(echo "$CREATE_RESP" | sed -n 's/.*"ssh_url":[[:space:]]*"\([^"]*\)".*/\1/p' | head -n1)

ok "Repo angelegt: $REPO_HTML_URL"

# ---------- Skeleton-Theme via Shopify CLI initialisieren ----------
info "Initialisiere Skeleton-Theme via Shopify CLI..."

# Shopify CLI legt einen Ordner mit dem Namen an
if [[ -d "$REPO_NAME" ]]; then
  err "Lokales Verzeichnis '$REPO_NAME' existiert bereits. Bitte vorher entfernen oder umbenennen."
  exit 1
fi

shopify theme init "$REPO_NAME" --clone-url https://github.com/Shopify/skeleton-theme || {
  err "shopify theme init fehlgeschlagen."
  warn "Tipp: ggf. CLI updaten ('npm update -g @shopify/cli @shopify/theme')"
  exit 1
}

ok "Skeleton-Theme initialisiert in ./$REPO_NAME"

# ---------- Git-Setup und Push ----------
cd "$REPO_NAME"

# Stelle sicher, dass es ein frisches Git-Repo ist
if [[ -d .git ]]; then
  info ".git bereits vorhanden — behalte"
else
  info "Initialisiere git..."
  git init -q
fi

git add .
git -c user.email="bot@local" -c user.name="neuer-shop" commit -q -m "Initial commit: Shopify Skeleton theme" || {
  warn "Commit fehlgeschlagen oder nichts zu committen — fahre fort"
}

git branch -M main 2>/dev/null || true

# HTTPS-Remote mit Token (für initialen Push), danach umstellen auf SSH wenn vorhanden
HTTPS_REMOTE="https://${GH_USER}:${GITHUB_TOKEN}@github.com/${GH_USER}/${REPO_NAME}.git"
git remote remove origin 2>/dev/null || true
git remote add origin "$HTTPS_REMOTE"

info "Pushe initial commit nach origin/main..."
git push -u origin main -q || {
  err "Push fehlgeschlagen. Token-Scope erlaubt push? Repo wurde aber angelegt."
  exit 1
}

ok "Push erfolgreich."

# Token aus Remote-URL entfernen (Sicherheit)
git remote set-url origin "https://github.com/${GH_USER}/${REPO_NAME}.git"
info "Token aus Remote-URL entfernt. Nutzer kann später auf SSH umstellen mit:"
echo "    git remote set-url origin git@github.com:${GH_USER}/${REPO_NAME}.git"

# ---------- Zusammenfassung ----------
echo
ok "═══════════════════════════════════════════════════════"
ok "  Neuer Shop bereit!"
ok "═══════════════════════════════════════════════════════"
echo "  Repo:           $REPO_HTML_URL"
echo "  Lokal:          $(pwd)"
echo "  Branch:         main"
echo "  Theme-Basis:    Shopify/skeleton-theme (offiziell)"
echo
info "Nächste Schritte:"
echo "  cd $REPO_NAME"
echo "  shopify theme dev      # Lokaler Dev-Server gegen einen Store"
echo "  shopify theme push     # Theme zum Store pushen"
echo
warn "Sicherheit: Bitte das verwendete PAT widerrufen, sobald nicht mehr nötig:"
echo "  → https://github.com/settings/tokens"
