# Theme Architecture & Patterns Reference

## Table of Contents
1. [Online Store 2.0 Architecture](#online-store-20-architecture)
2. [Layout Files](#layout-files)
3. [JSON Templates](#json-templates)
4. [Sections Everywhere](#sections-everywhere)
5. [Snippets](#snippets)
6. [Config Files](#config-files)
7. [Metafields & Metaobjects](#metafields--metaobjects)
8. [Cart AJAX API](#cart-ajax-api)
9. [Section Rendering API](#section-rendering-api)
10. [Predictive Search](#predictive-search)
11. [Product Form & Variant Switching](#product-form--variant-switching)
12. [Performance Patterns](#performance-patterns)
13. [JavaScript Patterns](#javascript-patterns)
14. [Accessibility Patterns](#accessibility-patterns)

---

## Online Store 2.0 Architecture

```
theme/
├── assets/          # CSS, JS, images, fonts
├── config/          # settings_schema.json, settings_data.json
├── layout/          # theme.liquid, password.liquid
├── locales/         # en.default.json, de.json, etc.
├── sections/        # Reusable sections with schemas
├── snippets/        # Reusable partials (no schema)
├── templates/       # JSON templates (OS 2.0)
│   └── customers/   # Account templates
└── blocks/          # Theme blocks (reusable blocks)
```

**Top-down hierarchy:**
1. **Layout** (theme.liquid) — global HTML frame, loads section groups and template content
2. **Section Groups** (header-group.json, footer-group.json) — global sections loaded via `{% sections 'header-group' %}`
3. **Templates** (product.json, collection.json, etc.) — JSON files defining which sections appear on a page type
4. **Sections** — self-contained .liquid files with their own HTML, CSS, JS, and schema
5. **Blocks** — subsections within sections, visible and reorderable by merchants
6. **Snippets** — invisible code reuse units (no schema, not visible in editor)

The merchant controls **content and layout** via JSON templates and blocks. The developer controls **functionality and structure** via sections, layouts, and snippets.

---

## Layout Files

### theme.liquid
The main layout wraps every page. Minimal structure:

```liquid
<!doctype html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ page_title }}{% unless page_title contains shop.name %} — {{ shop.name }}{% endunless %}</title>

  {{ content_for_header }}

  {{ 'base.css' | asset_url | stylesheet_tag }}
</head>
<body>
  {% sections 'header-group' %}

  <main id="MainContent" role="main">
    {{ content_for_layout }}
  </main>

  {% sections 'footer-group' %}
</body>
</html>
```

Key rules:
- `{{ content_for_header }}` is mandatory — Shopify injects analytics, scripts, meta tags
- `{{ content_for_layout }}` renders the template content
- `{% sections 'group-name' %}` loads section groups
- Never hardcode sections in layout with `{% section 'header' %}` — use section groups instead

### password.liquid
Layout for the password page (store not yet live). Must meet the same accessibility requirements as theme.liquid:

```liquid
<!doctype html>
<html lang="{{ request.locale.iso_code }}">
<head>
  <meta charset="utf-8">
  <meta name="viewport" content="width=device-width, initial-scale=1">
  <title>{{ page_title }}</title>
  {{ content_for_header }}
  {{ 'base.css' | asset_url | stylesheet_tag }}
</head>
<body>
  <a href="#MainContent" class="skip-to-content visually-hidden">
    {{ 'general.accessibility.skip_to_content' | t }}
  </a>

  <main id="MainContent" role="main">
    {{ content_for_layout }}
  </main>
</body>
</html>
```

**PFLICHT:** `<main id="MainContent">` und Skip-Link — auch im Password-Layout. Ohne diese wird das Theme im Review abgelehnt.

---

## JSON Templates

JSON templates enable Sections Everywhere. Every page type should use a JSON template:

```json
// templates/product.json
{
  "sections": {
    "main": {
      "type": "main-product",
      "settings": {}
    },
    "recommendations": {
      "type": "product-recommendations",
      "settings": {
        "heading": "You may also like"
      }
    }
  },
  "order": ["main", "recommendations"]
}
```

- Section keys (like `"main"`) are internal identifiers
- `"type"` maps to a section filename (without `.liquid`)
- `"order"` array controls rendering order
- Merchants can add/remove/reorder sections in the theme editor

Available template types: `index`, `product`, `collection`, `collection.list`, `blog`, `article`, `page`, `cart`, `search`, `404`, `password`, `gift_card`, `customers/account`, `customers/activate_account`, `customers/addresses`, `customers/login`, `customers/order`, `customers/register`, `customers/reset_password`

**⚠️ PFLICHT für Theme Store: Customer Templates**

Das Verzeichnis `templates/customers/` MUSS existieren mit diesen JSON-Templates:

```
templates/customers/
├── account.json          → sections/customer-account.liquid
├── login.json            → sections/customer-login.liquid
├── register.json         → sections/customer-register.liquid
├── reset_password.json   → sections/customer-reset-password.liquid
├── addresses.json        → sections/customer-addresses.liquid
└── order.json            → sections/customer-order.liquid
```

Jedes Template braucht eine zugehörige Section mit dem entsprechenden Shopify-Formular:
- Login: `{% form 'customer_login' %}` 
- Register: `{% form 'create_customer' %}`
- Reset Password: `{% form 'recover_customer_password' %}`
- Addresses: `{% form 'customer_address', customer.new_address %}`
- Account/Order: Zeigen `customer` Objekt-Daten

Alle Formulare müssen `<label>` für jedes Input haben und alle Texte über `| t` lokalisiert sein.

Alternative templates: `product.alternate-layout.json` — merchants select in admin per product/page.

---

## Sections Everywhere

With JSON templates, merchants can add any section with a `preset` to any page type. Design sections to be context-agnostic where possible:

- Don't hardcode assumptions about where a section will appear
- Use `disabled_on` / `enabled_on` to restrict sections to appropriate page types
- Test sections on multiple page types

---

## Snippets

Snippets are reusable code fragments without schemas:

```liquid
{%- comment -%} snippets/product-card.liquid {%- endcomment -%}
{%- comment -%}
  Renders a product card.

  Accepts:
  - product: {Object} Product Liquid object (required)
  - show_vendor: {Boolean} Show vendor name (optional, default: false)
  - image_sizes: {String} Sizes attribute for responsive images (optional)
{%- endcomment -%}

<div class="product-card">
  {% if product.featured_image != blank %}
    {{ product.featured_image | image_url: width: 600 | image_tag:
       loading: 'lazy',
       sizes: image_sizes | default: '(min-width: 768px) 25vw, 50vw',
       widths: '300,450,600',
       alt: product.featured_image.alt | escape }}
  {% endif %}

  <h3 class="product-card__title">
    <a href="{{ product.url }}">{{ product.title | escape }}</a>
  </h3>

  {% if show_vendor %}
    <p class="product-card__vendor">{{ product.vendor | escape }}</p>
  {% endif %}

  <p class="product-card__price">{{ product.price | money }}</p>
</div>
```

Call with: `{% render 'product-card', product: product, show_vendor: true %}`

Rules:
- Use `{% render %}` not `{% include %}` — render is scoped and faster
- Pass all needed variables explicitly
- Document accepted parameters at the top
- No schema — snippets are developer-only tools

---

## Config Files

### settings_schema.json
Defines global theme settings (Typography, Colors, Social media, etc.):

```json
[
  {
    "name": "t:settings_schema.typography.name",
    "settings": [
      {
        "type": "font_picker",
        "id": "heading_font",
        "label": "t:settings_schema.typography.heading_font.label",
        "default": "helvetica_n4"
      }
    ]
  }
]
```

### settings_data.json
Stores current setting values. Auto-generated — never edit manually.

### markets.json
Market-specific configuration for Shopify Markets.

---

## Metafields & Metaobjects

### Metafields
Extend any resource with custom data:

```liquid
{%- comment -%} Product metafield: custom.care_instructions {%- endcomment -%}
{% if product.metafields.custom.care_instructions != blank %}
  <div class="care-instructions">
    {{ product.metafields.custom.care_instructions | metafield_tag }}
  </div>
{% endif %}

{%- comment -%} Direct value access for custom rendering {%- endcomment -%}
{% assign specs = product.metafields.custom.specs.value %}
```

### Metaobjects
Custom content types (like a CMS within Shopify):

```liquid
{%- comment -%} Rendering a metaobject reference {%- endcomment -%}
{% assign testimonial = section.settings.testimonial.value %}
{% if testimonial %}
  <blockquote>
    <p>{{ testimonial.quote }}</p>
    <cite>{{ testimonial.author }}</cite>
  </blockquote>
{% endif %}
```

Access in schema via `metaobject_reference` setting type.

---

## Cart AJAX API

```javascript
// Add to cart
async function addToCart(variantId, quantity = 1) {
  const response = await fetch('/cart/add.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ id: variantId, quantity })
  });
  return response.json();
}

// Get cart
async function getCart() {
  const response = await fetch('/cart.js');
  return response.json();
}

// Update item quantity
async function updateCart(updates) {
  const response = await fetch('/cart/update.js', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ updates })
  });
  return response.json();
}

// Remove item (set quantity to 0)
async function removeFromCart(variantId) {
  return updateCart({ [variantId]: 0 });
}
```

---

## Section Rendering API

Reload individual sections without full page refresh:

```javascript
async function reloadSection(sectionId) {
  const url = `${window.location.pathname}?sections=${sectionId}`;
  const response = await fetch(url);
  const data = await response.json();
  const sectionElement = document.getElementById(`shopify-section-${sectionId}`);
  if (sectionElement) {
    sectionElement.outerHTML = data[sectionId];
  }
}

// Reload multiple sections at once
async function reloadSections(sectionIds) {
  const url = `${window.location.pathname}?sections=${sectionIds.join(',')}`;
  const response = await fetch(url);
  const data = await response.json();
  for (const id of sectionIds) {
    const el = document.getElementById(`shopify-section-${id}`);
    if (el) el.outerHTML = data[id];
  }
}
```

---

## Predictive Search

```javascript
async function predictiveSearch(query, types = 'product,article,page', limit = 4) {
  const url = `/search/suggest.json?q=${encodeURIComponent(query)}&resources[type]=${types}&resources[limit]=${limit}`;
  const response = await fetch(url);
  const data = await response.json();
  return data.resources.results;
}
```

---

## Product Form & Variant Switching

```liquid
{% liquid
  assign current_variant = product.selected_or_first_available_variant
%}

<product-form data-section="{{ section.id }}" data-product-url="{{ product.url }}">
  {% form 'product', product, id: product_form_id, novalidate: 'novalidate', data-type: 'add-to-cart-form' %}
    <input type="hidden" name="id" value="{{ current_variant.id }}">

    {% for option in product.options_with_values %}
      <fieldset class="product-form__option">
        <legend>{{ option.name }}</legend>
        {% for value in option.values %}
          <label class="product-form__option-label">
            <input
              type="radio"
              name="{{ option.name }}"
              value="{{ value | escape }}"
              {% if option.selected_value == value %}checked{% endif %}
              form="{{ product_form_id }}"
            >
            <span>{{ value }}</span>
          </label>
        {% endfor %}
      </fieldset>
    {% endfor %}

    <button
      type="submit"
      class="product-form__submit"
      {% unless current_variant.available %}disabled{% endunless %}
    >
      {% if current_variant.available %}
        {{ 'products.product.add_to_cart' | t }} — {{ current_variant.price | money }}
      {% else %}
        {{ 'products.product.sold_out' | t }}
      {% endif %}
    </button>
  {% endform %}

  <script type="application/json" data-product-json>
    {{ product | json }}
  </script>
</product-form>
```

---

## Performance Patterns

### Responsive Images
```liquid
{{ image | image_url: width: 1200 | image_tag:
   loading: 'lazy',
   sizes: '(min-width: 1200px) 1200px, (min-width: 768px) 50vw, 100vw',
   widths: '300,450,600,750,900,1200,1500,1800',
   alt: image.alt | escape }}
```

Above-the-fold images:
```liquid
{{ image | image_url: width: 1200 | image_tag:
   loading: 'eager',
   fetchpriority: 'high',
   sizes: '100vw',
   widths: '600,900,1200,1800' }}
```

### Conditional Asset Loading
```liquid
{{ 'section-featured-collection.css' | asset_url | stylesheet_tag }}
<script src="{{ 'featured-collection.js' | asset_url }}" defer></script>
```

### Font Preloading
```liquid
<link rel="preload" href="{{ 'custom-font.woff2' | asset_url }}" as="font" type="font/woff2" crossorigin>
```

### Whitespace Control
Use `{%- -%}` and `{{- -}}` to strip whitespace in output-heavy sections.

### JS Bundle Size
Keep minified JS under 16KB per bundle. Avoid React, Angular, Vue, jQuery — use vanilla JS or Alpine.js.

---

## JavaScript Patterns

### Custom Elements (Dawn pattern)
```javascript
class ProductCard extends HTMLElement {
  constructor() {
    super();
    this.button = this.querySelector('[data-add-to-cart]');
  }

  connectedCallback() {
    this.button?.addEventListener('click', this.handleAdd.bind(this));
  }

  disconnectedCallback() {
    this.button?.removeEventListener('click', this.handleAdd.bind(this));
  }

  async handleAdd(event) {
    event.preventDefault();
    const variantId = this.dataset.variantId;
    // ... add to cart logic
  }
}

if (!customElements.get('product-card')) {
  customElements.define('product-card', ProductCard);
}
```

### Theme Editor Events
```javascript
// Section loaded/reloaded in editor
document.addEventListener('shopify:section:load', (event) => {
  const section = event.target;
  // Re-initialize components in this section
});

document.addEventListener('shopify:section:unload', (event) => {
  // Clean up event listeners, observers, intervals
});

document.addEventListener('shopify:block:select', (event) => {
  // Scroll to or highlight the selected block
});

document.addEventListener('shopify:block:deselect', (event) => {
  // Remove highlight
});
```

### Namespace Collision Avoidance
Wrap JS in function scopes or use modules:
```javascript
// Use IIFE for scripts
(function() {
  // All variables scoped here
  const slider = document.querySelector('.slider');
})();

// Or use ES modules
// <script src="{{ 'module.js' | asset_url }}" type="module"></script>
```

---

## Accessibility Patterns

### Semantic HTML
```liquid
<nav aria-label="{{ 'general.navigation.main' | t }}">
  <ul role="list">
    {% for link in linklists.main-menu.links %}
      <li><a href="{{ link.url }}">{{ link.title | escape }}</a></li>
    {% endfor %}
  </ul>
</nav>

<main id="MainContent" role="main" tabindex="-1">
  {{ content_for_layout }}
</main>
```

### Skip Link
```liquid
<a href="#MainContent" class="skip-to-content">
  {{ 'general.accessibility.skip_to_content' | t }}
</a>
```

### Live Regions for Dynamic Content
```html
<div id="cart-notification" aria-live="polite" aria-atomic="true" role="status"></div>
```

### Focus Management
```javascript
// After adding to cart, move focus to notification
const notification = document.getElementById('cart-notification');
notification.textContent = 'Item added to cart';
notification.focus();
```

### No Inline Event Handlers
Never use inline JS handlers (`onchange`, `onclick`, `onsubmit`, `onfocus`, `onblur`, etc.) in HTML attributes. They are an accessibility red flag and indicate lack of progressive enhancement.

```liquid
{%- comment -%} ❌ FALSCH — Inline-Handler {%- endcomment -%}
<select onchange="this.form.submit()">...</select>

{%- comment -%} ✅ KORREKT — Separates JS {%- endcomment -%}
<select data-auto-submit>...</select>
{%- comment -%} In JS-Datei: document.querySelector('[data-auto-submit]').addEventListener('change', ...) {%- endcomment -%}
```

### Reduced Motion (PFLICHT in jeder CSS-Datei mit Animations/Transitions)
Every CSS file that contains `transition`, `animation`, `@keyframes`, or `scroll-behavior: smooth` MUST include:

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

**No exceptions.** This is a WCAG AA requirement and will be checked in the Theme Store review.
