---
name: shopify-liquid
description: >
  Comprehensive Shopify theme development and Liquid templating skill. Covers full theme architecture
  (Dawn OS 2.0 and custom themes), Liquid tags/filters/objects, section schemas, JSON templates,
  Sections Everywhere, Metafields & Metaobjects, Shopify Functions/Extensions, Markets &
  Multilanguage/Multicurrency, modern frontend (Tailwind, Vanilla CSS, responsive design, performance),
  and asset pipeline. Use this skill whenever the user mentions Shopify, Liquid, .liquid files, theme
  development, sections, snippets, Dawn, Online Store 2.0, Shopify CLI, storefront, checkout extensions,
  metafields, or any ecommerce theme work — even if they don't explicitly say "Shopify". Also trigger
  when the user wants to build product pages, collection pages, cart functionality, or any storefront
  UI component that could be part of a Shopify theme.
---

# Shopify Liquid & Modern Theme Development

You are an expert Shopify theme developer producing production-ready code. Every file you write — Liquid templates, section schemas, CSS, JavaScript — is complete, tested-in-mind, and deployable. You build for Online Store 2.0 architecture using JSON templates, Sections Everywhere, and scoped section schemas.

## ⚠️ CRITICAL — File-Writing Method (read first!)

**NEVER write Liquid, JS, or CSS files via Bash heredocs (`cat << EOF`, `cat << 'EOF'`, `echo`, `printf`, etc.).** Bash performs history-expansion on `!`, which silently corrupts every `!=` to `\!=` and every `!` (e.g. `if (!foo)`) to `\!`. The result: *every* `if x != blank` in Liquid throws `Liquid syntax error: Unexpected character \ in "x \!= blank"`, and JS negations become syntax errors. The corrupted files look fine in `cat` output but break the entire theme — sections won't render, blocks won't load.

**Always write theme files using the dedicated `Write` / `Edit` file tools.** They write bytes literally with no shell interpretation. Reserve Bash strictly for: `git`, `ls`, `mv`, `cp`, `grep`, `sed -i` for fixes, and running validation scripts.

If a heredoc is unavoidable for any reason, after writing run:

```bash
grep -rn '\\!' sections/ snippets/ assets/ templates/ layout/
```

If anything matches, fix immediately with:

```bash
find sections snippets assets templates layout -type f \( -name '*.liquid' -o -name '*.js' -o -name '*.json' -o -name '*.css' \) -exec sed -i 's/\\!=/!=/g; s/\\!/!/g' {} +
```

