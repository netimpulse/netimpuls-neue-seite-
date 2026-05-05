---
name: neuer-shop
description: Legt ein neues privates GitHub-Repository an und richtet darin Shopifys offizielles Skeleton-Theme als Basis für ein neues Shopify-Theme-Projekt ein. Use this skill whenever the user wants to start a new Shopify shop, create a new Shopify theme project, set up a new theme repo, scaffold a Shopify storefront, or invokes /neuer-shop. Trigger auch bei Phrasen wie "neuen shop anlegen", "neues shopify projekt", "shop repo erstellen", "theme starten", oder ähnlichen Anfragen, selbst wenn das Wort "Skeleton" nicht fällt.
---

# Neuer Shop — Skill

Dieser Skill legt für ein neues Shopify-Theme-Projekt automatisch das gesamte Setup an: privates GitHub-Repo + offizielles Shopify Skeleton-Theme als Codebase + erster Push.

## Wann triggern

Aktiviere diesen Skill, wenn der Nutzer:

- den Befehl `/neuer-shop` benutzt
- einen neuen Shopify-Shop / Theme / Store / Storefront-Basis aufsetzen will
- ein neues Repo für ein Theme-Projekt anlegen will
- sinngemäß "fang ein neues Shopify-Projekt an" sagt

Auch wenn der Nutzer das Wort "Skeleton" nicht erwähnt, ist das hier der korrekte Skill — Skeleton ist ab 2026 die offiziell empfohlene Theme-Store-Codebase.

## Was der Skill braucht (Inputs)

1. **Repo-Name** — kebab-case empfohlen (z. B. `kunde-mueller-shop`).
   - Wenn der Nutzer den Namen schon im Prompt nennt (z. B. `/neuer-shop kunde-mueller-shop`), nimm ihn.
   - **Wenn nicht: zuerst nach dem Namen fragen** (per AskUserQuestion-Tool wenn verfügbar, sonst inline). Erst danach weitermachen.

2. **GitHub Personal Access Token (PAT)** — wird vom Nutzer "immer mitgeliefert".
   - Erwarte das Token im Prompt, in einer Konversationsvariable, oder als Umgebungsvariable `GITHUB_TOKEN`.
   - **Wenn das Token fehlt: nach dem Token fragen**, mit dem Hinweis dass es ein Fine-grained PAT mit Scope `Administration: Read and write` (Repositories) sein sollte.
   - **Sicherheitshinweis an den Nutzer:** Tokens im Chat sind sensibel. Empfehle kurze Lebensdauer und sofortiges Widerrufen nach Gebrauch.

3. **Optional: Description** — kurze Beschreibung des Repos, falls der Nutzer eine mitgibt.

## Was der Skill tut (Workflow)

Führe das Helper-Script `scripts/neuer-shop.sh` aus. Es macht genau folgendes, in dieser Reihenfolge:

1. **Validierung**
   - Prüft, dass `gh` ODER `curl` verfügbar ist (für API-Call)
   - Prüft, dass `shopify` CLI installiert ist (`@shopify/cli @shopify/theme`)
   - Prüft, dass `git` verfügbar ist
   - Prüft, dass das Token gesetzt ist

2. **GitHub-Repo anlegen** (privat, persönlicher Account)
   ```
   POST https://api.github.com/user/repos
   { "name": "<repo-name>", "private": true, "description": "<description>" }
   ```

3. **Skeleton-Theme initialisieren** über die offizielle Shopify-CLI:
   ```
   shopify theme init <repo-name> --clone-url https://github.com/Shopify/skeleton-theme
   ```
   Die CLI klont das Skeleton-Theme, entfernt die Git-Historie und legt ein sauberes Verzeichnis an.

4. **Git-Setup**
   - `cd <repo-name>`
   - `git init` (falls die CLI das nicht selbst macht)
   - `git add .`
   - `git commit -m "Initial commit: Shopify Skeleton theme"`
   - `git branch -M main`
   - `git remote add origin git@github.com:<user>/<repo-name>.git` (oder HTTPS mit Token)
   - `git push -u origin main`

5. **Bestätigung**
   - Repo-URL ausgeben (https://github.com/<user>/<repo-name>)
   - Lokales Verzeichnis ausgeben
   - Hinweis: `cd <repo-name> && shopify theme dev` zum Starten

## Fehlerfälle (wichtig zu behandeln)

- **Repo existiert schon (HTTP 422)** — Frage Nutzer, ob er einen anderen Namen will oder das existierende Repo überschreiben möchte (Letzteres: vorher `gh repo delete` mit Bestätigung — Token braucht `delete_repo` Scope).
- **Token ungültig (HTTP 401)** — Klare Fehlermeldung mit Hinweis auf Token-Scopes.
- **Shopify CLI fehlt** — Installations-Befehl vorschlagen: `npm install -g @shopify/cli @shopify/theme`
- **Push schlägt fehl wegen SSH-Key** — Auf HTTPS-Push mit Token zurückfallen.

## Aufruf-Beispiele

**Mit Name im Prompt:**
> "/neuer-shop kunde-mueller-shop"

→ Direkt durchziehen, nur noch Token einfordern falls nicht im Kontext.

**Ohne Name:**
> "/neuer-shop"

→ Erst nach dem Repo-Namen fragen, dann nach Token (falls fehlt), dann ausführen.

**Natürliche Sprache:**
> "Leg mir einen neuen Shopify-Shop für meinen Kunden Müller an"

→ Skill triggert. Repo-Name aus dem Kontext ableiten (z. B. `kunde-mueller-shop`) UND beim Nutzer rückfragen, ob der Name passt, bevor durchgezogen wird.

## Sicherheits-Erinnerungen

- Token niemals in `git config` oder Logs schreiben.
- Wenn HTTPS-Push mit Token in der Remote-URL nötig ist, nach dem Push die Remote auf SSH umstellen oder das Token aus der URL entfernen:
  ```
  git remote set-url origin git@github.com:<user>/<repo-name>.git
  ```
- Den Nutzer am Ende **explizit erinnern**, das PAT zu widerrufen, falls es kurzlebig sein soll.

## Voraussetzungen lokal

Diese Tools müssen auf dem Rechner des Nutzers installiert sein:

- `git`
- `curl` (oder `gh` CLI)
- `node` und `npm`
- `@shopify/cli @shopify/theme` (`npm install -g @shopify/cli @shopify/theme`)

Wenn etwas fehlt: Skill bricht früh mit klarer Anweisung ab, was zu installieren ist.

## Wichtig: Nicht eigenständig clonen

Nutze **immer** `shopify theme init --clone-url`, nicht direkt `git clone https://github.com/Shopify/skeleton-theme`. Beide Wege ziehen aus derselben Quelle, aber die CLI:
- entfernt die Git-Historie sauber
- bereitet das Theme-Verzeichnis korrekt vor
- ist der von Shopify dokumentierte offizielle Workflow

Das ist die Vorgabe des Nutzers und sollte nicht abgewichen werden.
