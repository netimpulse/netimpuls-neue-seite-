# Skill installieren: `neuer-shop`

Dieser Skill legt für ein neues Shopify-Theme-Projekt automatisch ein privates GitHub-Repo an und initialisiert darin das offizielle Shopify Skeleton-Theme.

## Inhalt des Pakets

```
neuer-shop/
├── SKILL.md              # Haupt-Skill-Anleitung (was Claude tut, wann)
├── INSTALL.md            # Diese Datei
└── scripts/
    └── neuer-shop.sh     # Helper-Bash-Script (macht die Arbeit)
```

## Voraussetzungen (lokal auf deinem Rechner)

Vor der ersten Nutzung sollten diese Tools installiert sein:

```bash
# git und curl sind meistens schon da; falls nicht, über deinen Paketmanager nachinstallieren

# Node.js (falls noch nicht installiert): https://nodejs.org

# Shopify CLI inkl. Theme-Plugin
npm install -g @shopify/cli @shopify/theme
```

Test:
```bash
shopify version          # sollte eine Versionsnummer zeigen
git --version
curl --version
```

## GitHub Personal Access Token (PAT)

Der Skill braucht ein **Fine-grained PAT** mit folgenden Scopes:

- **Repository access:** "All repositories" oder gezielt "Only select repositories" (für neue Repos: "All", da das Repo noch nicht existiert)
- **Permissions → Repository permissions:**
  - `Administration`: **Read and write** (zum Anlegen)
  - `Contents`: **Read and write** (zum Pushen)
  - `Metadata`: Read (automatisch)

PAT erstellen unter: https://github.com/settings/tokens?type=beta

**Empfehlung:** Setze "Expiration" auf 1 Tag oder "Custom" mit kurzem Zeitraum, und widerrufe das Token nach der Session unter https://github.com/settings/tokens

## Skill installieren in Cowork

Kopiere den gesamten `neuer-shop/`-Ordner in dein Skills-Verzeichnis. Auf Windows liegt das typischerweise unter:

```
C:\Users\<DeinUser>\AppData\Roaming\Claude\local-agent-mode-sessions\skills-plugin\<...>\skills\
```

Oder du verwendest die Cowork-UI: **Customize → Skills → "+"** und lädst den Ordner / die SKILL.md hoch (je nach UI-Version).

Nach Neustart der Cowork-Session sollte `neuer-shop` in der Skill-Liste erscheinen.

## Helper-Script ausführbar machen

```bash
chmod +x neuer-shop/scripts/neuer-shop.sh
```

(Auf Windows in WSL oder Git Bash — pures CMD/PowerShell läuft Bash nicht; dann brauchst du WSL.)

## Aufrufen

In Cowork:

```
/neuer-shop kunde-mueller-shop
```

Oder ohne Namen — Claude fragt dann nach:

```
/neuer-shop
```

Oder natürlich:

```
"Leg mir einen neuen Shopify-Shop an, Repo soll 'demo-store' heißen.
Mein PAT ist: github_pat_..."
```

## Was passiert dann

1. Claude prüft, ob Repo-Name + Token vorhanden sind. Wenn nein → fragt nach.
2. Claude führt `scripts/neuer-shop.sh <repo-name>` aus, mit `GITHUB_TOKEN` als env var.
3. Das Script:
   - Holt deinen GitHub-Username via API
   - Legt das private Repo an
   - Klont Skeleton-Theme via Shopify CLI (`shopify theme init --clone-url ...`)
   - Erstellt initial commit
   - Pusht nach `main`
   - Entfernt das Token aus der Remote-URL (Sicherheit)
4. Du bekommst die Repo-URL und kannst lokal weiterarbeiten.

## Manuelles Testen ohne Skill

Wenn du das Script erstmal ohne Cowork-Skill testen willst:

```bash
export GITHUB_TOKEN=github_pat_xxx
./neuer-shop/scripts/neuer-shop.sh mein-test-shop "Erstes Test-Theme"
```

## Sicherheits-Hinweise

- Tokens **nie** in Git-Configs oder Logs schreiben. Das Script entfernt das Token aktiv aus der Remote-URL nach dem Push.
- Wenn du das Token im Cowork-Chat einfügst, landet es im Konversationsverlauf. Nutze deshalb nur kurzlebige Tokens und widerrufe sie sofort nach Gebrauch.
- Falls du regelmäßig neue Shops anlegst, denk über einen "Burner"-PAT-Workflow nach: jedes Mal frischen Token, sofort wegschmeißen.

## Wenn was schiefgeht

| Fehler | Wahrscheinliche Ursache | Lösung |
|---|---|---|
| `GITHUB_TOKEN ist nicht gesetzt` | Token nicht übergeben | `export GITHUB_TOKEN=...` oder im Skill-Prompt mitgeben |
| `Repo existiert bereits` | Name kollidiert | Anderen Namen wählen |
| `Token-Scope korrekt?` | PAT hat zu wenig Rechte | Fine-grained PAT mit `Administration: Read and write` neu erstellen |
| `shopify theme init fehlgeschlagen` | CLI fehlt oder veraltet | `npm install -g @shopify/cli @shopify/theme` |
| `Push fehlgeschlagen` | Auth-Problem oder Netzwerk | Token-Scope `Contents: Read and write` prüfen |