The same trap applies to backticks (`` ` ``), unescaped `$`, and `"` inside double-quoted heredocs. Single-quoted heredocs (`<< 'EOF'`) prevent variable expansion but **do not** prevent history expansion of `!` in interactive bash. Disabling histexpand (`set +H`) is unreliable in non-interactive subshells. Just don't use heredocs for code.

### Mandatory post-write validation

After writing or editing any section, snippet, or template, before committing/pushing, run **both**:

1. JSON schema validation — every `{% schema %}` block parses as JSON, all IDs match `^[a-z][a-z0-9_]*$`, names ≤ 25 chars, no duplicate setting IDs, no `disabled_on`+`enabled_on` together.
2. Liquid structural sanity — balanced `{% %}` and `{{ }}`, every opener (`if`, `unless`, `for`, `case`, `capture`, `form`, `paginate`, `tablerow`, `comment`, `raw`, `style`, `stylesheet`, `javascript`, `schema`) has a matching `end…`, no stray `\!`, no invalid filter syntax (Liquid has **no ternary operator** — `cond | if, a, b` is invalid; use `{% liquid %}` block with `assign`/`if`/`else`).

A failing theme push is far more expensive than two seconds of validation.

## Reference Files

This skill includes detailed reference files. Read the relevant one(s) based on the task:

- **`references/coding-rules.md`** — File-writing method (heredoc trap), Schema JSON rules, ID naming rules, default value rules per type, CSS standards (BEM, scoped CSS), security, common errors. **Read this first whenever writing or reviewing any theme file.**
- **`references/schema-reference.md`** — Complete list of all setting input types with JSON examples and Liquid usage, block types, presets, section groups, visible_if, localization in schema. **Read this when building section schemas from scratch or adding new setting types.**
- **`references/theme-architecture.md`** — OS 2.0 file structure, layout files, JSON templates, metafields/metaobjects, Cart AJAX API, Section Rendering API, predictive search, product form patterns, performance patterns, JS patterns, accessibility patterns. **Read this when building complete sections, working with APIs, or setting up theme architecture.**
- **`references/check-theme.py`** — Pre-commit validator. Run with `python3 references/check-theme.py /path/to/theme` after writing/editing any section, snippet, or template — before `git commit`. Catches schema errors, ID-rule violations, unbalanced Liquid tags, the `\!` bash-heredoc bug, and invalid ternary-style filters.

Read the appropriate reference file(s) before writing code. For complex tasks (building a full section with schema, CSS, and JS), read all three. Always run the validator before pushing.

## Core Principles

### 1. Code Quality & Architecture

Write modular, maintainable, DRY code. Every section is a self-contained unit with its own HTML structure, scoped CSS, JavaScript (if needed), and schema — all in one `.liquid` file (CSS/JS assets as separate files when they don't depend on Liquid settings).

**Liquid fundamentals:**
- Use `{% render %}` exclusively — never `{% include %}`. Pass variables explicitly: `{% render 'product-card', product: product, show_vendor: true %}`
- Use `{% liquid %}` blocks for multi-line logic instead of tag soup
- Use `{%- -%}` whitespace-stripping tags to minimize HTML output size
- Check for `blank` instead of `empty` or `== ""`
- Use `| default:` filter for fallback values instead of if/else chains
- Avoid deeply nested `{% for %}` loops — two levels maximum. Flatten with `| map` or break into snippets
- Document snippet parameters at the top of every snippet file

**⚠️ CRITICAL: No filter chains (`|`) inside named arguments of another filter.**
Liquid's parser does NOT support piping filters within a filter's named argument list. This breaks silently or throws "Expected end_of_string but found comma".

```liquid
{%- comment -%} ❌ BROKEN — `| default:` and `| escape` inside image_tag's named args {%- endcomment -%}
{{ image | image_url: width: 800 | image_tag: alt: image.alt | default: product.title | escape, class: 'my-class' }}

{%- comment -%} ✅ CORRECT — pre-compute with assign, pass clean variable {%- endcomment -%}
{%- assign img_alt = image.alt | default: product.title | escape -%}
{{ image | image_url: width: 800 | image_tag: alt: img_alt, class: 'my-class' }}
```

This applies to ALL filters with named arguments: `image_tag`, `video_tag`, `placeholder_svg_tag`, `stylesheet_tag`, `script_tag`. Whenever a named-arg value needs a filter, use `assign` first.

**Valid `placeholder_svg_tag` names (complete list):**
`collection-1` through `collection-6`, `product-1` through `product-6`, `lifestyle-1`, `lifestyle-2`, `image`, `detailed-apparel-1`, `detailed-apparel-2`, `hero-apparel-1` through `hero-apparel-3`. There is NO `lifestyle-3` or higher — using an invalid name causes "Unknown SVG placeholder" errors.

**⚠️ SVG Icons: `inline_asset_content` existiert NICHT**
`{{ 'icon.svg' | inline_asset_content }}` ist kein gültiger Shopify-Filter. Icons müssen über ein `snippets/icon.liquid`-Snippet gerendert werden: `{%- render 'icon', name: 'menu' -%}`. Das Snippet nutzt `{% case name %}` mit inline SVGs. Siehe `references/coding-rules.md` für Details.

**⚠️ Header-Grid: Exakt 3 direkte Kinder, bewährtes max-width nicht ändern**
Ein CSS-Grid-Header mit 3 Spalten (`auto 1fr auto` oder `1fr auto 1fr`) muss IMMER exakt 3 direkte Kinder haben (`__left`, `__center`, `__right`). Bei `logo_center` werden Logo UND Navigation BEIDE innerhalb von `__center` platziert — niemals ein 4. Kind. Wenn der Header funktioniert, **NIEMALS** `max-width` oder `padding` ändern — bewährte Werte sind `max-width: 1600px` + `padding: 0 clamp(1rem, 3vw, 2rem)`. Siehe `references/coding-rules.md` für das vollständige Muster.

**⚠️ Theme Store Review: Vollständige Lokalisierung (i18n) ist Pflicht**
- Alle Storefront-Texte über `{{ 'key.path' | t }}` — niemals hardcoded
- **AUCH:** `aria-label`, `title`, `alt`, `placeholder` Attribute, Button-Texte, Erfolgsmeldungen, Link-Texte, Mengen-Labels — ALLES über `| t`
- Alle Schema-Labels als `t:`-Keys (`"label": "t:sections.hero.label_heading"`) — niemals hardcoded
- **Preset-Block-Settings** (z.B. `"heading": "Details"`) müssen `t:`-Keys verwenden
- Basis-Sprache MUSS Englisch sein (`en.default.json`, `en.default.schema.json`)
- Weitere Sprachen optional (z.B. `de.json`, `de.schema.json`)

**⚠️ Theme Store Review: `templates/customers/` ist PFLICHT**
- Folgende Templates MÜSSEN existieren: `account.json`, `login.json`, `register.json`, `reset_password.json`, `addresses.json`, `order.json`
- Jedes braucht eine zugehörige Section mit dem passenden Shopify-Formular
- Alle Formulare brauchen `<label>` für jedes Input und lokalisierte Texte

**⚠️ Theme Store Review: product.liquid Pflicht-Anforderungen**
- Block-basiert (title, price, variant_picker, quantity, buy_buttons, description, @app)
- `product.media` statt `product.images` (Video + 3D Pflicht)
- Sold-out-Logik: Button disabled + Text ändern
- Varianten-JS: Preis-Update, URL-Update, Media-Switch
- `<button name="add">` statt `<input type="submit">` — **in JEDER Section/Snippet mit Add-to-Cart**
- `<label>` für alle Form-Inputs — **in JEDER Section: product, cart, search, newsletter, footer**
- `type="number"` für Mengenfeld — **in product UND cart Sections**
- Siehe `references/coding-rules.md` → "Theme Store Review Anforderungen" für alle Details

**⚠️ CRITICAL: Product-Section MUSS nil-Product absichern**
Die Product-Section (`sections/product.liquid`) bekommt das Produkt-Objekt NICHT über ein Schema-Setting, sondern automatisch von der URL (`/products/slug`). Im Customizer ohne echtes Produkt ist `product` nil. Das `{% form 'product', product %}` Tag CRASHED wenn `product` nil ist: `"product form must be given a product"`.

**PFLICHT:** Alle Blocks die `product` oder `current_variant` verwenden MÜSSEN in `{% if has_product %}` gewrapped sein:
```liquid
{%- liquid
  assign has_product = false
  if product != blank and product.title != blank
    assign has_product = true
    assign current_variant = product.selected_or_first_available_variant
  endif
-%}

{%- when 'buy_buttons' -%}
  {%- if has_product -%}
    {%- form 'product', product, id: 'ProductForm' -%}
      ...
    {%- endform -%}
  {%- else -%}
    <button type="button" class="btn btn--primary" disabled>
      {{ 'products.product.add_to_cart' | t }}
    </button>
  {%- endif -%}
```

Betrifft: `buy_buttons` (form-Tag), `price` (render product-price), `variant_picker` (product.options_with_values), `description` (product.description), `share` (product.url), Medien-Galerie (product.media). Nur `quantity`, `custom_text` und `@app` brauchen keinen Product-Check.

**IMMER auch prüfen:** Alle Translation-Keys die in Sections verwendet werden (`{{ 'key' | t }}`) MÜSSEN in `locales/en.default.json` existieren. Fehlende Keys zeigen "Translation missing: en.key.path" im Frontend.

**⚠️ Bilder: IMMER über Shopify Image Pipeline**
- Niemals bare `<img>` Tags — immer `image_url | image_tag` mit `alt`, `loading`, `sizes`, `widths`
- `image_tag` Ausgabe NICHT in ein `<img>` wrappen (erzeugt verschachteltes `<img><img></img>`)
- SVG-Assets die nicht über `image_url` gehen: mindestens `alt`, `loading`, `width`, `height` setzen

**⚠️ Accessibility: Keine inline Event-Handler**
- Niemals `onchange="..."`, `onclick="..."` etc. in HTML-Attributen
- Stattdessen `addEventListener` in separater JS-Datei

**⚠️ CSS: `prefers-reduced-motion` in JEDER Datei mit Transitions/Animations**
- Jede CSS-Datei mit `transition`, `animation`, `@keyframes` MUSS einen `@media (prefers-reduced-motion: reduce)` Block haben

**⚠️ Keine widersprüchliche Farb-Architektur**
- Section mit `color_scheme` Setting darf NICHT gleichzeitig `bg_color`/`text_color`/`accent_color` für denselben Zweck haben

**⚠️ password.liquid braucht `<main id="MainContent">` und Skip-Link**
- Gleiche Accessibility-Anforderungen wie theme.liquid

**⚠️ Demo/Skeleton-Sections entfernen**
- Sections aus dem Skeleton-Theme mit hardcoded Text/shopify.dev Links (z.B. `hello-world.liquid`) MÜSSEN entfernt werden

**⚠️ Mindest-Anforderungen für jede Section**
- `color_scheme` Setting, `padding_top`/`padding_bottom` Range-Settings, mindestens ein Preset
- Cart: `type="number"` + `<label>` auf Mengen-Inputs, Empty-State, AJAX-Update
- Search: `<label>` auf Such-Input, Empty-State bei keinen Ergebnissen

**⚠️ CRITICAL: Cart-Section — NIEMALS als rohes HTML-Table ohne CSS ausliefern**
Die Skeleton-Theme `cart.liquid` ist ein absolutes Minimum (`<table>` + `<input type="text">`) ohne jegliches Styling. Das MUSS immer durch eine vollständige Cart-Section ersetzt werden.

Pflicht-Elemente einer Cart-Section:
1. **Eigene CSS-Datei** (`section-cart.css`) — NIEMALS den Cart ohne dediziertes Stylesheet ausliefern
2. **Zwei-Spalten-Layout** (Desktop): Artikel-Liste links + Sticky Summary-Sidebar rechts (`grid-template-columns: 1fr 380px`)
3. **Jeder Artikel muss enthalten:** Produktbild (über `image_url | image_tag`), Titel als Link, Varianten-Info, Einzelpreis, Quantity-Stepper (+/- Buttons mit `<button type="button">`), Zeilensumme, Remove-Link
4. **Quantity-Input:** `type="number"` (NICHT `type="text"`!), mit zugehörigem `<label>` (kann `visually-hidden` sein), `min="0"`, `name="updates[]"`
5. **Summary-Box:** Zwischensumme (`cart.total_price | money`), Rabatt-Anzeige (`cart.cart_level_discount_applications`), Steuer-/Versandhinweis, Checkout-Button (`name="checkout"`), Update-Button (`name="update"`)
6. **Empty-State:** Wenn `cart.item_count == 0` → Nachricht + "Weiter einkaufen"-Link zu `routes.all_products_collection_url`
7. **Optional:** Bestellnotiz (`<textarea name="note">{{ cart.note }}</textarea>`)
8. **Accessibility:** `<label>` für jeden Input, `aria-label` auf +/- Buttons mit Produktname
9. **`prefers-reduced-motion`** in CSS für alle Transitions

```liquid
{%- comment -%} Cart form MUSS method="post" und action="{{ routes.cart_url }}" haben {%- endcomment -%}
<form action="{{ routes.cart_url }}" method="post">
  {%- for item in cart.items -%}
    {%- comment -%} Quantity: IMMER type="number" + name="updates[]" {%- endcomment -%}
    <input type="number" name="updates[]" value="{{ item.quantity }}" min="0">
    {%- comment -%} Remove: über item.url_to_remove {%- endcomment -%}
    <a href="{{ item.url_to_remove }}">{{ 'cart.remove' | t }}</a>
  {%- endfor -%}
  <button type="submit" name="checkout">{{ 'cart.checkout' | t }}</button>
</form>
```

**Locale-Keys die der Cart braucht** (MÜSSEN in `en.default.json` existieren):
`cart.title`, `cart.empty`, `cart.continue_shopping`, `cart.checkout`, `cart.update`, `cart.remove`, `cart.quantity`, `cart.subtotal`, `cart.taxes_and_shipping`, `cart.note`, `cart.note_placeholder`, `cart.decrease`, `cart.increase`, `cart.headings.product`, `cart.headings.quantity`, `cart.headings.total`

**⚠️ `{% stylesheet %}` und `{% javascript %}` Tags sind DEPRECATED**
Niemals verwenden, besonders nicht in Snippets. Stattdessen: `<style>` Tags oder `{{ 'file.css' | asset_url | stylesheet_tag }}`.

**⚠️ NIEMALS `sed` auf CSS/Liquid/JS-Dateien anwenden**
`sed` kann unbeabsichtigt strukturelle Elemente (schließende `}`, Leerzeilen) zerstören und das gesamte Theme-Styling brechen. Für JEDE Code-Änderung ausschließlich `Write`/`Edit` Tools verwenden.

**⚠️ CRITICAL: Snippets/Liquid-Dateien MÜSSEN vollständig sein — abgeschnittene Dateien crashen ALLES**
Wenn eine Liquid-Datei beim Schreiben abgeschnitten wird (fehlende `{% endif %}`, `{% endfor %}`, `</a>`, etc.), verursacht das einen fatalen Liquid-Error der die **GESAMTE Seite auf 404 fallen lässt** — ohne Fehlermeldung im Customizer. Besonders kritisch bei Snippets die im Header/Footer gerendert werden (z.B. `site-logo.liquid`), weil deren Fehler JEDE Seite killt.

**Nach JEDER Snippet/Section-Erstellung MUSS validiert werden:**
```bash
python3 -c "
import re
with open('snippets/DATEINAME.liquid') as f:
    c = f.read()
for tag in ['if','unless','for','case','capture','form','comment']:
    o = len(re.findall(r'{%-?\s*' + tag + r'[\s%]', c))
    cl = len(re.findall(r'{%-?\s*end' + tag + r'\s*-?%}', c))
    if o > cl: print(f'FEHLER: {tag} hat {o} opens aber nur {cl} closes')
print('OK' if not any(len(re.findall(r'{%-?\s*'+t+r'[\s%]',c)) > len(re.findall(r'{%-?\s*end'+t+r'\s*-?%}',c)) for t in ['if','unless','for','case','capture','form','comment']) else '')
"
```

**⚠️ CRITICAL: Keine doppelten `<meta>` und `<title>` Tags**
`theme.liquid` enthält bereits `<meta charset>`, `<meta viewport>` und `<title>`. Das `meta-tags.liquid` Snippet darf diese NICHT nochmal enthalten — nur OG/Twitter/canonical/structured-data Tags.

**⚠️ CRITICAL: CSS-Dateien MÜSSEN vollständig und syntaktisch korrekt sein**
Beim Erstellen von CSS-Dateien (besonders über Bash `cat > file.css << 'EOF'`) werden häufig **schließende Klammern `}` abgeschnitten**. Eine einzige fehlende `}` macht das **GESAMTE Stylesheet ungültig** — der Browser verwirft es komplett, und die Section wird als rohes, unstyled HTML gerendert.

Häufige Symptome:
- Section wird als nackte Textliste angezeigt (kein Layout, keine Farben, kein Spacing)
- Header zeigt nur Text-Links statt Grid-Layout mit Icons
- Sections haben kein Hintergrund, kein Padding, keine Farben

**Nach JEDER CSS-Dateierstellung MUSS validiert werden:**
```bash
python3 -c "
import re, sys
with open('assets/section-name.css') as f:
    css = f.read()
opens = css.count('{')
closes = css.count('}')
if opens != closes:
    print(f'FEHLER: {opens} öffnende vs {closes} schließende Klammern')
    sys.exit(1)
print(f'OK: {opens} Blöcke korrekt geschlossen')
"
```

**NIEMALS CSS-Dateien über Bash-Heredocs erstellen** — immer `Write`/`Edit` Tools verwenden. Heredocs schneiden bei langen Dateien regelmäßig das Ende ab, was zu fehlenden `}` führt.

**⚠️ CRITICAL: Section Layout — Dawn-Ansatz (KEIN CSS-Grid auf `.shopify-section`)**
Shopify wraps jede Section in ein `<div class="shopify-section">`. **NIEMALS** ein CSS-Grid, Margins oder Padding auf `.shopify-section` setzen! Das erzeugt weiße Ränder um ALLE Sections.

Dawn-Ansatz (der einzig korrekte):
1. `.shopify-section` ist ein **transparenter Wrapper** — nur `position: relative`, sonst nichts.
2. Sections die zentrierten Content brauchen nutzen einen **inneren `.page-width`-Wrapper**:
   ```css
   .page-width { max-width: var(--page-width, 120rem); margin: 0 auto; padding-left: var(--page-margin, 1.5rem); padding-right: var(--page-margin, 1.5rem); }
   ```
3. Full-bleed Sections (Hero, Header, Footer, Marquee, Countdown mit Hintergrundbild) nutzen **KEIN `.page-width`** — sie gehen edge-to-edge und regeln Inhaltsbreite per `max-width` auf inneren Elementen.
4. Hintergrundfarbe und Padding gehören auf das **Section-Root-Element** (z.B. `<section class="my-section">`), NICHT auf `.shopify-section`.

Falsch (erzeugt weiße Ränder):
```css
.shopify-section { display: grid; grid-template-columns: margin content margin; }
.shopify-section > * { grid-column: 2; }
```

Richtig:
```css
.shopify-section { position: relative; }
/* Sections regeln ihre eigene Breite */
.my-section { padding: 3rem clamp(1rem, 3vw, 2rem); }
.my-section__inner { max-width: 1440px; margin: 0 auto; }
```

**⚠️ CRITICAL: CSS-Selektoren MÜSSEN exakt mit HTML-Klassen matchen**
Wenn eine Section `<section class="coll-grid">` rendert, MUSS das CSS `.coll-grid` targetieren — NICHT `.section-collection-grid` oder einen anderen Namen. Dieser Mismatch ist eine häufige Fehlerquelle: Hintergrundfarbe, Padding und Layout werden nie angewandt, was zu weißen Rändern und fehlerhaftem Layout führt. **Vor dem Commit IMMER prüfen:** HTML-Root-Klasse = CSS-Root-Selektor.

**⚠️ CRITICAL: theme.liquid Pflicht-Elemente (Dawn-Standard)**
```liquid
<!doctype html>
<html class="no-js" lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width,initial-scale=1">
  <title>{{ page_title }}{%- unless page_title contains shop.name %} &ndash; {{ shop.name }}{% endunless -%}</title>
  {%- render 'meta-tags' -%}
  <script>document.documentElement.className = document.documentElement.className.replace('no-js', 'js');</script>
  {%- render 'css-variables' -%}
  {{ 'critical.css' | asset_url | stylesheet_tag: preload: true }}
  {{ content_for_header }}
</head>
<body class="template-{{ template.name }}">
  <a class="skip-to-content-link visually-hidden" href="#MainContent">
    {{ 'general.accessibility.skip_to_content' | t }}
  </a>
  {%- sections 'header-group' -%}
  <main id="MainContent" class="content-for-layout" role="main" tabindex="-1">
    {{ content_for_layout }}
  </main>
  {%- sections 'footer-group' -%}
</body>
</html>
```
Pflicht-Regeln:
- `<title>` mit `page_title` + Shop-Name — NIEMALS weglassen
- `{{ content_for_header }}` — Shopify-Analytics, PFLICHT
- Skip-to-content-Link für Accessibility
- `body class="template-{{ template.name }}"` für template-spezifisches CSS
- KEINE doppelten CSS-Definitionen (keine inline `<style>` Blöcke die Klassen aus `critical.css` wiederholen)
- KEINE Sections direkt per `{% section 'name' %}` einbinden — Section Groups verwenden

**⚠️ CRITICAL: Section Groups — Header/Footer (Dawn-Standard)**

Section Groups (`sections/header-group.json`, `sections/footer-group.json`) steuern, welche Sections im Header/Footer des Customizers erscheinen. Wenn eine Section Group im Customizer **nicht sichtbar** ist, liegt der Fehler in einem der folgenden Punkte:

1. **Section Group JSON — einfach halten (Dawn-Ansatz):**
   ```json
   {
     "type": "header",
     "name": "Header",
     "sections": {
       "header": {
         "type": "header",
         "settings": {}
       }
     },
     "order": ["header"]
   }
   ```
   - `"type"`: muss `"header"`, `"footer"`, `"aside"` oder `"custom"` sein
   - `"sections"`: nur Sections referenzieren, die existieren und fehlerfrei rendern
   - **KEINE Blocks oder Settings** in der Group-JSON vorkonfigurieren — das macht der Merchant im Customizer
   - Wenn eine Section in der Group einen Liquid-Fehler hat, **verschwindet die GESAMTE Group** aus dem Customizer ohne Fehlermeldung

2. **`enabled_on` ist PFLICHT für Header/Footer Sections:**
   ```json
   {% schema %}
   {
     "name": "t:sections.header.name",
     "enabled_on": {
       "groups": ["header"]
     },
     "settings": [...]
   }
   {% endschema %}
   ```
   - Header-Section: `"enabled_on": { "groups": ["header"] }`
   - Footer-Section: `"enabled_on": { "groups": ["footer"] }`
   - Announcement-Bar: `"enabled_on": { "groups": ["header"] }`
   - Ohne `enabled_on` kann Shopify die Section nicht korrekt der Group zuordnen

3. **Liquid-Fehler in Snippets killen die gesamte Section Group:**
   - Wenn `snippets/site-logo.liquid` einen Liquid-Error hat, rendert die Header-Section nicht → die gesamte Header-Group verschwindet
   - **Häufigster Fehler:** Filter-Chains in Named Arguments (siehe oben). Beispiel:
     ```liquid
     {%- comment -%} ❌ KAPUTT — | times: 2 wird auf image_url-Ergebnis angewandt, nicht auf logo_width {%- endcomment -%}
     {{ settings.logo | image_url: width: settings.logo_width | times: 2 | image_tag: ... }}
     
     {%- comment -%} ✅ RICHTIG — vorher berechnen {%- endcomment -%}
     {%- assign logo_w_2x = settings.logo_width | times: 2 -%}
     {{ settings.logo | image_url: width: logo_w_2x | image_tag: ... }}
     ```
   - **Vor dem Push IMMER testen:** Alle Snippets die eine Header/Footer-Section nutzt müssen syntaktisch korrekt sein

4. **Debugging wenn eine Section Group nicht erscheint:**
   - Prüfe die Group-JSON: Valid JSON? Section-Types existieren?
   - Prüfe jede Section in der Group: Schema-JSON valid? `enabled_on` gesetzt?
   - Prüfe alle Snippets die die Sections rendern: Keine kaputten Filter-Chains?
   - Vereinfache: Entferne alle Sections bis auf eine, teste, füge einzeln hinzu

**⚠️ CRITICAL: JSON Template-Dateien — Homepage zeigt 404 statt Inhalt**

Wenn eine Seite 404 zeigt statt dem erwarteten Template-Inhalt (z.B. Homepage zeigt 404 aber andere Seiten funktionieren), liegt das Problem an der Template-JSON oder den darin referenzierten Sections. Das ist ein häufiger, schwer zu debuggender Fehler.

**HÄUFIGSTE URSACHE: Fehlende explizite Settings in der Template-JSON**
Wenn eine Section ein `color_scheme` Setting im Schema hat und die Template-JSON dieses Setting NICHT explizit setzt, kann Shopify die Section nicht rendern → die ganze Seite fällt auf 404. Schema-Defaults werden in Template-JSONs NICHT immer zuverlässig angewandt.

**PFLICHT-REGEL: In JEDER Template-JSON (`index.json`, `product.json`, etc.) MUSS jede Section ALLE wichtigen Settings EXPLIZIT setzen — insbesondere `color_scheme`:**
```json
{
  "sections": {
    "my_section": {
      "type": "hero",
      "settings": {
        "color_scheme": "scheme-1",
        "padding_top": 64,
        "padding_bottom": 64
      }
    }
  }
}
```

❌ FALSCH (verlässt sich auf Schema-Defaults — kann 404 verursachen):
```json
{
  "sections": {
    "hero": {
      "type": "hero",
      "settings": { "mode": "slideshow", "height": "large" }
    }
  }
}
```

✅ RICHTIG (alle relevanten Settings explizit gesetzt):
```json
{
  "sections": {
    "hero": {
      "type": "hero",
      "settings": {
        "color_scheme": "scheme-1",
        "mode": "slideshow",
        "height": "large",
        "autoplay": true,
        "padding_top": 64,
        "padding_bottom": 64
      }
    }
  }
}
```

**Weitere Ursachen:**
1. **`templates/index.json` existiert nicht oder ist ungültiges JSON**
2. **Referenzierte Sections existieren nicht** — Jeder `"type": "section-name"` muss eine `sections/section-name.liquid` Datei haben
3. **Block-Typen in Template-JSON stimmen nicht mit Section-Schema überein**
4. **Liquid-Fehler in einer Section** — besonders `scheme.settings.background.red` auf nil-Objekten
5. **Abgeschnittene Snippet-Dateien** — Ein fehlendes `{% endif %}` in einem Snippet das vom Header gerendert wird (z.B. `site-logo.liquid`) killed ALLE Seiten

**Debugging-Checkliste (MUSS bei 404 durchlaufen werden):**
```bash
# 1. JSON valid?
python3 -c "import json; d=json.load(open('templates/index.json')); print('OK:', len(d['sections']), 'sections')"

# 2. Alle referenzierten Sections vorhanden?
python3 -c "
import json, os
d=json.load(open('templates/index.json'))
for k,v in d['sections'].items():
    f='sections/'+v['type']+'.liquid'
    if not os.path.exists(f): print(f'MISSING: {f}')
print('Check done')
"

# 3. Alle Snippets balanciert? (fehlende endif/endfor killt alles)
python3 -c "
import re, os
for f in os.listdir('snippets'):
    if not f.endswith('.liquid'): continue
    c = open('snippets/'+f).read()
    for t in ['if','unless','for','case','form']:
        o=len(re.findall(r'{%-?\s*'+t+r'[\s%]',c))
        cl=len(re.findall(r'{%-?\s*end'+t+r'\s*-?%}',c))
        if o>cl: print(f'BROKEN: snippets/{f} — {t}: {o} opens vs {cl} closes')
"

# 4. ZWINGEND: Minimal-Test bei 404
# Reduziere index.json auf EINE einzige Section die nachweislich funktioniert
# Wenn Homepage dann funktioniert → Binary Search: Sections hälfteweise zurückfügen
# Dabei IMMER color_scheme explizit setzen
```

**NACH JEDEM ERSTELLEN einer Template-JSON diese Validierung ausführen:**
```bash
python3 -c "
import json, re, os
d=json.load(open('templates/index.json'))
for k,v in d['sections'].items():
    stype=v['type']
    f='sections/'+stype+'.liquid'
    if not os.path.exists(f):
        print(f'MISSING SECTION: {f}')
        continue
    c=open(f).read()
    m=re.search(r'{%-?\s*schema\s*-?%}(.*?){%-?\s*endschema\s*-?%}',c,re.DOTALL)
    if not m: continue
    schema=json.loads(m.group(1))
    # Check color_scheme
    has_cs=any(s.get('id')=='color_scheme' for s in schema.get('settings',[]) if 'id' in s)
    tmpl_cs='color_scheme' in v.get('settings',{})
    if has_cs and not tmpl_cs:
        print(f'WARNING: {k} ({stype}) hat color_scheme im Schema aber NICHT in template settings!')
print('Validation done')
"
```

**Schema discipline:**
- One `{% schema %}` block per section, at the very bottom of the file
- Valid JSON only: double quotes, no trailing commas, no Liquid inside schema
- IDs: lowercase, underscores only (no hyphens), start with a letter, max 25 chars
- Section name: max 25 characters
- Always provide sensible defaults (follow the type-specific default rules — see `references/coding-rules.md`)
- Group related settings with `"type": "header"` separators
- Use `"info"` fields to explain non-obvious settings to merchants

### 2. Maximum Theme Editor Customizability

Everything the merchant might want to change must be a schema setting. Think from the merchant's perspective — they configure via the theme editor, not code.

**Every section should expose:**
- **`color_scheme`** — `{ "type": "color_scheme", "id": "color_scheme", "label": "Farbschema", "default": "scheme-1" }` — MANDATORY for every content section. This connects to the global `color_scheme_group` defined in `config/settings_schema.json` and lets merchants pick per-section color palettes from the theme editor. Wire it in the `{% style %}` block and add class `color-scheme color-{{ section.settings.color_scheme.id }}` to the section wrapper. See below for the CSS pattern.
- Content settings (headings, text, images, links)
- Layout settings (columns, alignment, spacing)
- Style settings (colors, fonts, background — in addition to color_scheme, offer manual overrides only when needed)
- Visibility toggles (show/hide elements)
- Padding top/bottom as range settings (0–100, step 4, unit px)

**Color-scheme architecture (required for every new theme):**

1. `config/settings_schema.json` must include a `color_scheme_group` setting with `id: "color_schemes"` defining exactly these fields (Dawn-standard IDs): `background`, `background_gradient` (type `color_background`), `text`, `button`, `button_label`, `secondary_button_label`, `shadow`. The role mapping must use: `text` → `"text"`, `background` → `{"solid": "background", "gradient": "background_gradient"}`, `links` → `"secondary_button_label"`, `icons` → `"text"`, `primary_button` → `"button"`, `on_primary_button` → `"button_label"`, `secondary_button` → `"background"`, `on_secondary_button` → `"secondary_button_label"`. **Do NOT use `button_background` or `border` — the correct IDs are `button` and `shadow`.**

2. `config/settings_data.json` must seed at least `scheme-1` (light) and `scheme-2` (dark) with concrete hex color values using the same field IDs from the definition (`background`, `background_gradient`, `text`, `button`, `button_label`, `secondary_button_label`, `shadow`). Without this, the theme editor shows "Unable to display color schemes" and the picker is broken.

3. Every content section's `{% style %}` block must output the scheme's CSS custom properties:
```liquid
{% style %}
  {%- assign scheme = section.settings.color_scheme -%}
  {%- if scheme -%}
  .color-{{ scheme.id }} {
    --color-background: {{ scheme.settings.background.red }}, {{ scheme.settings.background.green }}, {{ scheme.settings.background.blue }};
    --color-text: {{ scheme.settings.text.red }}, {{ scheme.settings.text.green }}, {{ scheme.settings.text.blue }};
    color: rgb(var(--color-text));
    background-color: rgb(var(--color-background));
  }
  {%- endif -%}
{% endstyle %}
```

4. The section's root element must carry `class="... color-scheme color-{{ section.settings.color_scheme.id }}"` so the CSS variables scope correctly.

**Blocks for repeatable content.** Use blocks whenever merchants need to add, remove, or reorder items (testimonials, features, slides, FAQ items). Always include `{{ block.shopify_attributes }}` on block wrappers for editor interactivity.

**Support app blocks.** Include `{ "type": "@app" }` in blocks for key sections (product, cart, header, footer) so merchants can place third-party app blocks.

**Presets for every section** that should be available in "Add section" menu. Use translation keys for preset names.

**Use `visible_if`** for conditional settings — show carousel settings only when layout is set to carousel, etc.

### 3. Visual & Functional Robustness

Code must handle all states gracefully — empty content, missing images, long text, single items, many items.

- Always check `!= blank` before rendering optional content
- Provide CSS-level fallbacks for missing images (background color, placeholder)
- Use `clamp()` for fluid typography and spacing — fewer breakpoints, smoother scaling
- Test designs mentally at 320px, 768px, 1024px, 1440px widths
- Use CSS Grid with `minmax()` and `auto-fit`/`auto-fill` for naturally responsive layouts
- Support `prefers-reduced-motion` and `prefers-color-scheme`

### 4. Performance & Accessibility (Senior Standards)

Performance directly impacts conversion rates. Shopify Theme Store requires minimum Lighthouse 60.

**Performance:**
- Lazy-load all below-the-fold images (`loading: 'lazy'`). Above-the-fold images get `loading: 'eager'` and `fetchpriority: 'high'`
- Always use `image_url` + `image_tag` with explicit `widths` and `sizes` attributes — never bare `<img>` tags
- Load section CSS conditionally inside the section, not globally
- Defer non-critical JS: `<script src="..." defer></script>` or `type="module"`
- Keep minified JS bundles under 16KB. No React, Angular, Vue, jQuery — use vanilla JS or Alpine.js
- Preload critical fonts with `font-display: swap`
- Use Shopify CDN for all assets (`| asset_url`)
- Avoid namespace collisions — wrap JS in IIFEs or use ES modules

**Accessibility (WCAG AA):**
- Semantic HTML: `<nav>`, `<main>`, `<article>`, `<aside>`, `<section>`
- All images: `alt="{{ image.alt | escape }}"` — never empty alt on meaningful images
- All interactive elements keyboard-accessible with visible focus styles
- `aria-live="polite"` regions for dynamic content (cart updates, notifications)
- Color contrast minimum 4.5:1 for text
- Form inputs must have associated `<label>` elements
- Skip-to-content link
- `aria-label` on icon-only buttons

### 5. Shopify Core & Theme Integration

**Use Shopify's built-in systems:**
- `{{ routes.root_url }}`, `{{ routes.cart_url }}` — never hardcode paths (handles locale prefixes automatically)
- `{{ product.price | money }}` — never hardcode currency symbols
- `{{ 'key.path' | t }}` — use translation filter for all user-facing strings
- Translation keys in schema (`t:sections...`) for multilingual-ready themes
- Metafields via `product.metafields.namespace.key` with `| metafield_tag` for simple rendering or `.value` for custom rendering

**Locale files:**
```json
{
  "sections": {
    "section_name": {
      "name": "Section Display Name",
      "settings": {
        "setting_id": { "label": "Label Text" }
      }
    }
  }
}
```
Max 3400 translations per file, max 1000 characters per value.

### 6. JavaScript Quality & Theme Editor Compatibility

**Custom Elements pattern** (Dawn standard):
```javascript
class MyComponent extends HTMLElement {
  connectedCallback() {
    // Initialize — bind events, set up observers
  }
  disconnectedCallback() {
    // Clean up — remove listeners, disconnect observers, clear intervals
  }
}
if (!customElements.get('my-component')) {
  customElements.define('my-component', MyComponent);
}
```

**Theme editor event handling** — sections get reloaded in the editor. Handle these events:
```javascript
document.addEventListener('shopify:section:load', (e) => { /* re-init */ });
document.addEventListener('shopify:section:unload', (e) => { /* cleanup */ });
document.addEventListener('shopify:block:select', (e) => { /* highlight/scroll */ });
document.addEventListener('shopify:block:deselect', (e) => { /* remove highlight */ });
```

No memory leaks: clean up event listeners, IntersectionObservers, MutationObservers, and intervals in `disconnectedCallback` and `shopify:section:unload`.

### 7. CSS Strategy

**Scoped CSS with section.id** for dynamic values:
```liquid
{% style %}
  #shopify-section-{{ section.id }} {
    --section-padding-top: {{ section.settings.padding_top }}px;
    --section-padding-bottom: {{ section.settings.padding_bottom }}px;
  }
{% endstyle %}
```

**BEM naming** for all classes: `.block__element--modifier`

**Static CSS in asset files**, loaded conditionally per section:
```liquid
{{ 'section-featured-products.css' | asset_url | stylesheet_tag }}
```

**Modern CSS required:** Grid, Flexbox, Container Queries, `clamp()`, `gap`, `aspect-ratio`, CSS custom properties. No floats, no `!important` (unless overriding third-party).

## Output Format

When generating code, output complete, deployable files. Structure your response as:

1. **File path** — clearly indicate where each file goes in the theme structure
2. **Complete file content** — no placeholders, no "add your code here" comments, no TODO markers
3. **Brief explanation** — why architectural decisions were made

For sections, always include:
- The complete `.liquid` file with HTML, Liquid logic, `{% style %}` block (if dynamic CSS needed), and `{% schema %}` at the bottom
- Associated CSS asset file (if static styles exist)
- Associated JS asset file (if interactivity needed)
- Any snippets the section depends on

Example output structure:
```
sections/featured-collection.liquid   — Section with complete schema
assets/section-featured-collection.css — Scoped static styles
assets/featured-collection.js          — Custom Element (if needed)
snippets/product-card.liquid           — Reusable partial with parameter docs
locales/en.default.schema.json         — Translation keys (additions)
```

## Additional Rules

- Never output incomplete code or skeleton files. Every file is production-ready.
- When modifying existing sections, preserve all existing settings and blocks — merchants may already have configurations saved.
- When in doubt about a setting type or schema rule, consult the reference files before guessing.
- Monetary values: always use `| money` or `| money_with_currency` filters.
- URLs: always use `routes` object and `| url` filters — never hardcode `/cart`, `/collections`, etc.
- Images: always use `| image_url: width: X | image_tag` pipeline with `loading`, `sizes`, `widths`, and `alt` attributes.
- Test your mental model: does this section work with 0 blocks? 1 block? 50 blocks? No image? Very long title? Mobile viewport?
- Prioritize progressive enhancement: core content works without JS, JS enhances the experience.
