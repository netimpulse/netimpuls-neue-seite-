# Shopify Liquid Coding Rules Reference

## Table of Contents
0. [File-Writing Method (READ FIRST)](#file-writing-method-read-first)
1. [Schema JSON Rules](#schema-json-rules)
2. [ID Rules](#id-rules)
3. [Label Rules](#label-rules)
4. [Default Value Rules](#default-value-rules)
5. [CSS Standards](#css-standards)
6. [Security](#security)
7. [Common Errors & Solutions](#common-errors--solutions)

---

## File-Writing Method (READ FIRST)

### The bash heredoc trap

Writing `.liquid`, `.js`, or `.css` files via `cat << EOF`, `cat << 'EOF'`, `echo`, or `printf` in bash will silently break them. Bash's history-expansion turns every `!` into `\!`. Result:

| Source you intended            | What ends up in the file       | Effect                               |
|--------------------------------|--------------------------------|--------------------------------------|
| `if product != blank`          | `if product \!= blank`         | Liquid syntax error, section dies    |
| `if (!tab) return;`            | `if (\!tab) return;`           | JS SyntaxError                       |
| `unless x != blank`            | `unless x \!= blank`           | Liquid syntax error                  |

`cat` shows the file as if it's correct — you only see the bug when Shopify rejects the section. **Use the dedicated `Write` / `Edit` tools** for every theme file. They write bytes literally.

### If a heredoc was already used (recovery)

```bash
# Detect
grep -rn '\\!' sections/ snippets/ assets/ templates/ layout/

# Fix
find sections snippets assets templates layout -type f \
  \( -name '*.liquid' -o -name '*.js' -o -name '*.json' -o -name '*.css' \) \
  -exec sed -i 's/\\!=/!=/g; s/\\!/!/g' {} +
```

The same risk exists for backticks (` ` `), unescaped `$`, and double quotes inside `<<EOF` (without single-quoting the delimiter). Don't fight it — write code with `Write`/`Edit`.

### Mandatory pre-commit validation

Before `git add && git commit && git push`, always run two checks:

**1. JSON schema parse + ID/name rules** (every `{% schema %}` block):
- Parses as valid JSON (no comments, no trailing commas, double quotes only)
- IDs match `^[a-z][a-z0-9_]*$`, length ≤ 25
- No duplicate IDs within a settings array
- `name` ≤ 25 chars
- No section with both `disabled_on` and `enabled_on`

**2. Liquid structural sanity**:
- `{% %}` and `{{ }}` balanced
- Every `if/unless/for/case/capture/form/paginate/tablerow/comment/raw/style/stylesheet/javascript/schema` has a matching `end…`
- No `\!` anywhere in the source
- No `{{ x | if, a, b }}` (Liquid has no ternary — use `{% liquid %}` with `assign`/`if`/`else`)
- `{% liquid %}` is treated as inline (no `endliquid`)

A reusable script template lives at `references/check-theme.py`.

---

## Schema JSON Rules

Every section has exactly ONE `{% schema %}` / `{% endschema %}` block at the bottom of the file. The content between these tags is valid JSON — no Liquid, no comments inside.

**Hard rules:**
- Valid JSON only: double quotes, no trailing commas, no single quotes
- One schema per section file — never multiple
- Schema goes at the very end of the `.liquid` file
- `name` attribute: max 25 characters, used as display name in theme editor
- `tag` attribute: the HTML wrapper element (default: `<div>`). Use `section` for semantic sections
- `class` attribute: CSS class on the wrapper element. Use BEM-style naming
- `limit` attribute: max instances of this section per page (integer)
- `disabled_on` / `enabled_on`: control which template types the section appears on. Use one or the other, never both

```json
{
  "name": "Featured Products",
  "tag": "section",
  "class": "section-featured-products",
  "limit": 1,
  "disabled_on": {
    "groups": ["header", "footer"]
  },
  "settings": [],
  "blocks": [],
  "presets": []
}
```

## ID Rules

Setting and block IDs are how you reference values in Liquid. Strict rules apply:

- **Unique** within the section (no duplicate IDs in settings + blocks combined)
- **Lowercase** letters, numbers, and underscores only
- **No hyphens** — use underscores: `show_vendor` not `show-vendor`
- **Must start with a letter** — not a number or underscore
- **Max 25 characters** recommended (Shopify doesn't enforce this hard, but keep IDs concise)
- IDs are permanent — changing them breaks existing merchant configurations

**Good IDs:** `heading`, `products_to_show`, `show_vendor`, `bg_color`, `image_1`
**Bad IDs:** `show-vendor` (hyphen), `1_image` (starts with number), `_heading` (starts with underscore), `MyHeading` (uppercase)

## Label Rules

- **Required** for all setting types except `header` and `paragraph`
- Max ~50 characters (shorter is better — must fit in the theme editor sidebar)
- No HTML in labels
- Use translation keys for multilingual support: `"label": "t:sections.my_section.settings.heading.label"`
- `info` field is optional but recommended for non-obvious settings — short helper text shown below the input

## Default Value Rules

Different setting types have different rules for defaults. Getting this wrong causes theme editor errors.

### Types that MUST NOT have empty string defaults
These types require a meaningful default or no `default` key at all:
- `text` — provide a realistic default like `"Featured Collection"` or omit the key
- `textarea` — provide content or omit
- `richtext` — provide `"<p>Default text</p>"` or omit
- `url` — omit the default key entirely (no empty string)
- `video_url` — omit the default key entirely
- `color` — provide a hex value like `"#000000"` or omit
- `font_picker` — provide a font string like `"helvetica_n4"` or omit

### Types that CAN have specific defaults
- `checkbox` — `true` or `false` (boolean, not string)
- `number` — can be `0` or any number
- `range` — can be `0` or any number within min/max
- `select` — default must match one of the `options[].value` values
- `radio` — default must match one of the `options[].value` values

### Types where default is typically omitted
- `image_picker` — no default (merchant picks an image)
- `product` — no default
- `collection` — no default
- `product_list` — no default
- `collection_list` — no default
- `blog` — no default
- `page` — no default
- `article` — no default
- `link_list` — no default
- `video` — no default

### `header` and `paragraph` (display-only types)
- `header` uses `content` instead of `label` and `default`
- `paragraph` uses `content` instead of `label` and `default`
- Neither has an ID

## CSS Standards

### Scoped CSS with section.id
Every section gets a unique ID from Shopify. Use it to scope all CSS:

```liquid
{% style %}
  #shopify-section-{{ section.id }} .featured-products__grid {
    display: grid;
    grid-template-columns: repeat({{ section.settings.columns }}, 1fr);
    gap: {{ section.settings.gap }}px;
  }
{% endstyle %}
```

For static CSS (not depending on settings), use a separate asset file loaded conditionally:

```liquid
{{ 'section-featured-products.css' | asset_url | stylesheet_tag }}
```

### BEM Naming Convention
Use Block__Element--Modifier naming:

```css
/* Block */
.featured-products { }

/* Element */
.featured-products__grid { }
.featured-products__card { }
.featured-products__title { }

/* Modifier */
.featured-products--dark { }
.featured-products__card--highlighted { }
```

### CSS Custom Properties for Theme Settings
Use CSS custom properties to bridge Liquid settings into CSS:

```liquid
{% style %}
  #shopify-section-{{ section.id }} {
    --section-padding-top: {{ section.settings.padding_top }}px;
    --section-padding-bottom: {{ section.settings.padding_bottom }}px;
    --section-bg-color: {{ section.settings.bg_color }};
    --section-text-color: {{ section.settings.text_color }};
  }
{% endstyle %}
```

```css
/* In asset file */
.featured-products {
  padding-top: var(--section-padding-top, 2rem);
  padding-bottom: var(--section-padding-bottom, 2rem);
  background-color: var(--section-bg-color, transparent);
  color: var(--section-text-color, inherit);
}
```

### Modern CSS Requirements
- Use `clamp()` for fluid typography and spacing: `font-size: clamp(1rem, 2.5vw, 2rem);`
- Use CSS Grid and Flexbox — never floats
- Use Container Queries (`@container`) where components need to be self-contained
- Use `gap` property instead of margin hacks
- Use `aspect-ratio` for media containers
- Support `prefers-reduced-motion` and `prefers-color-scheme`
- Minimize `!important` — if needed, the specificity architecture needs rethinking

## Security

### Output Escaping
Always escape user-generated content:

```liquid
{{ product.title | escape }}
{{ article.content }}  {%- comment -%} richtext is already safe {%- endcomment -%}
{{ page.title | escape }}
```

Use `| escape` for:
- Product/collection/page/article titles
- Metafield text values
- Any content that could contain special characters

### URL Validation
For URLs from settings or metafields:

```liquid
{% if section.settings.link != blank %}
  <a href="{{ section.settings.link }}">
{% endif %}
```

Never construct URLs from arbitrary user input. Use Shopify's `routes` object and `| url` filters.

## Color-Scheme System (mandatory)

Every Shopify theme must implement the `color_scheme_group` + `color_scheme` pattern:

### 1. settings_schema.json
Include a `color_scheme_group` with `id: "color_schemes"` defining exactly these fields (Dawn-standard IDs): `background`, `background_gradient` (type `color_background`), `text`, `button`, `button_label`, `secondary_button_label`, `shadow`.

**IMPORTANT: The button field ID is `button`, NOT `button_background`. The shadow field ID is `shadow`, NOT `border`.** Using wrong IDs causes "Unable to display color schemes" in the theme editor.

The `role` mapping must be:
```json
"role": {
  "text": "text",
  "background": { "solid": "background", "gradient": "background_gradient" },
  "links": "secondary_button_label",
  "icons": "text",
  "primary_button": "button",
  "on_primary_button": "button_label",
  "primary_button_border": "button",
  "secondary_button": "background",
  "on_secondary_button": "secondary_button_label",
  "secondary_button_border": "secondary_button_label"
}
```

### 2. settings_data.json
Seed at least `scheme-1` (light) and `scheme-2` (dark) with real hex values using the same field IDs: `background`, `background_gradient`, `text`, `button`, `button_label`, `secondary_button_label`, `shadow`. Without this, the theme editor shows "Unable to display color schemes".

Example:
```json
{
  "current": {
    "color_schemes": {
      "scheme-1": {
        "settings": {
          "background": "#FFFFFF",
          "background_gradient": "",
          "text": "#121212",
          "button": "#121212",
          "button_label": "#FFFFFF",
          "secondary_button_label": "#121212",
          "shadow": "#121212"
        }
      }
    }
  }
}
```

### 3. Section schema
Every content section MUST include:
```json
{ "type": "color_scheme", "id": "color_scheme", "label": "Farbschema", "default": "scheme-1" }
```

### 4. Section HTML wrapper
```liquid
<section class="my-section color-scheme color-{{ section.settings.color_scheme.id }}">
```

### 5. Section `{% style %}` block
```liquid
{%- assign scheme = section.settings.color_scheme -%}
{%- if scheme -%}
.color-{{ scheme.id }} {
  --color-background: {{ scheme.settings.background.red }}, {{ scheme.settings.background.green }}, {{ scheme.settings.background.blue }};
  --color-text: {{ scheme.settings.text.red }}, {{ scheme.settings.text.green }}, {{ scheme.settings.text.blue }};
  --color-button: {{ scheme.settings.button.red }}, {{ scheme.settings.button.green }}, {{ scheme.settings.button.blue }};
  --color-button-label: {{ scheme.settings.button_label.red }}, {{ scheme.settings.button_label.green }}, {{ scheme.settings.button_label.blue }};
  --color-shadow: {{ scheme.settings.shadow.red }}, {{ scheme.settings.shadow.green }}, {{ scheme.settings.shadow.blue }};
  color: rgb(var(--color-text));
  background-color: rgb(var(--color-background));
  {%- if scheme.settings.background_gradient != blank -%}
  background: {{ scheme.settings.background_gradient }};
  {%- endif -%}
}
{%- endif -%}
```

**Note: Use `scheme.settings.button` NOT `scheme.settings.button_background`, and `scheme.settings.shadow` NOT `scheme.settings.border`.**

---

## Filter Chains in Named Arguments (forbidden)

Liquid does NOT support filter chains (`|`) inside a filter's named-argument list. This causes "Expected end_of_string but found comma".

| Pattern | Valid? |
|---|---|
| `image_tag: alt: my_var, class: 'x'` | ✅ |
| `image_tag: alt: image.alt | default: title | escape, class: 'x'` | ❌ |

**Rule:** Always `assign` complex values first, then pass the variable as the named arg.

```liquid
{%- assign img_alt = image.alt | default: product.title | escape -%}
{{ image | image_url: width: 800 | image_tag: alt: img_alt, class: 'card__image' }}
```

---

## Valid SVG Placeholder Names

Only these names work with `| placeholder_svg_tag`:

`collection-1` … `collection-6`, `product-1` … `product-6`, `lifestyle-1`, `lifestyle-2`, `image`, `detailed-apparel-1`, `detailed-apparel-2`, `hero-apparel-1` … `hero-apparel-3`.

**There is no `lifestyle-3` or higher.** Using an invalid name causes "Unknown SVG placeholder" errors and renders a broken link instead of an image.

---

## Common Errors & Solutions

### JSON Errors in Schema
**Problem:** Schema won't save, section doesn't appear in editor
**Causes:**
- Trailing comma after last item in array or object
- Single quotes instead of double quotes
- Missing comma between properties
- Liquid tags inside `{% schema %}`
- Comments inside schema JSON

**Fix:** Validate JSON separately. Use a JSON linter.

### Setting Not Appearing
**Problem:** Added a setting to schema but it doesn't show in editor
**Causes:**
- Missing `id` field
- Duplicate `id` within the section
- `id` contains invalid characters (hyphens, uppercase)
- Setting type misspelled

### Block Not Rendering
**Problem:** Block added in editor but nothing appears
**Causes:**
- Missing `{% for block in section.blocks %}` loop
- Missing `{{ block.shopify_attributes }}` on the block wrapper
- Block type in template doesn't match block type in schema

### CSS Not Loading
**Problem:** Styles don't apply
**Causes:**
- Asset filename mismatch
- Not using `| asset_url` filter
- Specificity issue — use section.id scoping
- CSS not loaded conditionally (include `{{ 'file.css' | asset_url | stylesheet_tag }}` inside the section)

---

## SVG Icons: Snippet statt Asset-Filter (mandatory)

### `inline_asset_content` existiert NICHT

`{{ 'icon-menu.svg' | inline_asset_content }}` ist **kein gültiger Shopify-Liquid-Filter**. Es gibt keinen eingebauten Filter, um eine Asset-Datei inline als SVG zu rendern. Dieser Code erzeugt leere Ausgabe — die Icons werden unsichtbar.

### Lösung: Icon-Snippet

Erstelle ein universelles Snippet `snippets/icon.liquid` mit `{% case name %}` für jedes Icon:

```liquid
{%- comment -%}
  Rendert ein Inline-SVG-Icon.
  @param {String} name - Icon-Name (menu, search, account, cart, close, chevron, arrow, play, …)
{%- endcomment -%}
{%- case name -%}
  {%- when 'menu' -%}
    <svg …>…</svg>
  {%- when 'search' -%}
    <svg …>…</svg>
  {%- comment -%} etc. {%- endcomment -%}
{%- endcase -%}
```

Aufruf überall:
```liquid
{%- render 'icon', name: 'menu' -%}
{%- render 'icon', name: 'search' -%}
{%- render 'icon', name: 'cart' -%}
```

**Niemals** `{{ 'xxx.svg' | inline_asset_content }}` schreiben — dieser Filter existiert nicht in Shopify Liquid.

---

## Header-Grid-Regel (CSS Grid Kinder-Anzahl)

### Problem: Zu viele Grid-Kinder

Wenn ein CSS Grid mit `grid-template-columns` 3 Spalten definiert (z.B. `auto 1fr auto`), aber das HTML 4 oder mehr direkte Kinder hat, bricht das Layout — das vierte Kind wird in eine neue implizite Zeile geschoben oder überlagert andere Elemente.

### Regel: Exakt so viele direkte Kinder wie Grid-Spalten

**Für den Header gilt immer: exakt 3 direkte Kinder des Grid-Containers:**

| Kind | Inhalt | Grid-Spalte |
|------|--------|-------------|
| `__left` | Burger/Nav (mobile) oder Nav (desktop logo_center) | 1 |
| `__center` | Logo (+ Nav darunter bei `logo_center`) | 2 |
| `__right` | Utility-Icons (Suche, Account, Warenkorb) | 3 |

**Bei `logo_center`-Layout:** Logo und Hauptnavigation werden BEIDE innerhalb von `__center` platziert (Logo oben, Nav darunter via Flexbox column). KEIN separates viertes Kind für die Nav.

```html
<!-- ✅ KORREKT: 3 Grid-Kinder -->
<header class="site-header" style="grid-template-columns: 1fr auto 1fr;">
  <div class="site-header__left">…</div>
  <div class="site-header__center">
    <a class="site-header__logo">…</a>
    <nav class="site-header__nav">…</nav>  <!-- INNERHALB von center -->
  </div>
  <div class="site-header__right">…</div>
</header>

<!-- ❌ FALSCH: 4 Grid-Kinder -->
<header class="site-header" style="grid-template-columns: 1fr auto 1fr;">
  <div class="site-header__left">…</div>
  <div class="site-header__logo-center">…</div>
  <nav class="site-header__nav">…</nav>     <!-- 4. Kind bricht Grid -->
  <div class="site-header__right">…</div>
</header>
```

### Header/Footer MUSS full-width sein (`.shopify-section` Grid Override)

Shopify's Skeleton-Theme `critical.css` definiert ein 3-Spalten-Grid auf `.shopify-section`, das alle Kinder in eine schmale Mittelspalte (`--content-width`) zwängt. Header und Footer müssen aber **edge-to-edge** laufen und ihren Content selbst via `max-width` auf dem inneren Container begrenzen.

**Ohne diesen Override** steckt der `<header>` in der schmalen Spalte, und sein eigenes `1fr auto 1fr`-Grid erzeugt riesige leere Container, die Icons off-screen pushen.

```css
/* In critical.css oder section-header.css */
.section-site-header > *,
.section-site-footer > * {
  grid-column: 1 / -1;
}
```

Danach constrainiert `.site-header__inner` den Inhalt selbst:
```css
.site-header__inner {
  max-width: 1600px;
  margin: 0 auto;
  padding: 0 clamp(1rem, 3vw, 2rem);
}
```

**Diese Regel gilt für JEDE Section, die full-width sein soll** (Header, Footer, Announcement-Bar, Hero etc.). Prüfe immer ob `critical.css` ein `.shopify-section`-Grid hat und setze `grid-column: 1 / -1` für die jeweilige Section-Klasse.

### CSS-Variablen: `--color-background` und `--color-foreground` nie entfernen

`critical.css` nutzt `var(--color-background)` und `var(--color-foreground)` für `body`-Styles. Diese Variablen MÜSSEN in `css-variables.liquid` definiert sein, auch wenn das Theme `color_scheme_group` nutzt. Ableitung aus dem Default-Schema:

```liquid
--color-background: {{ settings.color_schemes.scheme-1.settings.background }};
--color-foreground: {{ settings.color_schemes.scheme-1.settings.text }};
```

### Icon-Buttons: Einheitliche Klasse

Verwende eine einzige Klasse `.site-header__icon-btn` für alle Icon-Buttons (Burger, Suche, Account, Warenkorb). Nicht separate Klassen wie `.site-header__icon` und `.site-header__burger`.

```css
.site-header__icon-btn {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: .5rem;
  background: none;
  border: none;
  cursor: pointer;
  color: inherit;
}
.icon {
  width: 1.5rem;
  height: 1.5rem;
  display: block;
}
```

---

## Theme Store Review Anforderungen (mandatory)

Jedes Theme, das den Shopify Theme Store Review bestehen soll, MUSS die folgenden Regeln einhalten. Diese sind **harte Ausschlusskriterien** — ein Verstoß führt zur sofortigen Ablehnung.

### 1. Pflicht-Templates: `templates/customers/` Verzeichnis

Das Verzeichnis `templates/customers/` MUSS existieren und diese JSON-Templates enthalten:

- `templates/customers/account.json`
- `templates/customers/login.json`
- `templates/customers/register.json`
- `templates/customers/reset_password.json`
- `templates/customers/addresses.json`
- `templates/customers/order.json`

**Ohne diese kann sich kein Kunde einloggen oder sein Konto verwalten — sofortige Ablehnung.**

Jedes Template braucht eine zugehörige Section (z.B. `sections/customer-login.liquid`) mit Formular-Logik. Die Formulare nutzen Shopify's eingebaute Form-Tags:

```liquid
{%- comment -%} Login {%- endcomment -%}
{% form 'customer_login' %}
  <label for="CustomerEmail">{{ 'customer.login.email' | t }}</label>
  <input type="email" id="CustomerEmail" name="customer[email]" autocomplete="email">
  <label for="CustomerPassword">{{ 'customer.login.password' | t }}</label>
  <input type="password" id="CustomerPassword" name="customer[password]">
  <button type="submit">{{ 'customer.login.sign_in' | t }}</button>
{% endform %}

{%- comment -%} Register {%- endcomment -%}
{% form 'create_customer' %}...{% endform %}

{%- comment -%} Reset Password {%- endcomment -%}
{% form 'recover_customer_password' %}...{% endform %}

{%- comment -%} Addresses {%- endcomment -%}
{% form 'customer_address', customer.new_address %}...{% endform %}
```

### 2. Vollständige Lokalisierung (i18n) — JEDER sichtbare Text

**Keine hardcoded Texte im Storefront.** Jeder sichtbare Text muss über `{{ 'key.path' | t }}` aus den Locale-Dateien kommen. Das betrifft ALLE Stellen — nicht nur offensichtliche Überschriften:

**Häufig vergessene Stellen (führen zur Ablehnung):**
- `aria-label="..."` Attribute → `aria-label="{{ 'accessibility.key' | t }}"`
- `title="..."` Attribute auf iframes/embeds → `title="{{ 'media.video_title' | t }}"`
- `alt="..."` auf statischen Bildern → `alt="{{ 'sections.name.image_alt' | t }}"`
- `placeholder="..."` auf Inputs → `placeholder="{{ 'general.placeholder' | t }}"`
- Fallback-Texte in `| default:` → `| default: 'key' | t` oder assign vorab
- Button-Texte (`In den Warenkorb`, `Ausverkauft`, `Sofort kaufen`) → `{{ 'products.product.add_to_cart' | t }}`
- Mengen-Labels (`Menge`, `Weniger`, `Mehr`) → `{{ 'products.product.quantity' | t }}`
- Erfolgs-/Fehlermeldungen (`Danke – du bist angemeldet.`) → `{{ 'newsletter.success' | t }}`
- Länderwähler-Labels (`Land/Region`) → `{{ 'general.country.label' | t }}`
- Link-Texte (`Alle anzeigen →`, `Folgen →`) → `{{ 'sections.name.view_all' | t }}`
- Ganzer Absatztext (Produktbeschreibungen in Presets etc.) → Aus Locale-Datei oder als Setting

**Schema-Labels und Preset-Strings:**
- Alle `"label"`, `"info"`, `"content"` in Schema → `"t:sections.name.settings.id.label"`
- Alle `"name"` in Presets → `"t:sections.name.presets.name"`
- **Hardcoded Preset-Block-Settings** (z.B. `"heading": "Details & Material"`) → `"heading": "t:sections.name.presets.blocks.details.heading"` — Preset-Defaults sind Teil der UI und müssen lokalisiert sein

**Pflicht-Locale-Dateien:**
- `locales/en.default.json` — Storefront-Texte (Englisch, Basis)
- `locales/en.default.schema.json` — Schema-Labels (Englisch, Basis)
- `locales/de.json` — Storefront-Texte (Deutsch, optional aber empfohlen)
- `locales/de.schema.json` — Schema-Labels (Deutsch, optional aber empfohlen)

### 3. Produkt-Sections: Block-basiert + Media-Support

**Gilt für JEDE Section die Produkte als Hauptinhalt zeigt** — nicht nur `product.liquid`, sondern auch `product-showcase.liquid` oder ähnliche Alternative-Produkt-Sections.

**Pflicht-Blöcke:** `title`, `price`, `variant_picker`, `quantity`, `buy_buttons`, `description`, `@app` (App-Block-Support). Händler müssen die Reihenfolge der Elemente im Theme-Editor anpassen können.

**Vollständiger Media-Support:**
```liquid
{%- for media in product.media -%}
  {%- case media.media_type -%}
    {%- when 'image' -%}
      {{ media | image_url: width: 1200 | image_tag: ... }}
    {%- when 'video' -%}
      {{ media | video_tag: ... }}
    {%- when 'external_video' -%}
      {{ media | external_video_tag: ... }}
    {%- when 'model' -%}
      {{ media | model_viewer_tag: ... }}
  {%- endcase -%}
{%- endfor -%}
```
**NIEMALS** `{% for image in product.images %}` verwenden — das ignoriert Videos und 3D-Modelle.

**Sold-out-Logik:** Button muss deaktiviert werden (`disabled`) wenn `current_variant.available == false`, Text auf "Sold out" ändern. Default-Variante (`has_only_default_variant`) muss die Select-Box verstecken.

**Varianten-JavaScript:** Preis-Update, URL-Update (`?variant=ID`), Media-Switch bei Variantenwechsel, Formular-ID.

**Submit-Button:** `<button type="submit" name="add">` — nicht `<input type="submit">`, und das `name="add"` Attribut ist Pflicht für AJAX-Cart-Kompatibilität. **Dies gilt für JEDEN Add-to-Cart-Button im gesamten Theme** — product section, product-showcase, product-card snippet, quick-add modals, etc.

### 4. Accessibility (WCAG AA)

- **`<main id="MainContent">`** muss `{{ content_for_layout }}` umschließen — in `theme.liquid` UND in `password.liquid`
- **Skip-Link** `<a href="#MainContent">` muss in JEDEM Layout vorhanden sein (theme.liquid UND password.liquid)
- **`<label>`** für JEDES `<input>`, `<select>`, `<textarea>` im gesamten Theme — sichtbar oder `visually-hidden`. Häufig vergessen bei: Suchfeldern in `search.liquid`, Mengenfeldern in `cart.liquid`, Newsletter-Email-Feldern in `footer.liquid`/`newsletter.liquid`, Länderwähler in `footer.liquid`
- **`type="number"`** für ALLE Mengenfelder — in `product.liquid`, `product-showcase.liquid`, UND `cart.liquid`. Niemals `type="text"` für Mengen. Immer `min="0"` oder `min="1"` setzen
- **`aria-live="polite" aria-atomic="true"`** auf dynamisch aktualisierten Elementen (Cart-Count)
- **`visually-hidden` Kontext** für Screenreader: `<span class="visually-hidden">{{ 'cart.items' | t }}:</span>` vor dem Cart-Count
- **`aria-label`** auf allen Icon-only-Buttons — und diese MÜSSEN über `{{ ... | t }}` lokalisiert sein, niemals hardcoded
- **`alt`-Texte** auf ALLEN Bildern im gesamten Theme — niemals leer bei bedeutungstragenden Bildern. Prüfe: `article.liquid` (featured image), `blog.liquid` (article images), `custom-section.liquid` (background images), `product-showcase.liquid` (media)
- **Keine inline Event-Handler:** Niemals `onchange="..."`, `onclick="..."`, `onsubmit="..."` in HTML-Attributen. Stattdessen JS via `addEventListener` in einer separaten JS-Datei. Inline-Handler sind ein Accessibility-Red-Flag und zeigen mangelnde Progressive Enhancement

### 5. Bilder: Immer über Shopify Image Pipeline

**Niemals bare `<img>` Tags verwenden.** Alle Bilder müssen über die `image_url | image_tag` Pipeline gerendert werden:

```liquid
{%- comment -%} ❌ FALSCH — bare <img> {%- endcomment -%}
<img src="{{ 'shoppy-x-ray.svg' | asset_url }}" width="300" height="300">

{%- comment -%} ✅ KORREKT — mit Pipeline + allen Pflicht-Attributen {%- endcomment -%}
{%- assign img_alt = 'sections.name.image_alt' | t -%}
{{ section.settings.image | image_url: width: 1200 | image_tag:
   alt: img_alt,
   loading: 'lazy',
   sizes: '(min-width: 768px) 50vw, 100vw',
   widths: '300,600,900,1200' }}
```

**Pflicht-Attribute auf jedem Bild:** `alt`, `loading` (`'lazy'` oder `'eager'`), `sizes`, `widths`

**KRITISCH: `image_tag` Ausgabe NICHT in ein `<img>` Tag wrappen:**
```liquid
{%- comment -%} ❌ FALSCH — erzeugt verschachteltes <img><img></img> (invalides HTML) {%- endcomment -%}
<img>{{ media | image_url: width: 800 | image_tag: alt: alt_text }}</img>

{%- comment -%} ✅ KORREKT — image_tag erzeugt selbst das <img> Element {%- endcomment -%}
{{ media | image_url: width: 800 | image_tag: alt: alt_text, loading: 'lazy' }}
```

Für SVG-Assets (die nicht über `image_url` gehen können), nutze das Icon-Snippet oder `<img>` mit ALLEN Attributen:
```liquid
<img src="{{ 'logo.svg' | asset_url }}" alt="{{ shop.name | escape }}" loading="eager" width="120" height="40">
```

### 6. Keine widersprüchliche Farb-Architektur

Wenn eine Section `color_scheme` (Type `color_scheme`) nutzt, darf sie NICHT gleichzeitig separate `bg_color`, `text_color`, `accent_color` Settings für denselben Zweck haben. Das ist ein Widerspruch — der Reviewer beanstandet es.

**Regel:** Entweder `color_scheme` ODER manuelle Farb-Settings. Nie beides für die gleiche Funktion. Manuelle Overrides sind nur erlaubt, wenn sie einen ANDEREN Zweck haben als das Color-Scheme (z.B. ein `overlay_color` für einen Bildüberlagerungs-Effekt).

### 7. Veraltete Tags: `{% stylesheet %}` und `{% javascript %}`

Diese Tags sind **deprecated** und dürfen **niemals** verwendet werden, besonders nicht in Snippets. Verwende stattdessen:
- Für CSS: `<style>` Tags direkt im HTML oder `{{ 'file.css' | asset_url | stylesheet_tag }}`
- Für JS: `<script src="{{ 'file.js' | asset_url }}" defer></script>`

### 8. Theme-Metadaten (`settings_schema.json`)

- **Version:** `"1.0.0"` für die Ersteinreichung
- **Docs/Support-URLs:** Müssen auf eigene Seiten zeigen, NICHT auf `help.shopify.com` oder `support.shopify.com`
- **Favicon:** Muss als `image_picker` Setting vorhanden sein
- **Social-Media:** Globale Settings für Facebook, Instagram, TikTok, YouTube, Pinterest, X

### 9. `prefers-reduced-motion` in JEDER CSS-Datei mit Animations/Transitions

**PFLICHT:** Jede CSS-Datei, die `transition`, `animation`, `@keyframes`, `transform` mit Duration, oder `scroll-behavior: smooth` enthält, MUSS einen `@media (prefers-reduced-motion: reduce)` Block enthalten, der alle Bewegungen deaktiviert:

```css
@media (prefers-reduced-motion: reduce) {
  .my-section *,
  .my-section *::before,
  .my-section *::after {
    animation-duration: 0.01ms !important;
    animation-iteration-count: 1 !important;
    transition-duration: 0.01ms !important;
    scroll-behavior: auto !important;
  }
}
```

**Keine Ausnahmen.** Dies ist ein WCAG AA Pflichtkriterium. Betrifft typischerweise: Header-CSS (Drawer-Transitions), Hero-CSS (Slideshow), Produkt-CSS (Gallery-Transitions), Footer-CSS (Hover-Effects), Collection-Grid, Lookbook, Featured-Products, Social-Feed, etc.

### 10. Performance

- **Lazy-loading:** `loading: 'lazy'` auf allen Bildern unterhalb des Folds
- **`sizes` und `widths`** Attribute auf allen `image_tag` Aufrufen
- **`image.liquid` Snippet:** Muss `{% if image != blank %}` prüfen bevor gerendert wird
- **Kein `{% stylesheet %}` in Snippets** (Render-Blocking)

### 11. Mindest-Anforderungen für JEDE Section

Jede Section im Theme muss diese Mindeststandards erfüllen:

**Pflicht für jede Content-Section:**
- `color_scheme` Setting (Type `color_scheme`, Default `scheme-1`)
- `padding_top` und `padding_bottom` Range-Settings (0–100, Step 4, Unit px)
- Mindestens ein `preset` (damit die Section im "Add section" Menu erscheint)
- Block-Support wo sinnvoll (Händler können Inhalte hinzufügen/entfernen/sortieren)
- Empty-State-Handling (Section sieht im Editor gut aus auch ohne Daten)
- Alle Texte über `{{ ... | t }}` lokalisiert

**Speziell für Cart-Section (`cart.liquid`):**
- Mengen-Inputs: `type="number"` mit `min="1"`, `<label>` (visually-hidden OK)
- Empty-State: Nachricht + Link zum Weitershoppen wenn Warenkorb leer ist
- AJAX-Update-Funktionalität (oder zumindest Form-Submit)
- `color_scheme`, Padding-Settings, Blocks

**Speziell für Search-Section (`search.liquid`):**
- Such-Input: `type="search"`, `<label>` (visually-hidden OK), `name="q"`
- Ergebnis-Anzeige mit Produkt-/Seiten-/Artikel-Unterscheidung
- Empty-State bei keinen Ergebnissen
- `color_scheme`, Padding-Settings

### 12. Empty States / Placeholders

Jede Section muss im Theme-Editor gut aussehen auch wenn noch keine Daten vorhanden sind. Verwende `placeholder_svg_tag` für leere Medien-Slots.

### 13. Product Template (`templates/product.json`)

Muss `block_order` definieren, damit die Block-Reihenfolge im Editor korrekt angezeigt wird:
```json
{
  "sections": {
    "main": {
      "type": "product",
      "blocks": { "title": { "type": "title" }, ... },
      "block_order": ["title", "price", "variant_picker", "quantity", "buy_buttons", "description"]
    }
  }
}
```

### 14. Demo/Skeleton-Sections entfernen

Sections die aus dem Shopify Skeleton-Theme stammen und nicht produktiv überarbeitet wurden (z.B. `hello-world.liquid` mit hardcoded englischem Beispieltext und Links zu shopify.dev) **MÜSSEN entfernt werden** bevor das Theme eingereicht wird. Sie zeigen dem Reviewer, dass das Theme unfertig ist.

**Checkliste vor Einreichung:**
- Keine Section mit hardcoded shopify.dev Links
- Keine Section mit Lorem-Ipsum oder Platzhalter-Absätzen
- Keine Section deren einziger Zweck "Demo" oder "Test" ist
- Alle verbleibenden Sections sind vollständig lokalisiert und funktional

### 15. `password.liquid` Layout — gleiche Anforderungen wie `theme.liquid`

Das Password-Layout muss die gleichen Accessibility-Anforderungen erfüllen:
- `<main id="MainContent">` Wrapper um `{{ content_for_layout }}`
- Skip-to-Content Link (`<a href="#MainContent">`)
- `{{ content_for_header }}` im `<head>`
- Eigenes `<html lang="{{ request.locale.iso_code }}">`

---

## sed/Bash NIEMALS auf CSS/Liquid-Dateien anwenden (KRITISCH)

**NIEMALS `sed` auf CSS- oder Liquid-Dateien anwenden.** `sed` kann unbeabsichtigt Pattern matchen und Inhalte zerstören — besonders schließende Klammern `}`, Leerzeilen, und andere strukturelle Elemente.

**Tatsächlicher Schadensfall:** Ein `sed`-Befehl der eine CSS-Regel aus `section-header.css` entfernen sollte, hat stattdessen ALLE schließenden `}` gefolgt von Leerzeilen aus der gesamten Datei gelöscht. Resultat: Jede CSS-Regel war offen, das gesamte Theme wurde als roher HTML-Text ohne Styling dargestellt — die Seite war komplett zerstört.

**Regel:** Für JEDE Änderung an CSS, Liquid, JS oder JSON Dateien: **Ausschließlich die `Write`/`Edit` Tools verwenden.** `sed` ist nur für triviale String-Ersetzungen in Nicht-Code-Dateien erlaubt (z.B. Versionsnummern in Plaintext).

**Wenn `sed` versehentlich angewendet wurde:** Sofort die Datei mit `git diff` prüfen und bei Schaden mit `git checkout <commit> -- <datei>` wiederherstellen.
